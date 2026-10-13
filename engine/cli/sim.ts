// Batch simulation report: npm run sim -- --n 10000 --seed 42 --surface hard [--a big-server] [--ladder]
// One exhibition match's fingerprint, to compare with the replay page (TD-005): npm run sim -- --fingerprint --seed 42 --surface clay
// The report goes to stdout and depends only on the arguments; timing goes to stderr.
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import {
  averagePlayer, bigServer, createConfig, deriveSeed, exhibitionConfig, fingerprint, ratedPlayer, runBatch, simulateMatch, summarize,
  type PlayerProfile, type Surface,
} from '../src/index.ts';
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
    fingerprint: { type: 'boolean', default: false },
  },
});
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
const surface = values.surface as Surface;
const bestOf = Number(values['best-of']) as 3 | 5;
if (!['hard', 'clay', 'grass'].includes(surface) || !(n > 0) || ![3, 5].includes(bestOf) || !['average', 'big-server'].includes(values.a)) {
  console.error('Usage: npm run sim -- --n 10000 --seed 42 --surface hard|clay|grass [--a average|big-server] [--best-of 3|5] [--ladder]');
  console.error('       npm run sim -- --fingerprint --seed 42 --surface hard|clay|grass');
  process.exit(2);
}
if (values.fingerprint) {
  console.log(`fingerprint ${fingerprint(simulateMatch(exhibitionConfig(surface), seed))} (exhibition, seed ${seed}, ${surface})`);
  process.exit(0);
}

const batch = (a: PlayerProfile, base: number) =>
  runBatch(createConfig([a, averagePlayer('Avg B')], { surface, rules: { bestOf, noAd: false, finalSet: 'tiebreak7' } }), n, base);

const started = performance.now();
let failed = false;
console.log(`TennisSim batch — ${n} matches, best of ${bestOf}, ${surface}, seed ${seed}, A=${values.ladder ? 'ladder' : values.a}, B=average`);

if (values.ladder) {
  // Win rate of A rated 11..15 everywhere against an average (13) B must rise with the rating.
  let previous = -1;
  for (const [k, rating] of [11, 12, 13, 14, 15].entries()) {
    const win = summarize(batch(ratedPlayer(`R${rating}`, rating), deriveSeed(seed, 1000 + k)).all).winPctA;
    console.log(`A rated ${rating} vs 13: ${(win * 100).toFixed(1)}% wins`);
    if (!(win > previous)) failed = true;
    previous = win;
  }
  console.log(`Monotonic: ${failed ? 'FAIL' : 'PASS'}`);
} else {
  const big = values.a === 'big-server';
  const { all, a } = batch(big ? bigServer('Big') : averagePlayer('Avg A'), seed);
  const s = summarize(all);
  // The GDD table is for two average players; with a big server only the ace target applies.
  const rows: Row[] = targetsFor(surface).map((t) => (big ? info(t, s) : check(t, s)));
  if (big) rows.push(check(BIG_SERVER_ACES, summarize(a)));
  rows.push({ label: 'Win % A', value: `${(s.winPctA * 100).toFixed(1)}%`, range: '', status: 'info' });
  console.log(table(rows));
  failed = rows.some((r) => r.status === 'FAIL');
  console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
}
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
