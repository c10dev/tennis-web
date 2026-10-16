// Report section for the game plans (ADR-025, TD-031): every plan against every style, random cards. The tip's edge
// is about 4 pp; the CLI plays twice the bots' matches a cell so a 2 pp floor is not read through noise.
import type { Row } from '../../engine/cli/report.ts';
import { planMeans, planTable } from '../src/quick/plan-balance.ts';
import { PLANS, planTip } from '../src/quick/plan.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { check, fmt, info } from './quick-rows.ts';

const T = QUICK_TARGETS.plan;

export function planRows(n: number, seed: number): Row[] {
  const table = planTable(n, seed);
  const means = planMeans(table);
  const values = Object.values(means);
  const edges = Object.entries(table).flatMap(([style, row]) => {
    const tip = planTip(style as keyof typeof table);
    return tip ? PLANS.filter((p) => p !== tip).map((p) => row[tip] - row[p]) : [];
  });
  return [
    ...Object.entries(table).map(([style, row]) => info(`Plans vs ${style} (agg/bal/def)`, PLANS.map((p) => fmt(row[p], '%')).join(' / '))),
    ...PLANS.map((p) => check(`Plan ${p}, all styles`, means[p], T.mean, '%')),
    check('Best plan minus worst (pp)', Math.max(...values) - Math.min(...values), T.spread, '%'),
    check('Tip plan over the others (pp, least)', Math.min(...edges), T.tipEdge, '%'),
  ];
}
