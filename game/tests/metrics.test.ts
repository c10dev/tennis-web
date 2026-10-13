import { describe, expect, it } from 'vitest';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { aiChoice } from '../src/season/ai.ts';
import { seasonMetrics, spearman } from '../src/season/metrics.ts';
import { simulateSeason } from '../src/season/run.ts';
import { newSeason } from '../src/season/state.ts';

describe('spearman', () => {
  it('is 1 for the same order, −1 for the reverse, and handles ties by average ranks', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 9);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 9);
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 9);
    expect(spearman([1, 1, 2], [1, 2, 3])).toBeCloseTo(Math.sqrt(3) / 2, 9);
  });
});

describe('seasonMetrics', () => {
  it('measures a season: ranking against level, prospects\' growth, injuries and bookkeeping', () => {
    const start = newSeason(3, createPlayer({ name: 'Alex Kim', style: 'all_court', allocation: defaultAllocation('all_court') }, 3));
    const end = simulateSeason(start, (s) => aiChoice(s, USER_ID));
    const m = seasonMetrics(start, end);
    expect(m.rankingVsLevel).toBeGreaterThan(-1);
    expect(m.rankingVsLevel).toBeLessThanOrEqual(1);
    expect(m.prospects).toBeGreaterThan(0);
    expect(Number.isFinite(m.prospectGrowth)).toBe(true);
    expect(m.injuredShare).toBeGreaterThanOrEqual(0);
    expect(m.injuredShare).toBeLessThanOrEqual(1);
    expect(m.bookkeeping).toBe(true);
    expect(m.userFinalRank).toBeGreaterThanOrEqual(1);
  });
});
