// What a quick match shows of each point, and how long that takes (ADR-017): points without cards tick by with a
// quick clip, decision points stop for the reveal and play whole.
import type { PointEvent } from '@tennis/engine';
import { QUICK_PACE } from '../tuning.ts';

/** A point that decided something: it won a set (or the match), or the receiver won a break point. */
export const decisive = (p: PointEvent): boolean => p.scoreAfter.sets.length > p.scoreBefore.sets.length
  || (p.tags.includes('break_point') && p.winner !== p.server);

/** Point-time window to play: all of a decision point (up to its last seconds), the end of a point without cards. */
export function clipFor(p: PointEvent): { fromTau: number; toTau: number; full: boolean } {
  const full = !!p.cards;
  const toTau = p.durationSec;
  return { fromTau: Math.max(-QUICK_PACE.tossSec, toTau - (full ? QUICK_PACE.keyMaxSec : QUICK_PACE.autoClipSec)), toTau, full };
}

/** Seconds on screen for one point in 3D, the user's thinking time aside. */
export function pointSeconds(p: PointEvent): number {
  const c = clipFor(p);
  return p.cards
    ? QUICK_PACE.revealSec + (c.toTau - c.fromTau) / QUICK_PACE.speed + QUICK_PACE.scoreSec
    : (c.toTau - c.fromTau) / QUICK_PACE.autoSpeed + QUICK_PACE.autoSec;
}

/** Seconds on screen for these points, decisions aside. */
export const broadcastSeconds = (points: readonly PointEvent[]): number => points.reduce((sum, p) => sum + pointSeconds(p), 0);
