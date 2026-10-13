import { describe, expect, it } from 'vitest';
import { addMetrics, emptyMetrics, matchMetrics, runBatch, summarize } from '../src/match/metrics.ts';
import { deriveSeed } from '../src/rng/mulberry32.ts';
import { createConfig, simulateMatch } from '../src/match/simulateMatch.ts';
import { averagePlayer } from '../src/player/presets.ts';
import type { PointEvent } from '../src/types.ts';

describe('batch metrics', () => {
  const r = simulateMatch(createConfig([averagePlayer('A'), averagePlayer('B')]), 8);
  const pts = r.events.filter((e): e is PointEvent => e.type === 'point');
  const m = matchMetrics(r);

  it('counts service games and holds from game_end events', () => {
    const gameEnds = r.events.filter((e) => e.type === 'game_end');
    const breaks = gameEnds.filter((e) => e.type === 'game_end' && e.isBreak).length;
    const tiebreaks = pts.filter((p, i) => p.scoreBefore.tiebreak && (i === 0 || !pts[i - 1]!.scoreBefore.tiebreak)).length;
    expect(m.serviceGames).toBe(gameEnds.length - tiebreaks);
    expect(m.holds).toBe(m.serviceGames - breaks);
  });

  it('splits serve points by first and second serve', () => {
    expect(m.servicePoints).toBe(pts.length);
    expect(m.firstServesIn).toBe(pts.filter((p) => p.serveNumber === 1).length);
    expect(m.firstServePointsWon).toBe(pts.filter((p) => p.serveNumber === 1 && p.winner === p.server).length);
    expect(m.secondServePoints).toBe(pts.filter((p) => p.serveNumber === 2).length);
    expect(m.secondServePointsWon).toBe(pts.filter((p) => p.serveNumber === 2 && p.winner === p.server).length);
    expect(m.aces).toBe(r.stats.aces[0] + r.stats.aces[1]);
    expect(m.doubleFaults).toBe(r.stats.doubleFaults[0] + r.stats.doubleFaults[1]);
  });

  it('counts rallies and tiebreak sets', () => {
    expect(m.rallyTotal).toBe(pts.reduce((a, p) => a + p.rallyLength, 0));
    expect(m.shortRallies).toBe(pts.filter((p) => p.rallyLength <= 4).length);
    const last = pts.at(-1)!.scoreAfter;
    expect(m.sets).toBe(last.sets.length);
    expect(m.tiebreakSets).toBe(last.sets.filter(([a, b]) => a + b === 13).length);
  });

  it('adds up and summarises into rates', () => {
    const total = addMetrics(addMetrics(emptyMetrics(), m), m);
    expect(total.matches).toBe(2);
    const s = summarize(total);
    expect(s.holdPct).toBeCloseTo(m.holds / m.serviceGames, 12);
    expect(s.acesPerServiceGame).toBeCloseTo(m.aces / m.serviceGames, 12);
    expect(s.avgRally).toBeCloseTo(m.rallyTotal / m.servicePoints, 12);
    expect(s.tiebreakSetPct).toBeCloseTo(m.tiebreakSets / m.sets, 12);
    expect(s.firstServeInPct).toBeCloseTo(m.firstServesIn / m.servicePoints, 12);
  });
});

describe('runBatch', () => {
  it('sums the per-match metrics of seeds derived from the base seed, alternating the first server', () => {
    const config = createConfig([averagePlayer('A'), averagePlayer('B')]);
    const batch = runBatch(config, 4, 99);
    let all = emptyMetrics();
    let onlyA = emptyMetrics();
    for (let i = 0; i < 4; i++) {
      const r = simulateMatch({ ...config, firstServer: i % 2 === 0 ? 'A' : 'B' }, deriveSeed(99, i));
      all = addMetrics(all, matchMetrics(r));
      onlyA = addMetrics(onlyA, matchMetrics(r, 'A'));
    }
    expect(batch).toEqual({ all, a: onlyA });
  });
});
