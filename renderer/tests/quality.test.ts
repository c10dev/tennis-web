import { describe, expect, it } from 'vitest';
import { createQuality } from '../src/quality.ts';
import { QUALITY } from '../src/tuning/index.ts';

// Adaptive resolution (TD-038): a slow device draws fewer pixels; a fast one, or one capped at 30 fps, never changes.
type Q = ReturnType<typeof createQuality>;
/** `frames` frames of `ms(ratio)` each: a GPU-bound device's frame time follows the pixel count, ratio². */
const feed = (q: Q, ms: (ratio: number) => number, frames: number) => {
  for (let i = 0; i < frames; i++) q.frame(ms(q.ratio) / 1000);
  return q.ratio;
};
const gpuBound = (atTwo: number) => (r: number) => atTwo * (r / 2) ** 2;

describe('createQuality', () => {
  it('starts at the device pixel ratio, capped at the maximum', () => {
    expect(createQuality(3).ratio).toBe(QUALITY.maxRatio);
    expect(createQuality(1.5).ratio).toBe(1.5);
  });

  it('never changes on a device that keeps up', () => {
    expect(feed(createQuality(2), () => 16.7, 2000)).toBe(2);
  });

  it('steps a GPU-bound device down a window at a time until it meets the budget, and keeps that ratio', () => {
    const q = createQuality(2);
    expect(feed(q, gpuBound(40), QUALITY.window - 1)).toBe(2);
    expect(feed(q, gpuBound(40), 1)).toBeCloseTo(2 * QUALITY.step, 9);
    expect(feed(q, gpuBound(40), 30 * QUALITY.window)).toBeCloseTo(2 * QUALITY.step ** 2, 9);
    expect(gpuBound(40)(q.ratio)).toBeLessThanOrEqual(QUALITY.budgetMs);
  });

  it('goes back to the device ratio when a step brings no faster frames (a 30 fps cap, battery saver), and stops trying', () => {
    const q = createQuality(2);
    expect(feed(q, () => 33.3, QUALITY.window)).toBeCloseTo(2 * QUALITY.step, 9);
    expect(feed(q, () => 33.3, QUALITY.window)).toBe(2);
    expect(feed(q, () => 33.3, 20 * QUALITY.window)).toBe(2);
  });

  it('keeps a small step that brings the frames under budget', () => {
    const q = createQuality(2);
    // 23 ms at ratio 2, 21.5 ms at 1.6: only 6.5% faster, but now inside the budget.
    const ms = (r: number) => (r === 2 ? 23 : 21.5);
    expect(feed(q, ms, QUALITY.window)).toBeCloseTo(2 * QUALITY.step, 9);
    expect(feed(q, ms, 5 * QUALITY.window)).toBeCloseTo(2 * QUALITY.step, 9);
  });

  it('never goes under the minimum', () => {
    const q = createQuality(2);
    expect(feed(q, gpuBound(400), 40 * QUALITY.window)).toBeGreaterThanOrEqual(QUALITY.minRatio);
  });

  it('ignores stalls (a hidden tab, a shader compile), and never steps back up', () => {
    const q = createQuality(2);
    expect(feed(q, () => 2000, 5 * QUALITY.window)).toBe(2);
    feed(q, gpuBound(30), 2 * QUALITY.window);
    const lowered = q.ratio;
    expect(lowered).toBeLessThan(2);
    expect(feed(q, () => 8, 10 * QUALITY.window)).toBe(lowered);
  });

  it('leaves a screen already at the minimum alone', () => {
    expect(feed(createQuality(1), () => 40, 10 * QUALITY.window)).toBe(1);
  });
});
