// Where a quick match stops for cards (ADR-017): the closing stretch of the tiebreak. Once either player reaches
// five points every point is a big point (and so is any set or match point), three to five a match.
import type { PointTag, ScoreState } from '@tennis/engine';
import { QUICK_MOMENTS } from '../tuning.ts';

export function isDecisionPoint(score: ScoreState, tags: readonly PointTag[]): boolean {
  if (tags.includes('set_point') || tags.includes('match_point')) return true;
  return Math.max(score.points[0], score.points[1]) >= QUICK_MOMENTS.fromPoints;
}
