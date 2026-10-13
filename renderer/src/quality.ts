// Adaptive resolution (TD-038): the viewer starts at the device pixel ratio and steps it down while the median frame
// misses the budget, so a slow phone keeps its frame rate; a device that keeps up never changes.
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
  return {
    get ratio() {
      return ratio;
    },
    frame(dt) {
      if (!(dt > 0) || dt > QUALITY.stallSec || ratio <= QUALITY.minRatio) return false;
      window.push(dt * 1000);
      if (window.length < QUALITY.window) return false;
      const median = [...window].sort((a, b) => a - b)[Math.floor(window.length / 2)]!;
      window = [];
      if (median <= QUALITY.budgetMs) return false;
      ratio = Math.max(QUALITY.minRatio, ratio * QUALITY.step);
      return true;
    },
  };
}
