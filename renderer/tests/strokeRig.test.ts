// Effector-key strokes on the skinned rig (ADR-024, slice step 2): the racket head meets the engine's contact point
// as A1's mannequin did, never jumps, and the pose is a function of replay time alone.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3, type Bone } from 'three';
import type { PlayerId } from '@tennis/engine';
import { readGlb } from '../src/asset/glb.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { toThree } from '../src/scene/coords.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { PLAYER_RIG, STROKE, STROKE_KEYS } from '../src/tuning/index.ts';
import { SAMPLE, match } from './fixtures.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));
const rigs: Record<PlayerId, GltfRig> = { A: new GltfRig(model), B: new GltfRig(model) };
const racketHead = (rig: GltfRig) => {
  rig.object3d.updateMatrixWorld(true);
  return new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName('racket-head')!.matrixWorld);
};
const quantile = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]!;

describe('skinned racket at contact', () => {
  const misses: Record<string, number[]> = { serve: [], forehand: [], backhand: [] };
  for (const r of SAMPLE) {
    const tl = buildTimeline(r);
    for (const seg of tl.segments) {
      for (const s of seg.point.shots) {
        const rig = rigs[s.hitter];
        rig.apply(matchFrameAt(tl, seg.zero + s.t).players[s.hitter]);
        misses[s.shot === 'serve' ? 'serve' : (s.wing ?? 'forehand')]!.push(racketHead(rig).distanceTo(toThree(s.from)));
      }
    }
  }
  for (const kind of ['serve', 'forehand', 'backhand'] as const) {
    it(`puts the racket head on the ball for a ${kind}: p95 within 0.15 m, never beyond 0.3 m`, () => {
      const m = misses[kind]!;
      expect(m.length).toBeGreaterThan(100);
      expect(quantile(m, 0.95)).toBeLessThan(0.15);
      expect(Math.max(...m)).toBeLessThan(0.3);
    });
  }
});

describe('skinned racket motion', () => {
  it('never jumps more than 0.7 m between 60 fps frames', () => {
    const tl = buildTimeline(match(2, 'clay'));
    for (const id of ['A', 'B'] as const) {
      const rig = rigs[id];
      let prev: Vector3 | null = null;
      for (let t = 0; t < Math.min(tl.totalSec, 300); t += 1 / 60) {
        rig.apply(matchFrameAt(tl, t).players[id]);
        const head = racketHead(rig);
        if (prev) expect(head.distanceTo(prev), `${id} at ${t.toFixed(3)} s`).toBeLessThan(0.7);
        prev = head;
      }
    }
  });

  it('draws the same bones for the same time whatever was drawn before', () => {
    const tl = buildTimeline(match(4, 'grass'));
    const seg = tl.segments[3]!;
    const shot = seg.point.shots[1]!;
    const at = seg.zero + shot.t - 0.1;
    const a = new GltfRig(model);
    const b = new GltfRig(model);
    a.apply(matchFrameAt(tl, at + 2).players[shot.hitter]);
    a.apply(matchFrameAt(tl, at).players[shot.hitter]);
    b.apply(matchFrameAt(tl, at).players[shot.hitter]);
    for (const name of ['hips', 'chest', 'upperarmr', 'lowerarmr', 'handr', 'upperlegl']) {
      const qa = (a.object3d.getObjectByName(name) as Bone).quaternion;
      const qb = (b.object3d.getObjectByName(name) as Bone).quaternion;
      // Components, not angleTo: on quaternions a hair off unit length angleTo reads ~5e-4 rad even between equals.
      for (let k = 0; k < 4; k++) expect(Math.abs(qa.toArray()[k]! - qb.toArray()[k]!), name).toBeLessThan(1e-7);
    }
    expect(racketHead(a).distanceTo(racketHead(b))).toBeLessThan(1e-6);
  });
});

describe('serve reach', () => {
  it('measures the standing reach the hop rule assumes, and the hop covers the highest serve (2.95 m)', () => {
    const rig = new GltfRig(model);
    const key = STROKE_KEYS.serve[3];
    const v = (a: readonly number[]) => ({ x: a[0]!, y: a[1]!, z: a[2]! });
    rig.apply({
      pos: { x: 0, y: -12 }, facing: { x: 0, y: 1 }, speed: 0, swing: null, reaction: 'none', reactionWeight: 0, gait: { phase: 0, amount: 0 },
      crouch: 0, splitStep: 0, toss: 0, t: 0, velocity: { x: 0, y: 0 }, distance: 0, reactionT: -1,
      stroke: {
        kind: 'serve', weight: 1, contactWeight: 1, hop: 0, keyTimes: [], contact: { x: -0.2, y: 4, z: 0.25 }, plant: { l: { x: 0, y: 0 }, r: { x: 0, y: 0 }, weight: 0 }, lunge: { x: 0, y: 0, z: 0 },
        keys: { pelvis: key.pelvis, turn: key.turn, lean: key.lean, drop: 0, hand: v(key.hand), dir: v(key.dir), free: v(key.free) },
      },
    });
    const reach = racketHead(rig).y;
    expect(reach).toBeGreaterThan(PLAYER_RIG.standingReach - 0.05);
    expect(reach).toBeLessThan(PLAYER_RIG.standingReach + 0.05);
    expect(reach + STROKE.serve.hopMax).toBeGreaterThan(2.95 + 0.03);
  });
});

