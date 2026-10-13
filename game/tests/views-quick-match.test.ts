import { describe, expect, it } from 'vitest';
import { USER_ID } from '../src/player/create.ts';
import { ladderOrder, pointsToNext, rankOf } from '../src/quick/ladder.ts';
import { decide } from '../src/quick/match.ts';
import { quickHomeView } from '../src/views/quick-home.ts';
import { cardChoices, decisionSituation, momentLabel, planChoices, revealView, scoreLine } from '../src/views/quick-match.ts';
import { freshLadder, ladderWithDecision, toDecision } from './quick-helpers.ts';

describe('quickHomeView', () => {
  it('shows rank, points, the gap to the next place and the next opponent', () => {
    const s = freshLadder();
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

describe('planChoices', () => {
  it('offers the three game plans, each with a label and a one-line description, balanced by default', () => {
    const plans = planChoices();
    expect(plans.map((p) => p.plan)).toEqual(['aggressive', 'balanced', 'defensive']);
    for (const p of plans) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.line.length).toBeGreaterThan(10);
    }
    expect(plans.filter((p) => p.default).map((p) => p.plan)).toEqual(['balanced']);
  });
});

describe('momentLabel', () => {
  it('names every decision point on the banner, the user first', () => {
    expect(momentLabel([6, 4], ['set_point', 'match_point'])).toBe('MATCH POINT');
    expect(momentLabel([3, 6], ['set_point', 'match_point'])).toBe('MATCH POINT DOWN');
    expect(momentLabel([5, 5], [])).toBe('5-ALL');
    expect(momentLabel([5, 2], [])).toBe('BIG POINT');
    expect(momentLabel([1, 5], [])).toBe('BIG POINT');
  });
});

describe('a decision point', () => {
  const m = toDecision(ladderWithDecision(freshLadder()));

  it('describes the situation from the user\'s side and offers three cards with their strength', () => {
    const sit = decisionSituation(m);
    expect(sit.role === 'serve' || sit.role === 'return').toBe(true);
    expect(sit.line).toMatch(/^(Your serve|Their serve) · \d+-\d+$/);
    expect(sit.line.endsWith(scoreLine(m))).toBe(true);
    expect(sit.moment).toMatch(/^(MATCH POINT|MATCH POINT DOWN|\d+-ALL|BIG POINT)$/);
    const cards = cardChoices(m);
    expect(cards.map((c) => c.card)).toEqual(['attack', 'defend', 'counter']);
    expect(cards.find((c) => c.card === 'attack')!.beats).toBe('defend');
    for (const c of cards) expect(c.strength).toBeGreaterThan(0);
  });

  it('reveals both cards, who won the matchup and how the point ended', () => {
    const { cards, point } = decide(m, 'attack');
    const v = revealView(cards, point);
    expect(v.yours).toBe('attack');
    expect(v.theirs).toBe(cards.B);
    expect(v.matchup).toBe(cards.B === 'defend' ? 'won' : cards.B === 'counter' ? 'lost' : 'even');
    expect(['you', 'them']).toContain(v.winner);
    expect(v.how).toMatch(/Ace|Double fault|Winner|Unforced error|Forced error|Error/);
  });
});
