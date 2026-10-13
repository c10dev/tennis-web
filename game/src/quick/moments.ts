// Where a quick match stops for cards (ADR-017): the big points of the tiebreak, three to five a match.
import type { PointTag, ScoreState } from '@tennis/engine';
import { QUICK_MOMENTS } from '../tuning.ts';

export function isDecisionPoint(score: ScoreState, tags: readonly PointTag[]): boolean {
  if (tags.includes('set_point') || tags.includes('match_point')) return true;
  return Math.min(score.points[0], score.points[1]) >= QUICK_MOMENTS.fromAll;
}
