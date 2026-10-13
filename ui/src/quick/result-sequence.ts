// The result screen's reveal (ADR-017): steps one after another, every wait cut short by a skip.
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

/** Counts `el`'s text from 0 to `to` over `sec`, signed ("+28", "-6"); jumps to the end on skip. */
export async function countUp(el: HTMLElement, to: number, sec: number, seq: Sequence): Promise<void> {
  const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x}`;
  const steps = Math.max(1, Math.min(Math.abs(to), 20));
  for (let i = 1; i <= steps && !seq.skipped; i++) {
    el.textContent = fmt(Math.round((to * i) / steps));
    await seq.wait(sec / steps);
  }
  el.textContent = fmt(to);
}
