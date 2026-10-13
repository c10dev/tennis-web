import { describe, expect, it } from 'vitest';
import { averagePlayer, bigServer, createConfig, fingerprint, finish, replayMatch, type Card, type PointEvent, type ScoreState } from '@tennis/engine';
import { matchupEdge } from '../src/quick/balance.ts';
import { isDecisionPoint } from '../src/quick/moments.ts';
import { autoPlay, createQuickMatch, decide, matchOver, type QuickMatch } from '../src/quick/match.ts';
import { personaOf } from '../src/quick/persona.ts';
import { planTactic } from '../src/quick/plan.ts';
import { QUICK_MOMENTS, TIEBREAK_RULES } from '../src/tuning.ts';
import type { GamePlan } from '../src/quick/types.ts';

const CYCLE: Card[] = ['attack', 'defend', 'counter'];
const score = (a: number, b: number): ScoreState => ({ sets: [], games: [0, 0], points: [a, b], tiebreak: true, server: 'A' });
const pointsOf = (m: QuickMatch) => m.live.events.filter((e): e is PointEvent => e.type === 'point');

function quick(seed: number, plan: GamePlan = 'balanced') {
  const config = createConfig([averagePlayer('Alex Kim'), bigServer('Flint')], { rules: { ...TIEBREAK_RULES }, tactics: [planTactic(plan), planTactic('balanced')] });
  return createQuickMatch({ config, seed, matchNo: 0, opponent: 'p1', plan, persona: personaOf(seed, 'p1'), rival: null });
}

function playOut(m: QuickMatch, pick = (i: number) => CYCLE[i % 3]!) {
  const auto: PointEvent[] = [];
  let i = 0;
  for (;;) {
    auto.push(...autoPlay(m));
    if (matchOver(m)) break;
    decide(m, pick(i++));
  }
  return auto;
}

describe('isDecisionPoint (ADR-017)', () => {
  it('stops once either player reaches five points, and at any set or match point, not before', () => {
    expect(isDecisionPoint(score(0, 0), ['tiebreak'])).toBe(false);
    expect(isDecisionPoint(score(4, 4), ['tiebreak'])).toBe(false);
    expect(isDecisionPoint(score(4, 2), ['tiebreak'])).toBe(false);
    expect(isDecisionPoint(score(5, 0), ['tiebreak'])).toBe(true);
    expect(isDecisionPoint(score(3, 5), ['tiebreak'])).toBe(true);
    expect(isDecisionPoint(score(5, 5), ['tiebreak'])).toBe(true);
    expect(isDecisionPoint(score(6, 2), ['set_point', 'match_point', 'tiebreak'])).toBe(true);
    expect(isDecisionPoint(score(1, 6), ['set_point', 'match_point', 'tiebreak'])).toBe(true);
  });
});

describe('planTactic', () => {
  it('turns the plan into how much risk the user takes on points without cards', () => {
    expect(planTactic('aggressive').aggression).toBeGreaterThan(planTactic('balanced').aggression);
    expect(planTactic('balanced').aggression).toBeGreaterThan(planTactic('defensive').aggression);
  });
});

describe('the decision cap (ADR-017 follow-up)', () => {
  it('stops for cards at most QUICK_MOMENTS.maxDecisions times; a marathon tiebreak plays on without cards after that', () => {
    let marathons = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const m = quick(seed);
      playOut(m);
      expect(m.decisions.length).toBeLessThanOrEqual(QUICK_MOMENTS.maxDecisions);
      if (m.decisions.length === QUICK_MOMENTS.maxDecisions) {
        const last = m.decisions.at(-1)!.point;
        const after = pointsOf(m).filter((p) => p.index > last);
        if (after.length) marathons++;
        for (const p of after) expect(p.cards).toBeUndefined();
      }
    }
    expect(marathons).toBeGreaterThan(0);
  });
});

describe('a quick match flow (ADR-017)', () => {
  it('plays points without cards until a decision point, where the AI has already chosen, then plays both cards', () => {
    const m = quick(4);
    const auto = autoPlay(m);
    for (const p of auto) {
      expect(p.cards).toBeUndefined();
      expect(isDecisionPoint(p.scoreBefore, p.tags)).toBe(false);
    }
    if (!matchOver(m)) {
      expect(m.pending).not.toBeNull();
      const ai = m.pending!.card;
      const { cards, point } = decide(m, 'attack');
      expect(cards).toEqual({ A: 'attack', B: ai });
      expect(point.cards).toEqual(cards);
      expect(m.pending).toBeNull();
      expect(m.decisions.at(-1)).toMatchObject({ point: point.index, user: 'attack', ai, winner: point.winner });
    }
  });

  it('refuses a card when no decision is pending', () => {
    const m = quick(4);
    expect(() => decide(m, 'attack')).toThrow(/no decision/i);
  });

  it('records a recipe (null for the points without cards) that replays the match exactly', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = quick(seed);
      playOut(m);
      const points = pointsOf(m);
      expect(m.recipe.cards).toHaveLength(points.length);
      points.forEach((p, i) => expect(m.recipe.cards[i] ?? undefined).toEqual(p.cards));
      expect(m.decisions).toHaveLength(points.filter((p) => p.cards).length);
      const replay = replayMatch(JSON.parse(JSON.stringify(m.recipe)) as typeof m.recipe);
      expect(fingerprint(replay)).toBe(fingerprint(finish(m.live)));
    }
  });

  it('is the same match for the same seed, plan and cards', () => {
    const a = quick(7, 'aggressive');
    const b = quick(7, 'aggressive');
    playOut(a);
    playOut(b);
    expect(b.recipe).toEqual(a.recipe);
    expect(a.recipe.config.tactics[0]).toEqual(planTactic('aggressive'));
  });

  it('stops for cards at least twice in every match, and only at decision points', () => {
    const counts = Array.from({ length: 100 }, (_, i) => {
      const m = quick(100 + i);
      playOut(m);
      for (const p of pointsOf(m).filter((x) => x.cards)) expect(isDecisionPoint(p.scoreBefore, p.tags)).toBe(true);
      return m.decisions.length;
    }).sort((x, y) => x - y);
    expect(counts[0]).toBeGreaterThanOrEqual(2);
    expect(counts[50]).toBeGreaterThanOrEqual(3);
  });
});

describe('matchupEdge', () => {
  it('measures how much a won matchup at the decision points is worth, the same for the same seed', () => {
    const edge = matchupEdge(60, 3);
    expect(edge).toBeGreaterThan(0.12);
    expect(edge).toBeLessThan(0.4);
    expect(matchupEdge(60, 3)).toBe(edge);
  });
});
