// Quick-match balance report: npm run quick -- --n 2000 --seed 1
// Bots against the AI in one-tiebreak matches, deciding at the decision points; the M6 targets with PASS/FAIL
// (ADR-017). Each section belongs to one workstream: flow, read, result.
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { table } from '../../engine/cli/report.ts';
import { winRate } from '../src/quick/balance.ts';
import { randomBot } from '../src/quick/bots.ts';
import { flowRows } from './quick-flow.ts';
import { readRows } from './quick-read.ts';
import { resultRows } from './quick-result.ts';

const { values } = parseArgs({ options: { n: { type: 'string', default: '2000' }, seed: { type: 'string', default: '1' }, ladders: { type: 'string', default: '30' } } });
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
const ladders = Number(values.ladders);
if (!(n > 0) || !(ladders > 0)) {
  console.error('Usage: npm run quick -- --n 2000 --seed 1 [--ladders 30]');
  process.exit(2);
}

const started = performance.now();
const random = winRate(randomBot, n, seed);
const rows = [...flowRows(random, n, seed, ladders), ...readRows(random, n, seed), ...resultRows()];
console.log(`TennisSim quick match — ${n} matches per bot, ${ladders} ladders, seed ${seed}`);
console.log(table(rows));
const failed = rows.some((r) => r.status === 'FAIL');
console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
