// Season balance report: npm run season -- --n 50 --seed 1
// AI-only seasons (the user's player is run by the AI policy); prints the M4 targets with PASS/FAIL (ADR-011).
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { deriveSeed } from '@tennis/engine';
import { createPlayer, defaultAllocation, USER_ID, type CreatableStyle } from '../src/player/create.ts';
import { aiChoice } from '../src/season/ai.ts';
import { averageMetrics, seasonMetrics, SEASON_TARGETS, type SeasonMetrics } from '../src/season/metrics.ts';
import { simulateSeason } from '../src/season/run.ts';
import { newSeason } from '../src/season/state.ts';
import { table, type Row } from '../../engine/cli/report.ts';

const { values } = parseArgs({ options: { n: { type: 'string', default: '50' }, seed: { type: 'string', default: '1' } } });
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
if (!(n > 0)) {
  console.error('Usage: npm run season -- --n 50 --seed 1');
  process.exit(2);
}

const styles: CreatableStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];
const started = performance.now();
const all: SeasonMetrics[] = [];
for (let i = 0; i < n; i++) {
  const s = deriveSeed(seed, i);
  const style = styles[i % styles.length]!;
  const start = newSeason(s, createPlayer({ name: 'Alex Kim', style, allocation: defaultAllocation(style) }, s));
  all.push(seasonMetrics(start, simulateSeason(start, (state) => aiChoice(state, USER_ID))));
}
const m = averageMetrics(all);

const check = (label: string, value: number, t: { min: number; max: number }, percent = false): Row => {
  const f = (v: number) => (percent ? `${(v * 100).toFixed(1)}%` : v.toFixed(2));
  return { label, value: f(value), range: `${f(t.min)} – ${f(t.max)}`, status: value >= t.min && value <= t.max ? 'PASS' : 'FAIL' };
};
const rows: Row[] = [
  check('Ranking vs ability (Spearman)', m.rankingVsLevel, SEASON_TARGETS.rankingVsLevel),
  check('Prospect growth / season (overall)', m.prospectGrowth, SEASON_TARGETS.prospectGrowth),
  check('Players injured / season', m.injuredShare, SEASON_TARGETS.injuredShare, true),
  { label: 'Bookkeeping (champions, points)', value: m.bookkeeping ? 'ok' : 'broken', range: 'ok', status: m.bookkeeping ? 'PASS' : 'FAIL' },
  { label: 'Prospects per season', value: m.prospects.toFixed(1), range: '', status: 'info' },
  { label: 'User final rank (AI-played)', value: m.userFinalRank.toFixed(1), range: '', status: 'info' },
  { label: 'User growth (overall)', value: m.userGrowth.toFixed(2), range: '', status: 'info' },
];
console.log(`TennisSim seasons — ${n} seasons, seed ${seed}`);
console.log(table(rows));
const failed = rows.some((r) => r.status === 'FAIL');
console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
