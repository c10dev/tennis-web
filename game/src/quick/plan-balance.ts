// Plan balance for the report (ADR-025, TD-031): random cards against average opponents shaped by their style's
// template (as the ladder's players are), every plan against every style, the same seeds for each plan.
import { averagePlayer, type PlayerAttributes, type PlayerProfile } from '@tennis/engine';
import { streamSeed } from '../rng.ts';
import { STYLES as TEMPLATES } from '../tuning.ts';
import { botMatch, STYLES, tiebreakConfig } from './balance.ts';
import { randomBot } from './bots.ts';
import { PLANS } from './plan.ts';
import type { GamePlan } from './types.ts';

export type QuickStyle = keyof typeof TEMPLATES;
export type PlanTable = Record<QuickStyle, Record<GamePlan, number>>;

/** An average player with the style's rating template on top (no noise). */
export function styledOpponent(style: QuickStyle): PlayerProfile {
  const p = averagePlayer('AI');
  const attributes: PlayerAttributes = { ...p.attributes };
  for (const [k, v] of Object.entries(TEMPLATES[style]) as [keyof typeof TEMPLATES[QuickStyle], number][]) attributes[k] += v;
  return { ...p, style, attributes };
}

/** Win share of random cards with each plan against each style, `n` matches a cell. */
export function planTable(n: number, seed: number): PlanTable {
  const out = {} as PlanTable;
  for (const style of STYLES as QuickStyle[]) {
    out[style] = {} as Record<GamePlan, number>;
    for (const plan of PLANS) {
      let wins = 0;
      for (let i = 0; i < n; i++) {
        const config = tiebreakConfig(averagePlayer('Bot'), styledOpponent(style), i, plan);
        if (botMatch(config, streamSeed(seed, 'plan', style, i), randomBot).result.winner === 'A') wins++;
      }
      out[style][plan] = wins / n;
    }
  }
  return out;
}

/** Each plan's win share averaged over the styles. */
export function planMeans(t: PlanTable): Record<GamePlan, number> {
  const rows = Object.values(t);
  return Object.fromEntries(PLANS.map((p) => [p, rows.reduce((a, r) => a + r[p], 0) / rows.length])) as Record<GamePlan, number>;
}
