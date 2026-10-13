import type { PointTag } from '../types.ts';
import { applyPoint, type ScoringState } from './match.ts';

/** Tags for the point about to be played, found by trying both outcomes. */
export function pointTags(state: ScoringState): PointTag[] {
  if (state.winner !== null) return [];
  const found = new Set<PointTag>();
  for (const p of ['A', 'B'] as const) {
    const r = applyPoint(state, p);
    const types = r.events.map((e) => e.type);
    if (!state.score.tiebreak && p !== state.score.server && types.includes('game_end')) found.add('break_point');
    if (types.includes('set_end')) found.add('set_point');
    if (r.state.winner !== null) found.add('match_point');
  }
  if (state.score.tiebreak) found.add('tiebreak');
  const order: PointTag[] = ['break_point', 'set_point', 'match_point', 'tiebreak'];
  return order.filter((t) => found.has(t));
}
