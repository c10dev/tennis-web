// M8's motion targets (ADR-031, docs/m8-character-motion.md): no pops at any boundary, feet that step rather than
// glide, a tennis carry between strokes and a toss from the hand. Targets not met yet are `it.fails`; the phase A step
// that meets one turns it into `it` (the step named in each title). Numbers today: `npm run motion`.
import { describe, expect, it } from 'vitest';
import { averagePlayer, createConfig, SCHEMA_VERSION, simulateMatch, type PlayerId } from '@tennis/engine';
import { buildTimeline } from '../src/playback/timeline.ts';
import { carryHeights, footSlips, frameSteps, quantile, tossGaps, type Step } from '../cli/motion/metrics.ts';
import { holdFrames, loadPlayerModelFile, sampleFrames, timelineFrames } from '../cli/motion/probe.ts';
import { match } from './fixtures.ts';

const model = loadPlayerModelFile();
const ids: PlayerId[] = ['A', 'B'];
const SECS = 300;
const TWIST = ['handr', 'lowerarmr', 'lowerarml', 'lowerlegl', 'lowerlegr'];
const maxBone = (s: Step, only?: string[]) => Math.max(...Object.entries(s.bones).filter(([n]) => !only || only.includes(n)).map(([, v]) => v));

const timelines = [match(2, 'clay'), match(1, 'grass'), match(3, 'hard')].map(buildTimeline);
const samples = timelines.flatMap((tl) => ids.map((id) => sampleFrames(model, timelineFrames(tl, id, 0, Math.min(SECS, tl.totalSec)))));
const steps = samples.flatMap(frameSteps);

// The decision holds of a tiebreak played point by point (trailing-walk.test.ts), a tell on B.
const TIEBREAK = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } as const;
const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { ...TIEBREAK } });
const events = simulateMatch(config, 2).events;
const ends = events.map((e, i) => (e.type === 'point' ? i : -1)).filter((i) => i >= 0);
const sofar = ends.slice(0, 8).map((i) => buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: events.slice(0, i + 1) }));
const holdSteps = sofar.slice(0, -1).flatMap((tl, k) =>
  ids.flatMap((id) => frameSteps(sampleFrames(model, holdFrames(tl, sofar[k + 1]!, id, { player: 'B', card: (['attack', 'defend', 'counter'] as const)[k % 3]!, index: k % 3 })))));
const boundary = holdSteps.filter((s) => (s.from === 'walk' && s.to === 'hold') || s.to === 'release' || (s.from === 'release' && s.to === 'play'));

describe('motion continuity (M8 targets)', () => {
  it('samples enough to judge', () => {
    expect(steps.length).toBeGreaterThan(100_000);
    expect(boundary.length).toBeGreaterThan(400);
  });

  it.fails('A1: the decision hold is entered and left without a pop (racket < 0.10 m, every bone < 0.3 rad a frame)', () => {
    for (const s of boundary) {
      expect(s.racket, `racket at ${s.from}→${s.to} ${s.t.toFixed(3)} s`).toBeLessThan(0.1);
      expect(maxBone(s), `bones at ${s.from}→${s.to} ${s.t.toFixed(3)} s`).toBeLessThan(0.3);
    }
  });

  it.fails('A2: between strokes the racket is carried 0.6–1.2 m up (p5 and p95)', () => {
    const carry = samples.flatMap(carryHeights);
    expect(quantile(carry, 0.05)).toBeGreaterThan(0.6);
    expect(quantile(carry, 0.95)).toBeLessThan(1.2);
  });

  it.fails('A3: the serve toss leaves the free hand (under 0.10 m at release)', () => {
    const gaps = timelines.flatMap((tl) => ids.flatMap((id) => tossGaps(model, tl, id, SECS)));
    expect(gaps.length).toBeGreaterThan(50);
    expect(Math.max(...gaps)).toBeLessThan(0.1);
  });

  it.fails('A5: a foot on the ground holds while a plant blends in or out (p95 under 2 cm a frame)', () => {
    const ramp = samples.flatMap(footSlips).filter((s) => s.kind === 'plant-ramp').map((s) => s.d);
    expect(ramp.length).toBeGreaterThan(1000);
    expect(quantile(ramp, 0.95)).toBeLessThan(0.02);
  });

  it.fails('A6: hands, forearms and shins never flip (under 0.5 rad a frame)', () => {
    for (const s of steps) expect(maxBone(s, TWIST), `at ${s.t.toFixed(3)} s`).toBeLessThan(0.5);
  });

  it.fails('A6: the racket head never jumps more than 0.35 m a frame in play', () => {
    for (const s of steps) expect(s.racket, `at ${s.t.toFixed(3)} s`).toBeLessThan(0.35);
  });
});
