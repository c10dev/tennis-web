// The quick-match result as data (ADR-016/017): result, the decisive point and its play-by-play, points, rank change,
// the players passed, the ratings that rose (0–100) and the next goal.
import { replayMatch, type PointEvent } from '@tennis/engine';
import { USER_ID } from '../player/create.ts';
import { highlightOf } from '../quick/highlight.ts';
import { pointsToNext, type QuickState } from '../quick/ladder.ts';
import { displayRating } from '../quick/rewards.ts';
import { nextGoal } from '../quick/standing.ts';
import type { StatChange } from '../quick/types.ts';
import { QUICK_REWARD } from '../tuning.ts';
import { en } from '../text/en.ts';
import type { Messages } from '../text/types.ts';
import { playByPlay } from './quick-play-by-play.ts';
import { playerName } from './quick-home.ts';

/** A shown rating: whole numbers, whether it rose, and the share of the way to the next one before and after. */
export interface RatingView extends StatChange {
  rose: boolean;
  fill: number;
  /** Where the bar starts: the old share, or empty when the number rose (the bar starts over). */
  fillBefore: number;
}

const share = (value: number, shown: number) => Math.min(0.999, Math.max(0, value * QUICK_REWARD.displayScale - shown));

export function quickResultView(s: QuickState, t: Messages = en) {
  const r = s.history.at(-1)!;
  const decisive = highlightOf(r, t);
  const point = decisive && replayMatch(r.recipe).events.find((e): e is PointEvent => e.type === 'point' && e.index === decisive.point)!;
  const goal = nextGoal(s, t);
  const ratings: RatingView[] = r.progress.map((p) => {
    const [before, after] = [displayRating(p.before), displayRating(p.after)];
    const rose = after > before;
    return { key: p.key, label: t.rating[p.key] ?? p.key, before, after, rose, fill: share(p.after, after), fillBefore: rose ? 0 : share(p.before, before) };
  }).sort((x, y) => Number(y.rose) - Number(x.rose));
  return {
    won: r.won, conceded: !!r.conceded, headline: r.conceded ? t.concededHeadline(r.score) : t.headline(r.won, r.score), opponent: playerName(s, r.opponent), delta: r.pointsDelta,
    rankBefore: r.rankBefore, rankAfter: r.rankAfter, toNext: pointsToNext(s), points: s.points[USER_ID]!,
    decisive, playByPlay: point && decisive ? playByPlay(point, decisive, t) : [], overtakes: r.overtakes ?? [], ratings, goal,
    goalLine: goal.winsNeeded === 0 ? goal.label : t.goal.line(goal.winsNeeded, goal.label),
  };
}
