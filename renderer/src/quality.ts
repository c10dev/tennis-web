// Adaptive resolution (TD-038): the viewer starts at the device pixel ratio and steps it down while the median frame
// misses the budget, so a slow phone keeps its frame rate. A step that brings no faster frames is undone: the device is
// capped (30 fps battery saver), not short of GPU, and fewer pixels would only blur it. A device that keeps up never
// changes.
import { QUALITY } from './tuning/index.ts';

export interface Quality {
  /** The pixel ratio to draw at now. */
  readonly ratio: number;
  /** Counts one drawn frame that took `dt` seconds; returns true when the ratio just changed. */
  frame(dt: number): boolean;
}

export function createQuality(devicePixelRatio: number): Quality {
  let ratio = Math.min(devicePixelRatio, QUALITY.maxRatio);
  let window: number[] = [];
  /** The step on trial: the ratio before it and the median that caused it. */
  let trial: { from: number; median: number } | null = null;
  let settled = ratio <= QUALITY.minRatio;
  return {
    get ratio() {
      return ratio;
    },
    frame(dt) {
      if (settled || !(dt > 0) || dt > QUALITY.stallSec) return false;
      window.push(dt * 1000);
      if (window.length < QUALITY.window) return false;
      const median = [...window].sort((a, b) => a - b)[Math.floor(window.length / 2)]!;
      window = [];
      if (trial && median > trial.median * (1 - QUALITY.minGain)) {
        ratio = trial.from;
        settled = true;
        return true;
      }
      trial = null;
      if (median <= QUALITY.budgetMs) return false;
      if (ratio <= QUALITY.minRatio) {
        settled = true;
        return false;
      }
      trial = { from: ratio, median };
      ratio = Math.max(QUALITY.minRatio, ratio * QUALITY.step);
      return true;
    },
  };
}
