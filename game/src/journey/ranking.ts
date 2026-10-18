// Rankings for the text career (ADR-032): the points of the last four swings (52 weeks). Below the named pool a
// player's place is estimated from their points, so a user with a few futures points sees about where they stand.
import { overall } from '../player/overall.ts';
import { rankingOrder } from '../ranking.ts';
import { RANK } from './tuning.ts';
import type { JPlayer } from './types.ts';

export const total = (pts: readonly number[] | undefined): number => (pts ?? []).reduce((a, b) => a + b, 0);

/** Players best first by points, then level, then id. */
export function order(players: readonly JPlayer[], points: Record<string, number[]>): string[] {
  return rankingOrder(players.map((p) => ({ id: p.id, points: total(points[p.id]), level: overall(p) })));
}

/** Ranked players only (some points), best first. */
export const ranked = (players: readonly JPlayer[], points: Record<string, number[]>): string[] =>
  order(players.filter((p) => total(points[p.id]) > 0), points);

/** A place from points alone, for the many players below the named pool. */
export const estimateRank = (pts: number): number => Math.round(RANK.estimateScale * pts ** -RANK.estimateExponent);

/** The place of `who` among `pool` and them, or an estimate below the pool; null with no points. */
export function rankOf(who: JPlayer, pool: readonly JPlayer[], points: Record<string, number[]>): number | null {
  const mine = total(points[who.id]);
  if (mine <= 0) return null;
  const list = ranked([...pool.filter((p) => p.id !== who.id), who], points);
  const place = list.indexOf(who.id) + 1;
  if (place < list.length) return place;
  return Math.max(place, estimateRank(mine));
}

/** Records `earned` in this swing's slot for each player; a slot from a year ago is replaced. */
export function recordSwing(points: Record<string, number[]>, swing: number, earned: ReadonlyMap<string, number>, ids: readonly string[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const pid of ids) {
    const row = [...(points[pid] ?? [0, 0, 0, 0])];
    row[swing] = earned.get(pid) ?? 0;
    if (row.some((v) => v > 0)) out[pid] = row;
  }
  return out;
}
