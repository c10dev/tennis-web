// Quality tiers (M7, ADR-022): which tier a device starts on, and a frame meter that steps down once when the frames
// stay slow. Pure; the viewer feeds it real frame times.
import { QUALITY } from './tuning/index.ts';

export type QualityTier = keyof typeof QUALITY.tiers;

export const tierSettings = (tier: QualityTier) => QUALITY.tiers[tier];

/** Few cores usually means a weak phone: start low there (antialiasing cannot be switched off later). */
export const initialTier = (cores: number | undefined): QualityTier => (cores !== undefined && cores <= QUALITY.lowCores ? 'low' : 'high');

export interface FrameMeter {
  readonly tier: QualityTier;
  /** One frame's real time in seconds; true when the meter just stepped the tier down. */
  push(dt: number): boolean;
}

export function createFrameMeter(start: QualityTier): FrameMeter {
  let tier = start;
  let warm = 0;
  let sum = 0;
  let frames = 0;
  return {
    get tier() {
      return tier;
    },
    push(dt) {
      if (tier === 'low') return false;
      if (dt > QUALITY.pauseSec) {
        sum = 0;
        frames = 0;
        return false;
      }
      if (warm < QUALITY.warmupSec) {
        warm += dt;
        return false;
      }
      sum += dt;
      frames++;
      if (sum < QUALITY.windowSec) return false;
      const slow = (sum / frames) * 1000 > QUALITY.slowMs;
      sum = 0;
      frames = 0;
      if (slow) tier = 'low';
      return slow;
    },
  };
}
