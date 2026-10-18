// M8's motion targets (ADR-031, docs/m8-character-motion.md §7): no pops at any boundary, feet that step rather than
// glide, a tennis carry between strokes and a toss from the hand, judged by what shows on a 41 px body: joint and
// racket positions, not bone twist (a bone turning about its own axis does not show at TV size). Targets not met yet
// are `it.fails`; the phase A step that meets one turns it into `it`. Numbers today: `npm run motion`.
import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@tennis/engine';
import { buildTimeline } from '../src/playback/timeline.ts';
import { carryHeights, footSlips, frameSteps, holdSteps, largest, quantile, tossGaps } from '../cli/motion/metrics.ts';
import { ALL_TELLS, loadPlayerModelFile, sampleFrames, tiebreakSoFar, timelineFrames } from '../cli/motion/probe.ts';
import { match } from './fixtures.ts';

const model = loadPlayerModelFile();
const ids: PlayerId[] = ['A', 'B'];
const SECS = 300;

const timelines = [match(2, 'clay'), match(1, 'grass'), match(3, 'hard')].map(buildTimeline);
const samples = timelines.flatMap((tl) => ids.map((id) => sampleFrames(model, timelineFrames(tl, id, 0, Math.min(SECS, tl.totalSec)))));
const steps = samples.flatMap(frameSteps);
/** Steps no stroke or reaction owns: running, walking, waiting. */
const free = steps.filter((s) => !s.stroke && !s.reaction);

// The decision holds of a tiebreak played point by point, a tell on B.
const sofar = tiebreakSoFar();
const holds = holdSteps(model, sofar, ALL_TELLS);

describe('motion continuity (M8 targets)', () => {
  it('samples enough to judge', () => {
    expect(steps.length).toBeGreaterThan(100_000);
    expect(free.length).toBeGreaterThan(30_000);
    expect(holds.length).toBe(7 * 2 * ALL_TELLS.length);
  });

  it('A1: the decision hold is entered without a pop (racket and joints < 0.10 m, facing < 0.1 rad a frame)', () => {
    for (const s of holds.flatMap((h) => h.entering)) {
      expect(s.racket, `racket at ${s.t.toFixed(3)} s`).toBeLessThan(0.1);
      expect(largest(s.joints), `joints at ${s.t.toFixed(3)} s`).toBeLessThan(0.1);
      expect(s.bones['(root)'], `facing at ${s.t.toFixed(3)} s`).toBeLessThan(0.1);
    }
  });

  // The release catches up with the motion it hands over to (a server's wind-up swings the racket behind the back), so
  // its bound is how much faster than that motion it may move: 0.15 m a frame, 9 m/s, a quick move but not a pop.
  it('A1: the decision hold hands over without a pop (no more than 0.15 m a frame beyond the timeline’s own motion)', () => {
    for (const h of holds) {
      expect(h.own.length).toBe(h.leaving.length);
      h.leaving.forEach((s, i) => {
        const own = h.own[i]!;
        expect(s.racket - own.racket, `racket at ${s.t.toFixed(3)} s, ${h.tell?.card ?? 'no'}:${h.tell?.index ?? ''}`).toBeLessThan(0.15);
        expect(largest(s.joints) - largest(own.joints), `joints at ${s.t.toFixed(3)} s, ${h.tell?.card ?? 'no'}:${h.tell?.index ?? ''}`).toBeLessThan(0.15);
        expect(s.bones['(root)'], `facing at ${s.t.toFixed(3)} s`).toBeLessThan(0.1);
      });
    }
  });

  it('A2: between strokes the racket is carried 0.6–1.2 m up (p5 and p95)', () => {
    const carry = samples.flatMap(carryHeights);
    expect(quantile(carry, 0.05)).toBeGreaterThan(0.6);
    expect(quantile(carry, 0.95)).toBeLessThan(1.2);
  });

  // In the player's frame: a quick turn to the ball swings the racket round with the body, which is not a flap.
  it('A2: between strokes the racket never flaps (under 0.15 m a frame in the player’s frame)', () => {
    for (const s of free) expect(s.racketLocal, `at ${s.t.toFixed(3)} s`).toBeLessThan(0.15);
  });

  it('A3: the serve toss leaves the free hand (under 0.10 m from the toss to the release)', () => {
    const gaps = timelines.flatMap((tl) => ids.flatMap((id) => tossGaps(model, tl, id, SECS)));
    expect(gaps.length).toBeGreaterThan(50);
    expect(Math.max(...gaps)).toBeLessThan(0.1);
  });

  it.fails('A5: a foot on the ground holds while a plant blends in or out (p95 under 2 cm a frame)', () => {
    const ramp = samples.flatMap(footSlips).filter((s) => s.kind === 'plant-ramp').map((s) => s.d);
    expect(ramp.length).toBeGreaterThan(1000);
    expect(quantile(ramp, 0.95)).toBeLessThan(0.02);
  });

  it.fails('A6: knees, ankles, elbows, hands and head never pop between strokes (under 0.25 m a frame, the run taken out)', () => {
    for (const s of free) expect(largest(s.jointsRel), `at ${s.t.toFixed(3)} s`).toBeLessThan(0.25);
  });

  it('A6: in a stroke the racket head stays under a real swing’s top speed (0.7 m a frame, 42 m/s)', () => {
    for (const s of steps.filter((x) => x.stroke)) expect(s.racket, `at ${s.t.toFixed(3)} s`).toBeLessThan(0.7);
  });
});
