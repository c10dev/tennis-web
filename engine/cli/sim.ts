// Batch simulation report: npm run sim -- --n 10000 --seed 42 --surface hard [--a big-server] [--ladder]
// The report goes to stdout and depends only on the arguments; timing goes to stderr.
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { addMetrics, emptyMetrics, matchMetrics, summarize, type Metrics } from '../src/match/metrics.ts';
import { averagePlayer, bigServer, createConfig, deriveSeed, playerWith, simulateMatch, type PlayerProfile, type Surface } from '../src/index.ts';
import { check, info, table, type Row } from './report.ts';
import { BIG_SERVER_ACES, targetsFor } from './targets.ts';

const { values } = parseArgs({
  options: {
    n: { type: 'string', default: '10000' },
    seed: { type: 'string', default: '42' },
    surface: { type: 'string', default: 'hard' },
    a: { type: 'string', default: 'average' },
    'best-of': { type: 'string', default: '3' },
    ladder: { type: 'boolean', default: false },
  },
});
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
const surface = values.surface as Surface;
const bestOf = Number(values['best-of']) as 3 | 5;
if (!['hard', 'clay', 'grass'].includes(surface) || !(n > 0) || ![3, 5].includes(bestOf)) {
  console.error('Usage: npm run sim -- --n 10000 --seed 42 --surface hard|clay|grass [--a average|big-server] [--best-of 3|5] [--ladder]');
  process.exit(2);
}

function batch(a: PlayerProfile, b: PlayerProfile, count: number, base: number): { all: Metrics; a: Metrics } {
  const config = createConfig([a, b], { surface, rules: { bestOf, noAd: false, finalSet: 'tiebreak7' } });
  let all = emptyMetrics();
  let onlyA = emptyMetrics();
  for (let i = 0; i < count; i++) {
    // Alternate the first server so neither player gets the edge of serving first.
    const r = simulateMatch({ ...config, firstServer: i % 2 === 0 ? 'A' : 'B' }, deriveSeed(base, i));
    all = addMetrics(all, matchMetrics(r));
    onlyA = addMetrics(onlyA, matchMetrics(r, 'A'));
  }
  return { all, a: onlyA };
}

const started = performance.now();
let failed = false;
console.log(`TennisSim batch — ${n} matches, best of ${bestOf}, ${surface}, seed ${seed}, A=${values.a}, B=average`);

if (values.ladder) {
  // Win rate of A rated 11..15 everywhere against an average (13) B must rise with the rating.
  const rows: string[] = [];
  let previous = -1;
  for (const [k, rating] of [11, 12, 13, 14, 15].entries()) {
    const a = playerWith(`R${rating}`, Object.fromEntries(Object.keys(averagePlayer('x').attributes)
      .filter((key) => key !== 'surfaceAffinity').map((key) => [key, rating])));
    a.attributes.surfaceAffinity = { hard: rating, clay: rating, grass: rating };
    const win = summarize(batch(a, averagePlayer('Avg'), n, deriveSeed(seed, 1000 + k)).all).winPctA;
    rows.push(`A rated ${rating} vs 13: ${(win * 100).toFixed(1)}% wins`);
    if (!(win > previous)) failed = true;
    previous = win;
  }
  console.log(rows.join('\n'));
  console.log(`Monotonic: ${failed ? 'FAIL' : 'PASS'}`);
} else {
  const big = values.a === 'big-server';
  const { all, a } = batch(big ? bigServer('Big') : averagePlayer('Avg A'), averagePlayer('Avg B'), n, seed);
  const s = summarize(all);
  const rows: Row[] = targetsFor(surface).map((t) => (big ? info(t, s) : check(t, s)));
  if (big) rows.push(check(BIG_SERVER_ACES, summarize(a)));
  rows.push({ label: 'Win % A', value: `${(s.winPctA * 100).toFixed(1)}%`, range: '', status: 'info' });
  console.log(table(rows));
  failed = rows.some((r) => r.status === 'FAIL');
  console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
}
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
