// The motion report (ADR-031, M8): what the continuity tests check, as numbers, for before/after notes.
//   npm run motion [-- --secs 300]
// Three matches (seed 2 clay, 1 grass, 3 hard), both players at 60 fps, plus the decision holds of a tiebreak played
// point by point (as trailing-walk.test.ts builds them); TV sizes on the M8 stage (TV_STAGE, CSS pixels).
import { averagePlayer, createConfig, exhibitionConfig, SCHEMA_VERSION, simulateMatch, type Card, type PlayerId, type Surface } from '@tennis/engine';
import { heldPlayers, type TellStance } from '../src/playback/hold.ts';
import { buildTimeline, type Timeline } from '../src/playback/timeline.ts';
import { carryHeights, footSlips, frameSteps, largest, quantile, tossGaps, type Step } from './motion/metrics.ts';
import { holdFrames, loadPlayerModelFile, sampleFrames, timelineFrames, type Sample } from './motion/probe.ts';
import { bodyHeightPx, racketHeadPx, racketSpanPx, stanceDistancePx } from './motion/screen.ts';

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
const TIEBREAK = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } as const;
const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { ...TIEBREAK } });
const events = simulateMatch(config, 2).events;
const ends = events.map((e, k) => (e.type === 'point' ? k : -1)).filter((k) => k >= 0);
const sofar: Timeline[] = ends.slice(0, 8).map((k) => buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: events.slice(0, k + 1) }));
const TELLS: (TellStance | null)[] = [null, ...(['attack', 'defend', 'counter'] as Card[]).flatMap((card) => [0, 1, 2].map((index) => ({ player: 'B' as const, card, index })))];
const holdSteps = sofar.slice(0, -1).flatMap((tl, k) => ids.flatMap((id) => frameSteps(sampleFrames(model, holdFrames(tl, sofar[k + 1]!, id, TELLS[(k % 9) + 1]!)))));
const entering = holdSteps.filter((s) => s.from === 'walk' && s.to === 'hold');
const leaving = holdSteps.filter((s) => s.to === 'release' || (s.from === 'release' && s.to === 'play'));
const free = steps.filter((s) => !s.stroke && !s.reaction);

console.log(`# Motion report: ${MATCHES.map(([s, f]) => `${s} ${f}`).join(', ')}; first ${secs} s, both players, 60 fps\n`);
console.log('## Per-frame steps (metres, radians)\n');
console.log('Joints: knees, ankles, elbows, hands, head, racket head; "rel" takes the run out (relative to the root).\n');
head(['what', 'n', 'p50', 'p95', 'max']);
stats('racket head, between strokes (A2 < 0.15)', free.map((s) => s.racket));
stats('racket head, in a stroke (A6 < 0.7)', steps.filter((s) => s.stroke).map((s) => s.racket));
stats('largest joint rel, between strokes (A6 < 0.25)', free.map((s) => largest(s.jointsRel)));
stats('racket head, into the hold (A1 < 0.10)', entering.map((s) => s.racket));
stats('largest joint, into the hold (A1 < 0.10)', entering.map((s) => largest(s.joints)));
stats('facing, into the hold (A1 < 0.1 rad)', entering.map((s) => s.bones['(root)']!));
stats('racket head, out of the hold (A1 < 0.10)', leaving.map((s) => s.racket));
stats('largest joint, out of the hold (A1 < 0.10)', leaving.map((s) => largest(s.joints)));
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
stats('free hand to ball, toss release', toss);

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
row(['racket head, near player', fmt(racketHeadPx(model, ready[nearId]), 1)]);
row([`racket-head span around the feet over a near groundstroke (−0.6 to +0.4 s), p50 of ${span.length}`, fmt(quantile(span, 0.5), 1)]);
row(['tell stances on the far player: mean joint distance, min / p50 of pairs', `${fmt(Math.min(...pairs), 1)} / ${fmt(quantile(pairs, 0.5), 1)}`]);
