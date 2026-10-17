// What a quick match shows of each point, and how long that takes (ADR-017): points without cards tick by with a
// quick clip, decision points stop for the reveal and play whole. The game pace (ADR-024, TD-060) plays everything at
// 1× and shows less of each point instead.
import type { PointEvent } from '@tennis/engine';
import { QUICK_PACE } from '../tuning.ts';

/** The TV pace (sped-up clips, today's players) or the game pace (1×, the slice's skinned players). */
export type PaceStyle = 'tv' | 'game';

const BIG_POINTS: readonly string[] = ['break_point', 'set_point', 'match_point'];

/** A point that decided something: it won a set (or the match), or the receiver won a break point. */
export const decisive = (p: PointEvent): boolean => p.scoreAfter.sets.length > p.scoreBefore.sets.length
  || (p.tags.includes('break_point') && p.winner !== p.server);

/** Where the game style's programme splices in its impact moment (renderer `impactMoment`): an ace or a winner on a
 *  big or decisive point. The renderer skips it on a point right after one that had it; `broadcastSeconds` too. */
export const showsImpact = (p: PointEvent): boolean => (p.endedBy === 'ace' || p.endedBy === 'winner')
  && (decisive(p) || p.tags.some((t) => BIG_POINTS.includes(t)));

/** Point-time window to play. TV: all of a decision point (up to its last seconds), the end of a point without cards.
 *  Game: from just before the last few contacts of a decision point, or the last contact of another. */
export function clipFor(p: PointEvent, style: PaceStyle = 'tv'): { fromTau: number; toTau: number; full: boolean } {
  const full = !!p.cards;
  const toTau = p.durationSec;
  const earliest = Math.max(-QUICK_PACE.tossSec, toTau - (full ? QUICK_PACE.keyMaxSec : QUICK_PACE.autoClipSec));
  if (style === 'tv') return { fromTau: earliest, toTau, full };
  const first = Math.max(0, p.shots.length - (full ? QUICK_PACE.game.keyShots : 1));
  const from = first === 0 ? -QUICK_PACE.tossSec : p.shots[first]!.t - QUICK_PACE.game.leadSec;
  return { fromTau: full ? Math.max(from, toTau - QUICK_PACE.keyMaxSec) : from, toTau, full };
}

/** Playback speed of a point's window. */
export const clipSpeed = (p: PointEvent, style: PaceStyle = 'tv'): number => (style === 'game' ? 1 : p.cards ? QUICK_PACE.speed : QUICK_PACE.autoSpeed);

/** Seconds on screen for one point in 3D, the user's thinking time aside; `impact` when the game style splices its
 *  impact moment into this point. */
export function pointSeconds(p: PointEvent, style: PaceStyle = 'tv', impact = false): number {
  const c = clipFor(p, style);
  const shown = (c.toTau - c.fromTau) / clipSpeed(p, style) + (style === 'game' && impact ? QUICK_PACE.game.impactSec : 0);
  return shown + (p.cards ? QUICK_PACE.revealSec + QUICK_PACE.scoreSec : QUICK_PACE.autoSec);
}

/** Seconds on screen for these points, decisions aside. */
export function broadcastSeconds(points: readonly PointEvent[], style: PaceStyle = 'tv'): number {
  let previous = false;
  return points.reduce((sum, p) => {
    const impact = style === 'game' && !previous && showsImpact(p);
    previous = impact;
    return sum + pointSeconds(p, style, impact);
  }, 0);
}
