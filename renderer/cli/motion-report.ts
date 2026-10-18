// The motion report (ADR-031, M8): what the continuity tests check, as numbers, for before/after notes.
//   npm run motion [-- --secs 300]
// Three matches (seed 2 clay, 1 grass, 3 hard), both players at 60 fps, plus the decision holds of a tiebreak played
// point by point (as trailing-walk.test.ts builds them); TV sizes on the M8 stage (TV_STAGE, CSS pixels).
import { exhibitionConfig, simulateMatch, type PlayerId, type Surface } from '@tennis/engine';
import { heldPlayers } from '../src/playback/hold.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { carryHeights, footSlips, frameSteps, holdSteps, largest, quantile, tossGaps, type Step } from './motion/metrics.ts';
import { ALL_TELLS, loadPlayerModelFile, sampleFrames, tiebreakSoFar, timelineFrames, type Sample } from './motion/probe.ts';
import { bodyHeightPx, racketHandlePx, racketHeadPx, racketSpanPx, stanceDistancePx } from './motion/screen.ts';

const i = process.argv.indexOf('--secs');
const secs = i >= 0 ? Number(process.argv[i + 1]) : 300;
const model = loadPlayerModelFile();
const ids: PlayerId[] = ['A', 'B'];
const MATCHES: [number, Surface][] = [[2, 'clay'], [1, 'grass'], [3, 'hard']];
const TWIST = ['handr', 'lowerarmr', 'lowerarml', 'lowerlegl', 'lowerlegr'];
const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const row = (cells: (string | number)[]) => console.log(`| ${cells.join(' | ')} |`);
const head = (cells: string[]) => { row(cells); row(cells.map(() => '---')); };
const stats = (name: string, a: number[], d = 3) => row([name, a.length, fmt(quantile(a, 0.5), d), fmt(quantile(a, 0.95), d), fmt(a.length ? Math.max(...a) : NaN, d)]);

// Matches.
const timelines = MATCHES.map(([seed, surface]) => buildTimeline(simulateMatch(exhibitionConfig(surface), seed)));
const samples: Sample[][] = timelines.flatMap((tl) => ids.map((id) => sampleFrames(model, timelineFrames(tl, id, 0, Math.min(secs, tl.totalSec)))));
const steps: Step[] = samples.flatMap(frameSteps);
const slips = samples.flatMap(footSlips);

// Decision holds: the match so far after each point, every tell on B in turn.
const sofar = tiebreakSoFar();
const TELLS = ALL_TELLS;
const holds = holdSteps(model, sofar, TELLS);
const entering = holds.flatMap((h) => h.entering);
const leaving = holds.flatMap((h) => h.leaving);
const excess = (pick: (s: Step) => number) => holds.flatMap((h) => h.leaving.map((s, i) => pick(s) - pick(h.own[i]!)));
const free = steps.filter((s) => !s.stroke && !s.reaction);

console.log(`# Motion report: ${MATCHES.map(([s, f]) => `${s} ${f}`).join(', ')}; first ${secs} s, both players, 60 fps\n`);
console.log('## Per-frame steps (metres, radians)\n');
console.log('Joints: knees, ankles, elbows, hands, head, racket head; "rel" takes the run out (relative to the root).\n');
head(['what', 'n', 'p50', 'p95', 'max']);
stats('racket head, between strokes, player’s frame (A2 < 0.15)', free.map((s) => s.racketLocal));
stats('racket head, between strokes, world', free.map((s) => s.racket));
stats('racket head, in a stroke (A6 < 0.7)', steps.filter((s) => s.stroke).map((s) => s.racket));
stats('largest joint rel, between strokes (A6 max < 0.35)', free.map((s) => largest(s.jointsRel)));
stats('racket head, into the hold (A1 < 0.10)', entering.map((s) => s.racket));
stats('largest joint, into the hold (A1 < 0.10)', entering.map((s) => largest(s.joints)));
stats('facing, into the hold (A1 < 0.1 rad)', entering.map((s) => s.bones['(root)']!));
stats('racket head, out of the hold, beyond the timeline’s own (A1 < 0.15)', excess((s) => s.racket));
stats('largest joint, out of the hold, beyond the timeline’s own (A1 < 0.15)', excess((s) => largest(s.joints)));
stats('facing, out of the hold (A1 < 0.1 rad)', leaving.map((s) => s.bones['(root)']!));
stats('twist bones (close-ups only, not a target)', steps.map((s) => largest(s.bones, TWIST)));
console.log(`\nTwist-bone steps over 1 rad: ${steps.filter((s) => largest(s.bones, TWIST) > 1).length} of ${steps.length} frames.\n`);

console.log('## Grounded foot slip per frame (metres)\n');
head(['body', 'n', 'p50', 'p95', 'max']);
for (const kind of ['run', 'walk', 'idle', 'planted', 'plant-ramp', 'stroke', 'reaction'] as const) stats(kind, slips.filter((s) => s.kind === kind).map((s) => s.d));

console.log('\n## Carry and toss (metres)\n');
head(['what', 'n', 'p50', 'p95', 'max']);
const carry = samples.flatMap(carryHeights);
stats('racket-head height, no stroke or reaction', carry);
console.log(`\nCarry p5: ${fmt(quantile(carry, 0.05))} m.`);
const toss = timelines.flatMap((tl) => ids.flatMap((id) => tossGaps(model, tl, id, secs)));
head(['what', 'n', 'p50', 'p95', 'max']);
stats('free hand to ball, toss start and release (A3 < 0.10)', toss);

// TV sizes.
const ready = heldPlayers(sofar[0]!, null, 0.4);
const [nearId, farId] = ready.A.pos.y < 0 ? (['A', 'B'] as const) : (['B', 'A'] as const);
const tl0 = timelines[0]!;
const drives = tl0.segments.flatMap((seg) => seg.point.shots.filter((s) => s.shot !== 'serve' && s.hitterPos.y < 0 && seg.zero + s.t < secs).map((s) => ({ s, t: seg.zero + s.t })));
const span = drives.map(({ s, t }) => racketSpanPx(sampleFrames(model, timelineFrames(tl0, s.hitter, t - 0.6, t + 0.4))));
const pairs: number[] = [];
const onFar = TELLS.map((t) => (t ? { ...t, player: farId } : null));
for (let a = 0; a < onFar.length; a++) for (let b = a + 1; b < onFar.length; b++) pairs.push(stanceDistancePx(model, sofar[0]!, farId, onFar[a]!, onFar[b]!));
console.log('\n## On the TV view (CSS px, 412×503 stage)\n');
head(['what', 'value']);
row(['body height, near / far player (ready stance)', `${fmt(bodyHeightPx(model, ready[nearId]), 1)} / ${fmt(bodyHeightPx(model, ready[farId]), 1)}`]);
row(['racket head / handle, near player (B1 ≥ 10 / ≥ 2.2)', `${fmt(racketHeadPx(model, ready[nearId]), 1)} / ${fmt(racketHandlePx(model, ready[nearId]), 1)}`]);
row([`racket-head span around the feet over a near groundstroke (−0.6 to +0.4 s; B2 ≥ 51), p50 of ${span.length}`, fmt(quantile(span, 0.5), 1)]);
row(['tell stances on the far player: mean joint distance, min / p50 of pairs', `${fmt(Math.min(...pairs), 1)} / ${fmt(quantile(pairs, 0.5), 1)}`]);
