import { describe, expect, it } from 'vitest';
import { pointsToNext } from '../src/quick/ladder.ts';
import { quickResultView } from '../src/views/quick-result.ts';
import { freshLadder, ladderWithDecision, playLadderMatch } from './quick-helpers.ts';

describe('quickResultView', () => {
  it('sums up the match: result, points, rank change, next place and the ratings that grew', () => {
    const { next } = playLadderMatch(ladderWithDecision(freshLadder()));
    const v = quickResultView(next);
    const rec = next.history.at(-1)!;
    expect(v.won).toBe(rec.won);
    expect(v.headline).toBe(rec.won ? `You won ${rec.score}` : `You lost ${rec.score}`);
    expect(v.delta).toBe(rec.pointsDelta);
    expect([v.rankBefore, v.rankAfter]).toEqual([rec.rankBefore, rec.rankAfter]);
    expect(v.toNext).toBe(pointsToNext(next));
    expect(v.ratings.length).toBeGreaterThan(0);
    for (const r of v.ratings) expect(r.after).toBeGreaterThan(r.before);
  });
});
