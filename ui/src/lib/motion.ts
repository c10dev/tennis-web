// Motion helpers for the quick screens (ADR-021). Motion never changes what the game computes: it only shows final
// values late. Timing runs on timers (never on animationend), so a hidden tab or reduced motion cannot stall a flow.

/** Ease-out cubic on 0..1 (clamped): the count-up slows into its final number. */
export const easeOutCubic = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
};

/** The whole number a count-up from 0 to `to` shows at progress `t` (0..1). Exactly `to` at the end. */
export const countValue = (to: number, t: number): number => (t >= 1 ? to : Math.trunc(to * easeOutCubic(t)) || 0);

/** Delay of the `i`th item in a stagger. */
export const staggerMs = (i: number, stepMs: number): number => i * stepMs;

/** True when the user asked for less motion: flips, pops and count-ups become cuts. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const signed = (x: number): string => `${x >= 0 ? '+' : ''}${x}`;

/** Steps one after another, every wait cut short by a skip (the result reveal, ADR-017). */
export interface Sequence {
  /** Resolves after `sec`, or at once when skipped. */
  wait(sec: number): Promise<void>;
  readonly skipped: boolean;
  skip(): void;
  /** Called once on skip (stop a replay, finish a count-up). */
  onSkip(fn: () => void): void;
}

export function createSequence(): Sequence {
  let skipped = false;
  const wakers = new Set<() => void>();
  const hooks: (() => void)[] = [];
  return {
    wait(sec) {
      if (skipped) return Promise.resolve();
      return new Promise((done) => {
        const wake = () => {
          clearTimeout(timer);
          wakers.delete(wake);
          done();
        };
        const timer = setTimeout(wake, sec * 1000);
        wakers.add(wake);
      });
    },
    get skipped() {
      return skipped;
    },
    skip() {
      if (skipped) return;
      skipped = true;
      for (const fn of hooks) fn();
      for (const wake of [...wakers]) wake();
    },
    onSkip(fn) {
      if (skipped) fn();
      else hooks.push(fn);
    },
  };
}

/** Counts `el`'s text from 0 to `to` over `sec` with an ease-out, once per frame; the final text on skip, on reduced
 *  motion, or when the frames stop coming (a hidden tab), so the flow always ends on the right number. */
export function countUp(el: HTMLElement, to: number, sec: number, seq: Sequence, fmt: (x: number) => string = signed): Promise<void> {
  let ended = false;
  let frame = 0;
  const end = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    el.textContent = fmt(to);
  };
  if (seq.skipped || prefersReducedMotion() || sec <= 0) {
    end();
    return Promise.resolve();
  }
  seq.onSkip(end);
  const t0 = performance.now();
  const tick = (now: number) => {
    if (ended) return;
    el.textContent = fmt(countValue(to, (now - t0) / (sec * 1000)));
    frame = requestAnimationFrame(tick);
  };
  el.textContent = fmt(0);
  frame = requestAnimationFrame(tick);
  return seq.wait(sec).then(end);
}

/** Sets `--i` on each element so CSS can delay it by `--i × --stagger`. */
export function stagger(els: Iterable<HTMLElement>): void {
  let i = 0;
  for (const el of els) el.style.setProperty('--i', String(i++));
}

/** Calls `fn` on a click outside buttons, on Space, or on Enter outside buttons and links (tap/Space/Enter skips to the
 *  end state). Returns the unbind. */
export function onSkipInput(fn: () => void): () => void {
  const interactive = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('button, a, input, select, textarea');
  const onClick = (e: MouseEvent) => {
    if (!interactive(e.target)) fn();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || (e.code === 'Enter' && !interactive(e.target))) {
      e.preventDefault();
      fn();
    }
  };
  window.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
  };
}
