// Easing one player pose into another (ADR-031 A1, B3): the decision hold's ready stance takes over from the walk
// into it and hands back to the timeline after it. The pose carries a crossfade back to the first; the skinned rig
// solves both and mixes their bones, so no joint flips on the way (TD-078).
import { describe, expect, it } from 'vitest';
import { Quaternion, type Bone } from 'three';
import { blendPose } from '../src/playback/blend.ts';
import { heldPlayers } from '../src/playback/hold.ts';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { loadPlayerModelFile } from '../cli/motion/probe.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'clay'));
const held = heldPlayers(tl, null, 0.4).A;
const seg = tl.segments.find((g) => g.point.shots.some((s) => s.hitter === 'A' && s.shot !== 'serve'))!;
const walking = playerPose(tl, 'A', seg.next - 0.5);
const angle = (f: { x: number; y: number }) => Math.atan2(f.y, f.x);

describe('blending poses', () => {
  it('is the first pose at 0 and the second at 1', () => {
    expect(blendPose(walking, held, 0)).toBe(walking);
    expect(blendPose(walking, held, 1)).toBe(held);
  });

  it('is the second pose with a crossfade back to the first, position and facing eased', () => {
    const mid = blendPose(walking, held, 0.25);
    expect(mid.crossfade!.from).toBe(walking);
    expect(mid.crossfade!.weight).toBeCloseTo(0.75, 9);
    expect(mid.stroke).toBe(held.stroke);
    expect(mid.pos.x).toBeCloseTo(walking.pos.x + (held.pos.x - walking.pos.x) * 0.25, 9);
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

describe('the skinned rig crossfading', () => {
  const model = loadPlayerModelFile();
  // The hands (and what hangs from them) turn in the world, not bone by bone (B3): checked on their own below.
  const inHand = (o: { name: string; parent: { name: string; parent: unknown } | null }) => {
    for (let p: typeof o | null = o; p; p = p.parent as typeof o | null) if (p.name === 'handr' || p.name === 'handl') return true;
    return false;
  };
  const bones = (rig: GltfRig) => {
    const out: Quaternion[] = [];
    rig.object3d.traverse((o) => { if ((o as Bone).isBone && !inHand(o as never)) out.push(o.quaternion.clone()); });
    return out;
  };
  const hands = (rig: GltfRig) => ['handr', 'handl'].map((n) => rig.object3d.getObjectByName(n)!.getWorldQuaternion(new Quaternion()));
  const rigFor = (pose: typeof held) => { const rig = new GltfRig(model); rig.apply(pose); rig.object3d.updateMatrixWorld(true); return rig; };
  const [ra, rb] = [rigFor(walking), rigFor(held)];
  const [a, b] = [bones(ra), bones(rb)];

  it('draws the first pose at full weight and the second at none', () => {
    const full = bones(rigFor({ ...held, crossfade: { from: walking, weight: 1 } }));
    const none = bones(rigFor({ ...held, crossfade: { from: walking, weight: 0 } }));
    full.forEach((q, i) => expect(q.angleTo(a[i]!)).toBeLessThan(1e-3));
    none.forEach((q, i) => expect(q.angleTo(b[i]!)).toBeLessThan(1e-3));
  });

  it('turns every bone part of the way between the two at a weight between, the hands in the world', () => {
    const rig = rigFor({ ...held, crossfade: { from: walking, weight: 0.5 } });
    bones(rig).forEach((q, i) => {
      const whole = a[i]!.angleTo(b[i]!);
      const via = q.angleTo(a[i]!) + q.angleTo(b[i]!);
      // On the great circle through both: the short way or, on the rest pose's side, the long way round.
      expect(Math.min(Math.abs(via - whole), Math.abs(via - (2 * Math.PI - whole)))).toBeLessThan(0.02);
    });
    const [ha, hb] = [hands(ra), hands(rb)];
    hands(rig).forEach((q, i) => expect(q.angleTo(ha[i]!) + q.angleTo(hb[i]!)).toBeCloseTo(ha[i]!.angleTo(hb[i]!), 2));
  });
});
