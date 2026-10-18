// Room balance report: npm run room -- --n 200 --seed 1
// Four-player rooms played for a season by policies (ADR-033, journey-design.md §7); PASS/FAIL against the targets.
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { deriveSeed } from '@tennis/engine';
import { runRoomSeason, type Policy } from '../src/journey/room-metrics.ts';
import { table, type Row } from '../../engine/cli/report.ts';

const { values } = parseArgs({ options: { n: { type: 'string', default: '200' }, seed: { type: 'string', default: '1' } } });
const n = Number(values.n);
const seed = Number(values.seed) >>> 0;
if (!(n > 0)) {
  console.error('Usage: npm run room -- --n 200 --seed 1');
  process.exit(2);
}
const started = performance.now();
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

// 1. Schedules: one member per schedule style, no staff.
const schedules: Policy[] = (['smart', 'busy', 'light', 'random'] as const).map((schedule) => ({ schedule, staff: 'none' }));
const byStyle = schedules.map(() => [] as number[]);
const wins = schedules.map(() => 0);
const endRanks: number[] = [];
let swings = 0;
for (let i = 0; i < n; i++) {
  const run = runRoomSeason(deriveSeed(seed, i), schedules);
  run.points.forEach((p, k) => byStyle[k]!.push(p));
  wins[run.winner]!++;
  endRanks.push(run.rank[0] ?? 2000);
  swings += 4;
}
// 2. Staff: all smart schedules, one role each.
const staffPolicies: Policy[] = (['coach', 'physio', 'agent', 'none'] as const).map((staff) => ({ schedule: 'smart', staff }));
const byStaff = staffPolicies.map(() => [] as number[]);
for (let i = 0; i < n; i++) {
  const run = runRoomSeason(deriveSeed(seed + 1, i), staffPolicies);
  run.points.forEach((p, k) => byStaff[k]!.push(p));
  swings += 4;
}
const ms = (performance.now() - started) / swings;

const smart = mean(byStyle[0]!);
const random = mean(byStyle[3]!);
const roles = byStaff.slice(0, 3).map(mean);
const rows: Row[] = [];
const check = (label: string, value: number, lo: number, hi: number, f: (v: number) => string) =>
  rows.push({ label, value: f(value), range: `${f(lo)} – ${f(hi)}`, status: value >= lo && value <= hi ? 'PASS' : 'FAIL' });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
check('Smart over random schedule (season points)', smart / random - 1, 0.15, 0.35, pct);
check('Best single staff role over the worst', Math.max(...roles) / Math.min(...roles) - 1, 0, 0.2, pct);
check('Share of rooms won by the most winning style', Math.max(...wins) / n, 0, 0.7, pct);
check('Smart player season-end rank (median)', median(endRanks), 60, 140, (v) => v.toFixed(0));
check('ms a swing for a room of four (Node)', ms, 0, 150, (v) => v.toFixed(1));
['smart', 'busy', 'light', 'random'].forEach((s, k) => rows.push({ label: `Schedule ${s}: season points, rooms won`, value: `${mean(byStyle[k]!).toFixed(0)}, ${wins[k]}`, range: '', status: 'info' }));
['coach', 'physio', 'agent', 'none'].forEach((s, k) => rows.push({ label: `Staff ${s}: season points`, value: mean(byStaff[k]!).toFixed(0), range: '', status: 'info' }));
console.log(`TennisSim rooms — ${n} seasons of four, seed ${seed}`);
console.log(table(rows));
const failed = rows.some((r) => r.status === 'FAIL');
console.log(`Result: ${failed ? 'FAIL' : 'PASS'}`);
console.error(`elapsed ${((performance.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
