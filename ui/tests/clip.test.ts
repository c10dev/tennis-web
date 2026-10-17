import { describe, expect, it } from 'vitest';
import { MAX_FRAME_SEC, spanSpeed, spanStep } from '../src/replay/clip.ts';

// The hybrid edit (ADR-030): a stretch of spans plays on without a break; every speed change ramps over rampSec.
describe('spanStep', () => {
  const spans = [{ from: 0, to: 5, speed: 5 }, { from: 5, to: 9, speed: 2 }, { from: 9, to: 11, speed: 1 }];

  it('starts each span at the last one’s speed and ramps to its own', () => {
    expect(spanSpeed(spans, 0, 0, 0.25)).toBe(5);
    expect(spanSpeed(spans, 1, 0, 0.25)).toBe(5);
    expect(spanSpeed(spans, 1, 0.125, 0.25)).toBeCloseTo(3.5, 9);
    expect(spanSpeed(spans, 1, 0.25, 0.25)).toBe(2);
    expect(spanSpeed(spans, 2, 1, 0.25)).toBe(1);
  });

  it('carries a frame over a span’s end into the next', () => {
    const s = spanStep(spans, { i: 0, t: 4.9, since: 0.98 }, 0.1, 0.25);
    expect(s.i).toBe(1);
    // 0.02 s to finish span 0 at 5×, then 0.08 s of span 1 starting at 5×.
    expect(s.t).toBeCloseTo(5 + 0.08 * 5, 9);
    expect(s.since).toBeCloseTo(0.08, 9);
  });

  it('ends on the last span’s end, and counts at most MAX_FRAME_SEC of a stalled frame', () => {
    const end = spanStep(spans, { i: 2, t: 10.99, since: 2 }, 0.1, 0.25);
    expect(end).toEqual({ i: 3, t: 11, since: 0 });
    expect(spanStep(spans, { i: 0, t: 0, since: 0 }, 3, 0.25).t).toBeCloseTo(MAX_FRAME_SEC * 5, 9);
  });

  it('never moves time backwards or skips it', () => {
    let s = { i: 0, t: 0, since: 0 };
    let real = 0;
    while (s.i < spans.length) {
      const next = spanStep(spans, s, 1 / 60, 0.25);
      expect(next.t).toBeGreaterThanOrEqual(s.t);
      expect(next.t - s.t).toBeLessThanOrEqual(5 / 60 + 1e-9);
      s = next;
      real += 1 / 60;
    }
    // 1 + 2 + 2 s at the spans' own speeds, a little less as each slow-down ramps in from the faster speed.
    expect(real).toBeGreaterThan(4.5);
    expect(real).toBeLessThan(5);
  });
});
