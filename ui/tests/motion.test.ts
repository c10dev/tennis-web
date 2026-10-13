import { afterEach, describe, expect, it, vi } from 'vitest';
import { countUp, countValue, createSequence, easeOutCubic, prefersReducedMotion, staggerMs } from '../src/lib/motion.ts';

describe('motion helpers (ADR-021)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('eases out: starts fast, ends at 1, clamped outside 0..1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('counts whole numbers from 0 to the target, reaching it exactly, for gains and losses', () => {
    for (const to of [28, -6, 0, 1]) {
      const seen = Array.from({ length: 61 }, (_, i) => countValue(to, i / 60));
      expect(seen[0]).toBe(0);
      expect(seen.at(-1)).toBe(to);
      expect(seen.every(Number.isInteger)).toBe(true);
      const monotone = seen.every((x, i) => i === 0 || (to >= 0 ? x >= seen[i - 1]! : x <= seen[i - 1]!));
      expect(monotone).toBe(true);
    }
    expect(countValue(28, 0.5)).toBeGreaterThan(14);
  });

  it('spaces staggered items evenly', () => {
    expect([0, 1, 2].map((i) => staggerMs(i, 60))).toEqual([0, 60, 120]);
  });

  it('reads the reduced-motion preference, and treats a missing matchMedia as no preference', () => {
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) });
    expect(prefersReducedMotion()).toBe(true);
  });

  it('waits, and a skip ends every wait at once and runs the skip hooks once', async () => {
    vi.useFakeTimers();
    const seq = createSequence();
    const hook = vi.fn();
    seq.onSkip(hook);
    let woke = false;
    void seq.wait(5).then(() => {
      woke = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(woke).toBe(false);
    seq.skip();
    seq.skip();
    await Promise.resolve();
    expect(woke).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(seq.skipped).toBe(true);
    const late = vi.fn();
    seq.onSkip(late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  /** Runs countUp with frames handed out by hand at `t0 + ms`, reporting each value step. */
  function countWithFrames(to: number) {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const el = { textContent: '' } as HTMLElement;
    const steps: number[] = [];
    const seq = createSequence();
    const t0 = performance.now();
    const done = countUp(el, to, 1, seq, String, 0, (v) => steps.push(v));
    const frame = (ms: number) => frames.shift()!(t0 + ms);
    return { el, steps, seq, done, frame };
  }

  it('reports each new value of a count-up once, and the last one when it ends on time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const c = countWithFrames(5);
    for (const ms of [100, 100, 300, 600, 900]) c.frame(ms);
    expect(c.steps).toEqual([1, 3, 4]);
    await vi.advanceTimersByTimeAsync(1000);
    await c.done;
    expect(c.steps).toEqual([1, 3, 4, 5]);
    expect(c.el.textContent).toBe('5');
  });

  it('reports nothing more when skipped: the final number is shown silently', async () => {
    const c = countWithFrames(5);
    c.frame(100);
    c.seq.skip();
    await c.done;
    expect(c.steps).toEqual([1]);
    expect(c.el.textContent).toBe('5');
  });
});
