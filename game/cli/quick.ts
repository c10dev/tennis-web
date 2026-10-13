// Quick-match balance report: npm run quick -- --n 2000 --seed 1
// Bots against the adaptive card AI in Fast4; prints the M5 short-loop targets with PASS/FAIL (ADR-016).
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { cardEntropy, ladderPace, median, skillLadder, winRate } from '../src/quick/balance.ts';
import { exploitBot, fixedBot, randomBot, readerBot } from '../src/quick/bots.ts';
import { QUICK_TARGETS as T } from '../src/quick/targets.ts';
import { table, type Row } from '../../engine/cli/report.ts';

const { values } = parseArgs({ options: { n: { type: 'string', default: '2000' }, seed: { type: 'string', default: '1' }, ladders: { type: 'string', default: '30' } } });
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
const ladders = Number(values.ladders);
if (!(n > 0) || !(ladders > 0)) {
  console.error('Usage: npm run quick -- --n 2000 --seed 1 [--ladders 30]');
  process.exit(2);
}

const started = performance.now();
const fmt = (v: number, unit: '' | '%' | 's' | 'bits') => (unit === '%' ? `${(v * 100).toFixed(1)}%` : unit === 's' ? `${v.toFixed(0)} s` : unit === 'bits' ? `${v.toFixed(2)} b` : v.toFixed(1));
const check = (label: string, v: number, t: { min: number; max: number }, unit: '' | '%' | 's' | 'bits' = ''): Row =>
  ({ label, value: fmt(v, unit), range: `${fmt(t.min, unit)} – ${fmt(t.max, unit)}`, status: v >= t.min && v <= t.max ? 'PASS' : 'FAIL' });

const random = winRate(randomBot, n, seed);
const fixed = (['attack', 'defend', 'counter'] as const).map((c) => [c, winRate(fixedBot(c), n, seed)] as const);
const vsRandom = (['attack', 'defend', 'counter'] as const).map((c) => [c, winRate(fixedBot(c), n, seed, randomBot).win] as const);
const exploit = winRate(exploitBot, n, seed);
const skill = skillLadder(Math.max(200, Math.floor(n / 4)), seed);
const climb = ladderPace(readerBot, ladders, 30, seed);
const aiCards = [...random.aiCards, ...fixed.flatMap(([, r]) => r.aiCards)];

const rows: Row[] = [
  check('Points per match (median)', median(random.points), T.medianPoints),
  check('Seconds on screen per match (median)', median(random.seconds), T.medianSeconds, 's'),
  ...fixed.map(([c, r]) => check(`Always ${c} vs adaptive AI`, r.win, T.fixedCardWin, '%')),
  ...vsRandom.map(([c, w]) => check(`Always ${c} vs any card`, w, T.cardVsRandom, '%')),
  check('Reading the AI perfectly', exploit.win, T.exploitWin, '%'),
  check('AI card entropy', cardEntropy(aiCards), T.aiEntropy, 'bits'),
  { label: 'Win % by rating 11..15 vs 13', value: skill.map((w) => `${(w * 100).toFixed(0)}`).join('/'), range: 'rising', status: skill.every((w, i) => i === 0 || w > skill[i - 1]!) ? 'PASS' : 'FAIL' },
  check('Places climbed in 30 matches', climb, T.ladderClimb30),
  { label: 'Random cards vs adaptive AI', value: fmt(random.win, '%'), range: '', status: 'info' },
];
console.log(`TennisSim quick match — ${n} matches per bot, ${ladders} ladders, seed ${seed}`);
console.log(table(rows));
const failed = rows.some((r) => r.status === 'FAIL');
console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
