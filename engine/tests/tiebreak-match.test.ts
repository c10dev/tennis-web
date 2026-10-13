import { describe, expect, it } from 'vitest';
import { advance, finish, isOver, replayMatch, startMatch } from '../src/match/live.ts';
import { createConfig, simulateMatch } from '../src/match/simulateMatch.ts';
import { averagePlayer, bigServer } from '../src/player/presets.ts';
import { SCHEMA_VERSION, type Card, type MatchConfig, type MatchRecipe, type PointCards, type PointEvent } from '../src/types.ts';

const TB: MatchConfig = createConfig([bigServer('Flint'), averagePlayer('Rook')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } });
const CARDS: Card[] = ['attack', 'defend', 'counter'];

describe('one-tiebreak matches (ADR-017, schema v5)', () => {
  it('plays a whole match as one tiebreak: seven points two clear, the set 1-0', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = simulateMatch(TB, seed);
      const end = r.events.at(-1)!;
      if (end.type !== 'match_end') throw new Error('no match_end');
      const [a, b] = end.score.sets[0]!;
      expect(end.score.sets).toHaveLength(1);
      expect(a + b).toBe(1);
      const last = r.events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;
      const [pa, pb] = last.scoreAfter.sets.length ? [last.scoreBefore.points[0] + (last.winner === 'A' ? 1 : 0), last.scoreBefore.points[1] + (last.winner === 'B' ? 1 : 0)] : [0, 0];
      expect(Math.max(pa, pb)).toBeGreaterThanOrEqual(7);
      expect(Math.abs(pa - pb)).toBeGreaterThanOrEqual(2);
      expect(r.events.filter((e) => e.type === 'point').every((e) => e.type === 'point' && e.tags.includes('tiebreak'))).toBe(true);
    }
  });

  it('lasts about twelve points', () => {
    const counts = Array.from({ length: 300 }, (_, i) => simulateMatch(TB, i + 1).events.filter((e) => e.type === 'point').length).sort((a, b) => a - b);
    expect(counts[150]).toBeGreaterThanOrEqual(10);
    expect(counts[150]).toBeLessThanOrEqual(14);
    expect(counts[0]).toBe(7);
  });

  it('replays a recipe where only some points had cards (null for the rest), also from JSON', () => {
    const live = startMatch(TB, 9);
    const cards: (PointCards | null)[] = [];
    while (!isOver(live)) {
      const i = cards.length;
      const c = i % 3 === 2 ? { A: CARDS[i % 3]!, B: CARDS[(i * 5) % 3]! } : null;
      cards.push(c);
      advance(live, 'point', c ? { cards: c } : {});
    }
    const recipe: MatchRecipe = JSON.parse(JSON.stringify({ config: TB, seed: 9, tacticChanges: [], cards })) as MatchRecipe;
    expect(replayMatch(recipe)).toEqual(finish(live));
    const points = finish(live).events.filter((e): e is PointEvent => e.type === 'point');
    points.forEach((p, i) => expect(p.cards ?? null).toEqual(cards[i]));
  });

  it('writes schema version 5', () => {
    expect(SCHEMA_VERSION).toBe(5);
  });
});
