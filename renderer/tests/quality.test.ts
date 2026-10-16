import { describe, expect, it } from 'vitest';
import { isOutline } from '../src/scene/outline.ts';
import { createStage } from '../src/scene/stage.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { createFrameMeter, initialTier, tierSettings } from '../src/quality.ts';
import { QUALITY } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

/** Feeds `sec` seconds of frames `ms` apart; returns how many times the meter asked to step down. */
function feed(meter: ReturnType<typeof createFrameMeter>, ms: number, sec: number): number {
  let downs = 0;
  for (let t = 0; t < sec; t += ms / 1000) if (meter.push(ms / 1000)) downs++;
  return downs;
}

describe('quality tiers (M7 step 9)', () => {
  it('starts low on a device with few cores, high otherwise or when unknown', () => {
    expect(initialTier(2)).toBe('low');
    expect(initialTier(QUALITY.lowCores)).toBe('low');
    expect(initialTier(QUALITY.lowCores + 1)).toBe('high');
    expect(initialTier(undefined)).toBe('high');
  });

  it('draws less on the low tier: lower pixel ratio cap, no antialiasing, outlines or sky dome', () => {
    const high = tierSettings('high');
    const low = tierSettings('low');
    expect(low.dprCap).toBeLessThan(high.dprCap);
    expect(high.dprCap).toBe(2);
    expect([high.antialias, high.outlines, high.sky]).toEqual([true, true, true]);
    expect([low.antialias, low.outlines, low.sky]).toEqual([false, false, false]);
  });

  it('keeps the tier at 60 fps and steps down once when frames run slower than the threshold', () => {
    expect(feed(createFrameMeter('high'), 1000 / 60, 5)).toBe(0);
    const slow = createFrameMeter('high');
    expect(feed(slow, QUALITY.slowMs + 5, QUALITY.warmupSec + QUALITY.windowSec + 1)).toBe(1);
    expect(slow.tier).toBe('low');
    expect(feed(slow, QUALITY.slowMs + 5, 5)).toBe(0);
  });

  it('ignores the warm-up after a load and pauses such as a hidden tab', () => {
    const m = createFrameMeter('high');
    expect(feed(m, 200, QUALITY.warmupSec * 0.9)).toBe(0);
    expect(m.push(5)).toBe(false);
    expect(feed(m, 1000 / 60, 5)).toBe(0);
    expect(m.tier).toBe('high');
  });

  it('never steps down from low', () => {
    expect(feed(createFrameMeter('low'), 80, 10)).toBe(0);
  });
});

describe('stage quality', () => {
  it('hides the outlines and the sky on the low tier and shows them again on high', () => {
    const stage = createStage(buildTimeline(match(2)));
    const outlines: { visible: boolean }[] = [];
    stage.scene.traverse((o) => {
      if (isOutline(o)) outlines.push(o);
    });
    const sky = stage.scene.getObjectByName('sky')!;
    expect(outlines.length).toBeGreaterThan(5);
    stage.setQuality('low');
    expect(outlines.every((o) => !o.visible)).toBe(true);
    expect(sky.visible).toBe(false);
    stage.setQuality('high');
    expect(outlines.every((o) => o.visible)).toBe(true);
    expect(sky.visible).toBe(true);
  });
});
