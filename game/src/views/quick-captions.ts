// The quick match's context captions (presentation spec E5, TD-075): a lower-third before a point that matters, and
// a one-line result after it. Both come from the events, from the user's side (the user is player A). The caption
// before a point reads only what was known before it was played: its score, tags and server, and the points before.
import type { PlayerId, PointEvent, ScoreState } from '@tennis/engine';
import { en } from '../text/en.ts';
import type { Messages } from '../text/types.ts';
import { QUICK_PACE } from '../tuning.ts';
import { ending } from './quick-play-by-play.ts';
import { momentLabel } from './quick-match.ts';

/** Who is one point from the set: ahead in games, or in points in a tiebreak (or with games level). */
function setLeader(score: ScoreState): PlayerId {
  const [ga, gb] = score.games;
  if (!score.tiebreak && ga !== gb) return ga > gb ? 'A' : 'B';
  return score.points[0] >= score.points[1] ? 'A' : 'B';
}

/** The run of points the same player has won going into this point, and who won them. */
function runOf(earlier: readonly PointEvent[]): { n: number; winner: PlayerId | null } {
  const winner = earlier.at(-1)?.winner ?? null;
  let n = 0;
  while (n < earlier.length && earlier[earlier.length - 1 - n]!.winner === winner) n++;
  return { n, winner };
}

/** The lower-third before `point` (`earlier`: this match's points before it), or null when it does not matter. */
export function captionBefore(point: PointEvent, earlier: readonly PointEvent[], t: Messages = en): string | null {
  const { tags, scoreBefore } = point;
  const ours = setLeader(scoreBefore) === 'A';
  if (tags.includes('match_point')) return ours ? t.moment.matchPoint : t.moment.matchPointDown;
  if (tags.includes('set_point')) return ours ? t.caption.setPoint : t.caption.setPointDown;
  if (tags.includes('break_point')) return point.server === 'B' ? t.caption.breakPoint : t.caption.breakPointDown;
  const run = runOf(earlier);
  if (run.n >= QUICK_PACE.caption.streakFrom) return t.caption.run(run.n, run.winner === 'A');
  // A decision point always matters: it carries the stop's moment ("승부처", "5-5 동점").
  return point.cards ? momentLabel(scoreBefore.points, tags, t) : null;
}

/** The one-line result after a point: "상대 포핸드 위너". */
export const captionAfter = (point: PointEvent, t: Messages = en): string => ending(point, t);

/** Both captions for every point of a match; a result line follows only a point that had a caption before it. */
export function pointCaptions(points: readonly PointEvent[], t: Messages = en): { before: string | null; after: string | null }[] {
  return points.map((p, i) => {
    const before = captionBefore(p, points.slice(0, i), t);
    return { before, after: before ? captionAfter(p, t) : null };
  });
}
