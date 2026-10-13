import { describe, expect, it } from 'vitest';
import type { Card, PointEvent } from '@tennis/engine';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { finishQuick, ladderOrder, newLadder, pointsToNext, rankOf } from '../src/quick/ladder.ts';
import { matchOver, playPoint, startQuick } from '../src/quick/match.ts';
import { cardChoices, pointSituation, quickHomeView, quickResultView, revealView } from '../src/views/quick.ts';

const fresh = () => newLadder(3, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, 3));
const lastPoint = (m: ReturnType<typeof startQuick>) => m.live.events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;

describe('quickHomeView', () => {
  it('shows rank, points, the gap to the next place and the next opponent', () => {
    const s = fresh();
    const v = quickHomeView(s);
    expect(v.rank).toBe(rankOf(s));
    expect(v.points).toBe(s.points[USER_ID]);
    expect(v.toNext).toBe(pointsToNext(s));
    const above = ladderOrder(s)[v.rank - 2]!;
    expect(v.progress).toBeCloseTo(s.points[USER_ID]! / s.points[above]!, 9);
    expect(v.opponent.rank).toBeLessThan(v.rank);
    expect(v.opponent.surface).toMatch(/Hard|Clay|Grass/);
    expect(v.recent).toEqual([]);
  });
});

describe('a point in a quick match', () => {
  it('describes the situation from the user\'s side and offers three cards with their strength', () => {
    const m = startQuick(fresh());
    const sit = pointSituation(m);
    expect(sit.role === 'serve' || sit.role === 'return').toBe(true);
    expect(sit.line).toMatch(/^(Your serve|Their serve) · 0-0 · Games 0-0$/);
    const cards = cardChoices(m);
    expect(cards.map((c) => c.card)).toEqual(['attack', 'defend', 'counter']);
    const attack = cards.find((c) => c.card === 'attack')!;
    expect(attack.strength).toBeGreaterThan(cards.find((c) => c.card === 'counter')!.strength);
    expect(attack.beats).toBe('defend');
  });

  it('reveals both cards, who won the matchup and how the point ended', () => {
    const m = startQuick(fresh());
    const cards = playPoint(m, 'attack');
    const v = revealView(cards, lastPoint(m));
    expect(v.yours).toBe('attack');
    expect(v.theirs).toBe(cards.B);
    const expected = cards.B === 'defend' ? 'won' : cards.B === 'counter' ? 'lost' : 'even';
    expect(v.matchup).toBe(expected);
    expect(['you', 'them']).toContain(v.winner);
    expect(v.how).toMatch(/Ace|Double fault|Winner|Unforced error|Forced error|Error/);
  });
});

describe('quickResultView', () => {
  it('sums up the match: result, points, rank change, next place and the ratings that grew', () => {
    const s = fresh();
    const m = startQuick(s);
    let i = 0;
    while (!matchOver(m)) playPoint(m, (['attack', 'counter', 'defend'] as Card[])[i++ % 3]!);
    const next = finishQuick(s, m);
    const v = quickResultView(next);
    const rec = next.history.at(-1)!;
    expect(v.won).toBe(rec.won);
    expect(v.headline).toBe(rec.won ? `You won ${rec.score}` : `You lost ${rec.score}`);
    expect(v.delta).toBe(rec.pointsDelta);
    expect([v.rankBefore, v.rankAfter]).toEqual([rec.rankBefore, rec.rankAfter]);
    expect(v.toNext).toBe(pointsToNext(next));
    expect(v.ratings.length).toBe(8);
    for (const r of v.ratings) {
      expect(r.after).toBeGreaterThan(r.before);
      expect(r.levelUp).toBe(Math.floor(r.after) > Math.floor(r.before));
    }
  });
});
