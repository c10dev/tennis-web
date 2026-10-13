// Regression guard for the tuning (npm run test:stats). 1,000 matches per case with ranges a little wider than the GDD
// targets; the full 10,000-match check is `npm run sim`.
import { describe, expect, it } from 'vitest';
import { addMetrics, emptyMetrics, matchMetrics, summarize, type Summary } from '../src/match/metrics.ts';
import { averagePlayer, bigServer, createConfig, deriveSeed, playerWith, simulateMatch, type PlayerProfile, type Surface } from '../src/index.ts';

function run(a: PlayerProfile, surface: Surface, n = 1000, base = 7): { all: Summary; a: Summary } {
  const config = createConfig([a, averagePlayer('B')], { surface });
  let all = emptyMetrics();
  let onlyA = emptyMetrics();
  for (let i = 0; i < n; i++) {
    const r = simulateMatch({ ...config, firstServer: i % 2 === 0 ? 'A' : 'B' }, deriveSeed(base, i));
    all = addMetrics(all, matchMetrics(r));
    onlyA = addMetrics(onlyA, matchMetrics(r, 'A'));
  }
  return { all: summarize(all), a: summarize(onlyA) };
}

const within = (v: number, lo: number, hi: number) => {
  expect(v).toBeGreaterThanOrEqual(lo);
  expect(v).toBeLessThanOrEqual(hi);
};

const rated = (r: number) => {
  const keys = Object.keys(averagePlayer('x').attributes).filter((k) => k !== 'surfaceAffinity');
  const p = playerWith(`R${r}`, Object.fromEntries(keys.map((k) => [k, r])));
  p.attributes.surfaceAffinity = { hard: r, clay: r, grass: r };
  return p;
};

describe('tuning regression (average vs average)', () => {
  const hold: Record<Surface, [number, number]> = { hard: [0.74, 0.86], clay: [0.69, 0.81], grass: [0.79, 0.91] };
  const results = Object.fromEntries((['hard', 'clay', 'grass'] as const).map((s) => [s, run(averagePlayer('A'), s).all]));

  for (const surface of ['hard', 'clay', 'grass'] as const) {
    it(`${surface}: GDD M1 targets within a small tolerance`, () => {
      const s = results[surface]!;
      within(s.holdPct, ...hold[surface]);
      within(s.acesPerServiceGame, 0.27, 0.83);
      within(s.doubleFaultsPerServiceGame, 0.13, 0.37);
      within(s.firstServeInPct, 0.57, 0.69);
      within(s.firstServePointsWonPct, 0.67, 0.79);
      within(s.secondServePointsWonPct, 0.47, 0.57);
      within(s.avgRally, 3.4, 5.6);
      within(s.shortRallyPct, 0.59, 0.76);
      within(s.tiebreakSetPct, 0.08, 0.27);
    });
  }

  it('surfaces order as the GDD says: clay rallies longest, grass holds most', () => {
    expect(results.clay!.avgRally).toBeGreaterThan(results.hard!.avgRally);
    expect(results.hard!.avgRally).toBeGreaterThan(results.grass!.avgRally);
    expect(results.grass!.holdPct).toBeGreaterThan(results.hard!.holdPct);
    expect(results.hard!.holdPct).toBeGreaterThan(results.clay!.holdPct);
  });
});

describe('skill', () => {
  it('a big server makes 1.0+ aces per service game', () => {
    expect(run(bigServer('Big'), 'hard', 500).a.acesPerServiceGame).toBeGreaterThanOrEqual(1);
  });

  it('win rate rises with the rating gap, one point being a clear but not crushing edge', () => {
    const wins = [11, 12, 13, 14, 15].map((r, k) => run(rated(r), 'hard', 600, 100 + k).all.winPctA);
    for (let i = 1; i < wins.length; i++) expect(wins[i]).toBeGreaterThan(wins[i - 1]!);
    within(wins[3]!, 0.6, 0.85);
  });
});
