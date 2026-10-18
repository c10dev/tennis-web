// Long-career reference batch: npm run journey -- --n 300 --seed 1 [--style smart]
// Careers played by the autoplayer (first option of every choice, a fixed plan); prints journey-design.md §8 with
// PASS/FAIL (ADR-032).
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { deriveSeed } from '@tennis/engine';
import { journeyMetrics, JOURNEY_TARGETS, runCareer, type CareerRun, type JourneyMetrics } from '../src/journey/metrics.ts';
import type { AutoStyle } from '../src/journey/plan.ts';
import { table, type Row } from '../../engine/cli/report.ts';

const { values } = parseArgs({ options: { n: { type: 'string', default: '300' }, seed: { type: 'string', default: '1' }, style: { type: 'string', default: 'smart' } } });
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
const style = values.style as AutoStyle;
if (!(n > 0) || !['smart', 'busy', 'light', 'random'].includes(style)) {
  console.error('Usage: npm run journey -- --n 300 --seed 1 [--style smart|busy|light|random]');
  process.exit(2);
}

const started = performance.now();
const runs: CareerRun[] = [];
for (let i = 0; i < n; i++) runs.push(runCareer(deriveSeed(seed, i), style));
const m = journeyMetrics(runs);
const msPerSwing = (performance.now() - started) / runs.reduce((a, r) => a + r.swings, 0);

const LABELS: Record<keyof JourneyMetrics, [string, boolean]> = {
  top100: ['Best rank in the top 100', true], top10: ['Best rank in the top 10', true], majorWinner: ['Won a Major', true],
  no1: ['Reached No. 1', true], retireAge: ['Retirement age (mean)', false], swings: ['Swings a career (mean)', false],
};
const rows: Row[] = (Object.keys(LABELS) as (keyof JourneyMetrics)[]).map((k) => {
  const [label, percent] = LABELS[k];
  const f = (v: number) => (percent ? `${(v * 100).toFixed(1)}%` : v.toFixed(1));
  const [lo, hi] = JOURNEY_TARGETS[k];
  return { label, value: f(m[k]), range: `${f(lo)} – ${f(hi)}`, status: m[k] >= lo && m[k] <= hi ? 'PASS' : 'FAIL' };
});
rows.push({ label: 'ms a swing (mean, Node, incl. start)', value: msPerSwing.toFixed(1), range: '0.0 – 150.0', status: msPerSwing <= 150 ? 'PASS' : 'FAIL' });
const pot = (lo: number, hi: number) => runs.filter((r) => r.potential >= lo && r.potential < hi);
for (const [lo, hi] of [[12, 14], [14, 15], [15, 16], [16, 17], [17, 20]] as const) {
  const g = pot(lo, hi);
  if (!g.length) continue;
  const best = g.map((r) => r.bestRank ?? 9999).sort((a, b) => a - b)[Math.floor(g.length / 2)]!;
  rows.push({ label: `Potential ${lo}–${hi}: careers, median best rank`, value: `${g.length}, ${best}`, range: '', status: 'info' });
}
console.log(`TennisSim careers — ${n} careers, seed ${seed}, plans ${style}`);
console.log(table(rows));
const failed = rows.some((r) => r.status === 'FAIL');
console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
