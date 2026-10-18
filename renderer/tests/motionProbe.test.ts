// The motion probe (ADR-031, M8 phase 0): samples the skinned rig over replay time, or through a decision hold as the
// viewer plays it, and measures what a frame-to-frame eye would catch. These tests check the probe, not the motion.
import { describe, expect, it } from 'vitest';
import { holdFrames, loadPlayerModelFile, sampleFrames, tiebreakSoFar, timelineFrames } from '../cli/motion/probe.ts';
import { bodyHeightPx, racketHeadPx } from '../cli/motion/screen.ts';
import { carryHeights, frameSteps, tossGaps } from '../cli/motion/metrics.ts';
import { buildTimeline, type Timeline } from '../src/playback/timeline.ts';
import { heldPlayers } from '../src/playback/hold.ts';
import { match } from './fixtures.ts';

const model = loadPlayerModelFile();
const tl = buildTimeline(match(2, 'clay'));

describe('motion probe', () => {
  it('samples a player at 60 fps from replay time, the same every time', () => {
    const a = sampleFrames(model, timelineFrames(tl, 'A', 10, 12));
    const b = sampleFrames(model, timelineFrames(tl, 'A', 10, 12));
    expect(a.length).toBe(120);
    expect(a.map((s) => s.racket.toArray())).toEqual(b.map((s) => s.racket.toArray()));
    expect(Object.keys(a[0]!.bones)).toContain('handr');
    expect(Object.keys(a[0]!.bones)).toContain('(root)');
  });

  it('finds no motion in a pose held still', () => {
    const still = heldPlayers(tl, null, 0).A;
    const s = sampleFrames(model, [0, 1, 2].map((k) => ({ t: k / 60, pose: still, phase: 'hold' as const })));
    for (const step of frameSteps(s)) {
      expect(step.racket).toBeLessThan(1e-6);
      expect(Math.max(...Object.values(step.bones))).toBeLessThan(1e-6);
    }
  });

  it('plays a decision hold as the viewer does: the walk, the hold, the release, then the next point', () => {
    const [before, after] = tiebreakSoFar(4).slice(2) as [Timeline, Timeline];
    const frames = holdFrames(before, after, 'B', { player: 'B', card: 'defend', index: 1 });
    const phases = frames.map((f) => f.phase);
    expect(phases[0]).toBe('walk');
    expect(phases.indexOf('hold')).toBeLessThan(phases.indexOf('release'));
    expect(phases.at(-1)).toBe('play');
    expect(phases.filter((p) => p === 'release').length).toBeGreaterThanOrEqual(30);
  });

  it('measures the carry between strokes and the serve toss against the free hand', () => {
    const s = sampleFrames(model, timelineFrames(tl, 'A', 0, 60));
    const carry = carryHeights(s);
    expect(carry.length).toBeGreaterThan(100);
    for (const h of carry) expect(h).toBeGreaterThan(0);
    const toss = tossGaps(model, tl, 'A', 60);
    expect(toss.length).toBeGreaterThan(3);
    for (const d of toss) expect(d).toBeGreaterThan(0);
  });

  it('measures the player and the racket in TV pixels, smaller at the far end', () => {
    const still = heldPlayers(tl, null, 0);
    const [near, far] = still.A.pos.y < 0 ? [still.A, still.B] : [still.B, still.A];
    expect(bodyHeightPx(model, near)).toBeGreaterThan(25);
    expect(bodyHeightPx(model, near)).toBeLessThan(50);
    expect(bodyHeightPx(model, far)).toBeLessThan(bodyHeightPx(model, near));
    expect(racketHeadPx(model, near)).toBeGreaterThan(3);
    expect(racketHeadPx(model, near)).toBeLessThan(20);
  });
});
