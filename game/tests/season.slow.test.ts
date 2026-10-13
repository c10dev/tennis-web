import { describe, expect, it } from 'vitest';
import { deriveSeed } from '@tennis/engine';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { aiChoice } from '../src/season/ai.ts';
import { averageMetrics, seasonMetrics, SEASON_TARGETS } from '../src/season/metrics.ts';
import { simulateSeason } from '../src/season/run.ts';
import { newSeason } from '../src/season/state.ts';

// Guards the M4 balance targets with 10 seasons (the CLI runs 50): `npm run test:season`.
describe('season balance (ADR-011)', () => {
  const all = Array.from({ length: 10 }, (_, i) => {
    const seed = deriveSeed(2026, i);
    const start = newSeason(seed, createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, seed));
    return seasonMetrics(start, simulateSeason(start, (s) => aiChoice(s, USER_ID)));
  });
  const avg = averageMetrics(all);

  it('ranks players by ability', () => expect(avg.rankingVsLevel).toBeGreaterThanOrEqual(SEASON_TARGETS.rankingVsLevel.min));
  it('grows prospects on normal training', () => {
    expect(avg.prospectGrowth).toBeGreaterThanOrEqual(SEASON_TARGETS.prospectGrowth.min - 0.2);
    expect(avg.prospectGrowth).toBeLessThanOrEqual(SEASON_TARGETS.prospectGrowth.max + 0.2);
  });
  it('injures a few players a season', () => {
    expect(avg.injuredShare).toBeGreaterThanOrEqual(SEASON_TARGETS.injuredShare.min - 0.02);
    expect(avg.injuredShare).toBeLessThanOrEqual(SEASON_TARGETS.injuredShare.max + 0.02);
  });
  it('keeps the books', () => expect(all.every((m) => m.bookkeeping)).toBe(true));
});
