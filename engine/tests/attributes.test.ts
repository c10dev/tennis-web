import { describe, expect, it } from 'vitest';
import { normalize, normalizeAttributes, validateAttributes } from '../src/player/attributes.ts';
import { averagePlayer, bigServer, playerWith, ratedPlayer } from '../src/player/presets.ts';

describe('normalize', () => {
  it('maps 1 to 0, 20 to 1 and is linear in between', () => {
    expect(normalize(1)).toBe(0);
    expect(normalize(20)).toBe(1);
    expect(normalize(13)).toBeCloseTo(12 / 19, 12);
  });

  it('rejects ratings outside 1–20 or not whole numbers', () => {
    for (const bad of [0, 21, -3, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => normalize(bad)).toThrow(RangeError);
    }
  });
});

describe('normalizeAttributes', () => {
  it('normalises every rating, including surface affinity', () => {
    const n = normalizeAttributes(averagePlayer('Avg').attributes);
    expect(n.servePower).toBeCloseTo(12 / 19, 12);
    expect(n.surfaceAffinity.clay).toBeCloseTo(12 / 19, 12);
    for (const [key, value] of Object.entries(n)) {
      if (key === 'surfaceAffinity') continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('names the attribute that is out of range', () => {
    const p = playerWith('Bad', { forehand: 25 });
    expect(() => validateAttributes(p.attributes)).toThrow(/forehand/);
    const q = averagePlayer('Bad');
    q.attributes.surfaceAffinity.grass = 0;
    expect(() => validateAttributes(q.attributes)).toThrow(/surfaceAffinity\.grass/);
  });
});

describe('presets', () => {
  it('the average player has every rating at 13', () => {
    const { surfaceAffinity, ...rest } = averagePlayer('Avg').attributes;
    expect(Object.values(rest).every((v) => v === 13)).toBe(true);
    expect(Object.values(surfaceAffinity).every((v) => v === 13)).toBe(true);
  });

  it('the big server has serve ratings of 17 or more and is otherwise average', () => {
    const a = bigServer('Big').attributes;
    expect(a.servePower).toBeGreaterThanOrEqual(17);
    expect(a.serveAccuracy).toBeGreaterThanOrEqual(17);
    expect(a.forehand).toBe(13);
    expect(bigServer('Big').style).toBe('big_server');
  });

  it('playerWith overrides only the given ratings and returns fresh objects', () => {
    const p = playerWith('P', { movement: 16 });
    expect(p.attributes.movement).toBe(16);
    expect(p.attributes.backhand).toBe(13);
    p.attributes.surfaceAffinity.hard = 5;
    expect(averagePlayer('Q').attributes.surfaceAffinity.hard).toBe(13);
  });
});

describe('ratedPlayer', () => {
  it('sets every rating, surface affinity included, to the same value', () => {
    const { surfaceAffinity, ...rest } = ratedPlayer('R', 15).attributes;
    expect(Object.values(rest).every((v) => v === 15)).toBe(true);
    expect(surfaceAffinity).toEqual({ hard: 15, clay: 15, grass: 15 });
  });
});
