import { describe, expect, it } from 'vitest';
import { planTable, planMeans } from '../src/quick/plan-balance.ts';
import { PLANS, planTip } from '../src/quick/plan.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';

// Guards the plan balance of ADR-025 (TD-031): random cards, style-shaped opponents, 2,000 matches a cell.
const T = QUICK_TARGETS.plan;

describe('game plans against opponent styles (ADR-025)', () => {
  const table = planTable(2000, 7);
  const means = planMeans(table);

  it('has no dominant plan: every plan wins about as often across the styles', () => {
    for (const p of PLANS) {
      expect(means[p]).toBeGreaterThanOrEqual(T.mean.min - 0.01);
      expect(means[p]).toBeLessThanOrEqual(T.mean.max + 0.01);
    }
    expect(Math.max(...Object.values(means)) - Math.min(...Object.values(means))).toBeLessThanOrEqual(T.spread.max + 0.01);
  });

  it('makes each plan the best one against the style its tip names', () => {
    for (const [style, row] of Object.entries(table)) {
      const tip = planTip(style as keyof typeof table);
      if (!tip) continue;
      for (const p of PLANS) if (p !== tip) expect(row[tip] - row[p]).toBeGreaterThan(T.tipEdge.min - 0.01);
    }
  });
});
