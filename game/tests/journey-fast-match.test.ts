import { describe, expect, it } from 'vitest';
import { createConfig, createRng, ratedPlayer, simulateMatch } from '@tennis/engine';
import { fastMatch, serveWin } from '../src/journey/fast-match.ts';

// Engine batch, 2026-10-18 (ADR-032): best of 3 on hard, both players near overall 14, 200 matches a cell.
const ENGINE_WIN = [[0, 0.5], [1, 0.69], [2, 0.86], [3, 0.945], [4, 0.975]] as const;

const winRate = (a: number, b: number, n: number, bestOf: 3 | 5 = 3, seed = 1) => {
  const rng = createRng(seed);
  let wins = 0;
  for (let i = 0; i < n; i++) if (fastMatch(a, b, 'hard', bestOf, rng).winner === 'A') wins++;
  return wins / n;
};

describe('fast match', () => {
  it('holds serve as the engine does for an even match, a little more on grass and less on clay', () => {
    expect(serveWin(14, 14, 'hard')).toBeCloseTo(0.643, 2);
    expect(serveWin(8, 8, 'hard')).toBeCloseTo(0.585, 2);
    expect(serveWin(14, 14, 'grass')).toBeGreaterThan(serveWin(14, 14, 'hard'));
    expect(serveWin(14, 14, 'clay')).toBeLessThan(serveWin(14, 14, 'hard'));
    expect(serveWin(15, 13, 'hard') - serveWin(13, 15, 'hard')).toBeCloseTo(0.09, 1);
  });

  it('wins matches as often as the engine for each level gap (±4 points)', () => {
    for (const [gap, engine] of ENGINE_WIN) expect(Math.abs(winRate(14 + gap / 2, 14 - gap / 2, 4000) - engine)).toBeLessThan(0.04);
  });

  it('agrees with a fresh engine batch for a one-point gap', () => {
    let wins = 0;
    const n = 120;
    for (let i = 0; i < n; i++) {
      const config = createConfig([ratedPlayer('A', 14), ratedPlayer('B', 13)], { firstServer: i % 2 ? 'A' : 'B' });
      if (simulateMatch(config, 900 + i).winner === 'A') wins++;
    }
    expect(Math.abs(wins / n - winRate(14, 13, 4000))).toBeLessThan(0.1);
  });

  it('favours the stronger player more over five sets', () => {
    expect(winRate(14.5, 13.5, 4000, 5)).toBeGreaterThan(winRate(14.5, 13.5, 4000, 3) + 0.03);
  });

  it('gives real set scores and the right number of sets', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const bestOf = i % 2 ? 3 : 5;
      const m = fastMatch(13 + (i % 4), 14, 'clay', bestOf, rng);
      const need = (bestOf + 1) / 2;
      const won = m.sets.filter(([a, b]) => (m.winner === 'A' ? a > b : b > a)).length;
      expect(won).toBe(need);
      expect(m.sets.length).toBeLessThanOrEqual(bestOf);
      for (const [a, b] of m.sets) {
        const [hi, lo] = a > b ? [a, b] : [b, a];
        expect(hi === 6 && lo <= 4 || hi === 7 && (lo === 5 || lo === 6)).toBe(true);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const run = () => Array.from({ length: 20 }, (_, i) => fastMatch(14, 13 + i / 10, 'grass', 3, createRng(i)));
    expect(run()).toEqual(run());
  });
});
