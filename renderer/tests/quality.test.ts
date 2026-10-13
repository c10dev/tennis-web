import { describe, expect, it } from 'vitest';
import { createQuality } from '../src/quality.ts';
import { QUALITY } from '../src/tuning/index.ts';

// Adaptive resolution (TD-038): a slow device draws fewer pixels; a fast one never changes.
const feed = (q: ReturnType<typeof createQuality>, ms: number, frames: number) => {
  for (let i = 0; i < frames; i++) q.frame(ms / 1000);
  return q.ratio;
};

describe('createQuality', () => {
  it('starts at the device pixel ratio, capped at the maximum', () => {
    expect(createQuality(3).ratio).toBe(QUALITY.maxRatio);
    expect(createQuality(1.5).ratio).toBe(1.5);
  });

  it('never changes on a device that keeps up', () => {
    const q = createQuality(2);
    expect(feed(q, 16.7, 2000)).toBe(2);
  });

  it('steps down after a full window of slow frames, waits a window between steps, and stops at the minimum', () => {
    const q = createQuality(2);
    expect(feed(q, 30, QUALITY.window - 1)).toBe(2);
    expect(feed(q, 30, 1)).toBeCloseTo(2 * QUALITY.step, 9);
    expect(feed(q, 30, QUALITY.window - 1)).toBeCloseTo(2 * QUALITY.step, 9);
    expect(feed(q, 30, 1)).toBeCloseTo(2 * QUALITY.step ** 2, 9);
    expect(feed(q, 30, 20 * QUALITY.window)).toBe(QUALITY.minRatio);
  });

  it('ignores stalls (a hidden tab, a shader compile), and never goes back up', () => {
    const q = createQuality(2);
    expect(feed(q, 2000, 5 * QUALITY.window)).toBe(2);
    feed(q, 30, QUALITY.window);
    const lowered = q.ratio;
    expect(feed(q, 8, 10 * QUALITY.window)).toBe(lowered);
  });

  it('leaves a screen already at or under the minimum alone', () => {
    const q = createQuality(1);
    expect(feed(q, 40, 10 * QUALITY.window)).toBe(1);
  });
});
