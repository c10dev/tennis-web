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
import { RATING_LABEL } from './format.ts';
import { playByPlay } from './quick-play-by-play.ts';
import { playerName } from './quick-home.ts';

/** A shown rating: whole numbers, whether it rose, and the share of the way to the next one. */
export interface RatingView extends StatChange {
  rose: boolean;
  fill: number;
}

export function quickResultView(s: QuickState) {
  const r = s.history.at(-1)!;
  const decisive = highlightOf(r);
  const point = replayMatch(r.recipe).events.find((e): e is PointEvent => e.type === 'point' && e.index === decisive.point)!;
  const goal = nextGoal(s);
  const ratings: RatingView[] = r.progress.map((p) => {
    const [before, after] = [displayRating(p.before), displayRating(p.after)];
    const fill = Math.max(0, p.after * QUICK_REWARD.displayScale - after);
    return { key: p.key, label: RATING_LABEL[p.key] ?? p.key, before, after, rose: after > before, fill: Math.min(0.999, fill) };
  }).sort((x, y) => Number(y.rose) - Number(x.rose));
  return {
    won: r.won, headline: `${r.won ? 'You won' : 'You lost'} ${r.score}`, opponent: playerName(s, r.opponent), delta: r.pointsDelta,
    rankBefore: r.rankBefore, rankAfter: r.rankAfter, toNext: pointsToNext(s), points: s.points[USER_ID]!,
    decisive, playByPlay: playByPlay(point, decisive), overtakes: r.overtakes ?? [], ratings, goal,
    goalLine: goal.winsNeeded === 0 ? goal.label : `${goal.winsNeeded} ${goal.winsNeeded === 1 ? 'win' : 'wins'} to ${goal.label}`,
  };
}
