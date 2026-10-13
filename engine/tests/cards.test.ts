import { describe, expect, it } from 'vitest';
import { advance, finish, isOver, replayMatch, startMatch } from '../src/match/live.ts';
import { createConfig, simulateMatch } from '../src/match/simulateMatch.ts';
import { averagePlayer, bigServer } from '../src/player/presets.ts';
import { SCHEMA_VERSION, type Card, type MatchConfig, type MatchEvent, type PointCards, type PointEvent } from '../src/types.ts';

const FAST4: MatchConfig = createConfig([bigServer('Flint'), averagePlayer('Rook')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' } });
const CARDS: Card[] = ['attack', 'defend', 'counter'];
const cardsFor = (i: number): PointCards => ({ A: CARDS[i % 3]!, B: CARDS[(i * 7 + 1) % 3]! });

describe('point-by-point play', () => {
  it('plays the same match one point at a time as in one go', () => {
    for (const config of [FAST4, createConfig([averagePlayer('Ann'), averagePlayer('Bea')])]) {
      const live = startMatch(config, 8);
      const chunks: MatchEvent[][] = [];
      while (!isOver(live)) chunks.push(advance(live, 'point'));
      for (const c of chunks) expect(c.filter((e) => e.type === 'point')).toHaveLength(1);
      expect([live.events[0], ...chunks.flat()]).toEqual(simulateMatch(config, 8).events);
    }
  });

  it('records the cards each player chose on the point they were played', () => {
    const live = startMatch(FAST4, 3);
    let i = 0;
    while (!isOver(live)) advance(live, 'point', { cards: cardsFor(i++) });
    const points = live.events.filter((e): e is PointEvent => e.type === 'point');
    points.forEach((p, k) => expect(p.cards).toEqual(cardsFor(k)));
    expect(simulateMatch(FAST4, 3).events.filter((e): e is PointEvent => e.type === 'point').every((p) => p.cards === undefined)).toBe(true);
  });

  it('takes cards only for a single point', () => {
    expect(() => advance(startMatch(FAST4, 1), 'set', { cards: cardsFor(0) })).toThrow(/one point/);
  });

  it('replays a recipe with cards exactly', () => {
    const live = startMatch(FAST4, 5);
    const cards: PointCards[] = [];
    while (!isOver(live)) {
      const c = cardsFor(cards.length);
      cards.push(c);
      advance(live, 'point', { cards: c });
    }
    expect(replayMatch({ config: FAST4, seed: 5, tacticChanges: [], cards })).toEqual(finish(live));
  });

  // Fast4 with No-Ad runs about 35 points (quartiles 29/35/40 over 1,000 matches); the brief's 1-2 minutes come from
  // short per-point clips, measured as broadcast time in the quick-match report (ADR-016).
  it('lasts a Fast4 set: a median of 28 to 40 points, never more than six deuce games and a tiebreak', () => {
    const counts = Array.from({ length: 200 }, (_, i) => simulateMatch(FAST4, i + 1).events.filter((e) => e.type === 'point').length).sort((a, b) => a - b);
    const median = counts[100]!;
    expect(median).toBeGreaterThanOrEqual(28);
    expect(median).toBeLessThanOrEqual(40);
    expect(counts[0]).toBeGreaterThanOrEqual(16);
    expect(counts.at(-1)).toBeLessThanOrEqual(6 * 7 + 9);
  });

  it('writes schema version 5', () => {
    expect(SCHEMA_VERSION).toBe(5);
  });
});
