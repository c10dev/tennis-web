// The quick-match result as data (ADR-016/017): result, points, rank change, the ratings that grew.
import { USER_ID } from '../player/create.ts';
import { pointsToNext, type QuickState } from '../quick/ladder.ts';
import { RATING_LABEL } from './format.ts';
import { playerName } from './quick-home.ts';

export function quickResultView(s: QuickState) {
  const r = s.history.at(-1)!;
  return {
    won: r.won, headline: `${r.won ? 'You won' : 'You lost'} ${r.score}`, opponent: playerName(s, r.opponent), delta: r.pointsDelta,
    rankBefore: r.rankBefore, rankAfter: r.rankAfter, toNext: pointsToNext(s), points: s.points[USER_ID]!,
    ratings: r.progress.map((p) => ({ key: p.key, label: RATING_LABEL[p.key] ?? p.key, before: p.before, after: p.after, levelUp: Math.floor(p.after) > Math.floor(p.before) })),
  };
}
