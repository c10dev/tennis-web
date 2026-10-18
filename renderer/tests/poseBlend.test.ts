// Blending one player pose into another (ADR-031 step A1): the decision hold's ready stance takes over from the walk
// into it and hands back to the timeline after it, over a fraction of a second instead of in one frame (TD-078).
import { describe, expect, it } from 'vitest';
import { blendPose } from '../src/playback/blend.ts';
import { heldPlayers } from '../src/playback/hold.ts';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'clay'));
const held = heldPlayers(tl, null, 0.4).A;
// A moment with no stroke (walking back after a point) and one inside a groundstroke.
const seg = tl.segments.find((g) => g.point.shots.some((s) => s.hitter === 'A' && s.shot !== 'serve'))!;
const walking = playerPose(tl, 'A', seg.next - 0.5);
const shot = seg.point.shots.find((s) => s.hitter === 'A' && s.shot !== 'serve')!;
const stroking = playerPose(tl, 'A', seg.zero + shot.t - 0.1);
const weight = (p: { stroke: { weight: number } | null }) => p.stroke?.weight ?? 0;
const angle = (f: { x: number; y: number }) => Math.atan2(f.y, f.x);

describe('blending poses', () => {
  it('starts from the poses it means to', () => {
    expect(walking.stroke).toBeNull();
    expect(stroking.stroke!.weight).toBe(1);
  });

  it('is the first pose at 0 and the second at 1', () => {
    for (const [a, b] of [[walking, held], [held, walking], [held, stroking]] as const) {
      const start = blendPose(a, b, 0);
      expect(start.pos).toEqual(a.pos);
      expect(start.facing.x).toBeCloseTo(a.facing.x, 9);
      expect(start.facing.y).toBeCloseTo(a.facing.y, 9);
      expect(weight(start)).toBeCloseTo(weight(a), 9);
      if (a.stroke && start.stroke) expect(start.stroke.keys).toEqual(a.stroke.keys);
      expect(blendPose(a, b, 1)).toEqual(b);
    }
  });

  it('fades a stance in over a body with no stroke, sampling both bodies’ clips (legs follow clips under a stance)', () => {
    const mid = blendPose(walking, held, 0.25);
    expect(weight(mid)).toBeCloseTo(0.25, 9);
    expect(mid.stroke!.keys).toEqual(held.stroke!.keys);
    expect(mid.speed).toBe(held.speed);
    expect(mid.clipBlend!.from).toBe(walking);
    expect(mid.clipBlend!.weight).toBeCloseTo(0.75, 9);
  });

  it('fades a stance out over the next body, its clips fading in', () => {
    const mid = blendPose(held, walking, 0.25);
    expect(weight(mid)).toBeCloseTo(0.75, 9);
    expect(mid.distance).toBe(walking.distance);
    expect(mid.clipBlend!.from).toBe(held);
    expect(mid.clipBlend!.weight).toBeCloseTo(0.75, 9);
  });

  it('turns the racket’s direction on the sphere, even between opposite directions', () => {
    const down = { ...held, stroke: { ...held.stroke!, keys: { ...held.stroke!.keys, dir: { x: 0, y: -1, z: 0 } } } };
    const up = { ...stroking, stroke: { ...stroking.stroke!, keys: { ...stroking.stroke!.keys, dir: { x: 0, y: 1, z: 0 } } } };
    let prev = down.stroke.keys.dir;
    for (let k = 1; k <= 20; k++) {
      const d = blendPose(down, up, k / 20).stroke!.keys.dir;
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
      const cos = d.x * prev.x + d.y * prev.y + d.z * prev.z;
      expect(Math.acos(Math.min(1, cos))).toBeLessThan(Math.PI / 20 + 1e-6);
      prev = d;
    }
  });

  it('lowers a hop or a bounce instead of dropping it (the counter tell bounces on its toes)', () => {
    const bouncing = { ...held, splitStep: 0.8 };
    expect(blendPose(bouncing, walking, 0.25).splitStep).toBeCloseTo(0.8 * 0.75 + walking.splitStep * 0.25, 9);
  });

  it('moves the effector keys between two strokes', () => {
    const mid = blendPose(held, stroking, 0.5);
    const [a, b] = [held.stroke!.keys, stroking.stroke!.keys];
    expect(mid.stroke!.keys.turn).toBeCloseTo((a.turn + b.turn) / 2, 9);
    expect(mid.stroke!.keys.hand.y).toBeCloseTo((a.hand.y + b.hand.y) / 2, 9);
    expect(mid.stroke!.kind).toBe(stroking.stroke!.kind);
  });

  it('turns the shorter way at an even rate, even from facing straight back', () => {
    const back = { ...walking, facing: { x: -held.facing.x, y: -held.facing.y } };
    let prev = angle(held.facing);
    for (let k = 1; k <= 20; k++) {
      const f = blendPose(held, back, k / 20).facing;
      expect(Math.hypot(f.x, f.y)).toBeCloseTo(1, 9);
      const step = Math.abs(Math.atan2(Math.sin(angle(f) - prev), Math.cos(angle(f) - prev)));
      expect(step).toBeLessThan(Math.PI / 20 + 1e-9);
      prev = angle(f);
    }
  });
});
