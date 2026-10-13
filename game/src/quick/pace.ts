// What a quick match shows of each point, and how long that takes (ADR-016).
import type { PointEvent } from '@tennis/engine';
import { QUICK_PACE } from '../tuning.ts';

/** A point that decided something: it won a set (or the match), or the receiver won a break point. */
export const decisive = (p: PointEvent): boolean => p.scoreAfter.sets.length > p.scoreBefore.sets.length
  || (p.tags.includes('break_point') && p.winner !== p.server);

/** Point-time window to play: all of a decisive point or a long rally, the end of anything else. */
export function clipFor(p: PointEvent): { fromTau: number; toTau: number; full: boolean } {
  const full = decisive(p) || p.rallyLength >= QUICK_PACE.keyRally;
  const toTau = p.durationSec;
  return { fromTau: full ? -QUICK_PACE.tossSec : Math.max(-QUICK_PACE.tossSec, toTau - QUICK_PACE.clipSec), toTau, full };
}

/** Seconds on screen for these points, decisions aside. */
export function broadcastSeconds(points: readonly PointEvent[]): number {
  return points.reduce((sum, p) => {
    const c = clipFor(p);
    return sum + QUICK_PACE.revealSec + (c.toTau - c.fromTau) / QUICK_PACE.speed + QUICK_PACE.scoreSec;
  }, 0);
}
