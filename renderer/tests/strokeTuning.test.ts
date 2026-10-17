// Stroke tuning after the slice (ADR-024, TD-063): the free arm out for balance, the serve's trophy elbow up, a racket
// handle that reads at chase distance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Group, Mesh, Vector3, type CylinderGeometry } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { toLocal } from '../src/playback/stroke.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { groundToThree, toThree, yawFor } from '../src/scene/coords.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { PLAYER_RIG, STROKE_KEYS } from '../src/tuning/index.ts';
import { SAMPLE } from './fixtures.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));
const keyAt = (kind: keyof typeof STROKE_KEYS, at: number) => STROKE_KEYS[kind].find((k) => k.at === at)!;

describe('stroke keys', () => {
  it('holds the free arm out towards the ball at a forehand’s backswing and contact (Tennis Clash: x ≈ 0.5–0.6, z ≈ 0.5)', () => {
    for (const at of [-0.18, 0]) {
      const [x, , z] = keyAt('forehand', at).free;
      expect(x).toBeGreaterThanOrEqual(0.45);
      expect(z).toBeGreaterThanOrEqual(at === 0 ? 0.3 : 0.45);
    }
  });

  it('opens the free arm behind on a backhand’s follow-through', () => {
    const [x, , z] = keyAt('backhand', 0.22).free;
    expect(x).toBeGreaterThanOrEqual(0.4);
    expect(z).toBeLessThanOrEqual(-0.2);
  });
});

describe('the racket in hand', () => {
  it('has a handle thick enough to read at chase distance', () => {
    const rig = new GltfRig(model);
    const racket = rig.object3d.getObjectByName('racket')!;
    const handle = racket.children.find((c) => c.name !== 'racket-head') as Mesh;
    const g = (handle.geometry as CylinderGeometry).parameters;
    expect(Math.min(g.radiusTop, g.radiusBottom)).toBeGreaterThanOrEqual(PLAYER_RIG.racket.handleRadius * 0.85);
    expect(PLAYER_RIG.racket.handleRadius).toBeGreaterThanOrEqual(0.03);
  });
});

describe('the serve on the skinned rig', () => {
  it('lifts the racket elbow to shoulder height or above in the trophy pose and the racket drop', () => {
    const rig = new GltfRig(model);
    const gaps: number[] = [];
    for (const r of SAMPLE.slice(0, 3)) {
      const tl = buildTimeline(r);
      for (const seg of tl.segments.slice(0, 20)) {
        const s = seg.point.shots[0]!;
        for (const before of [0.45, 0.22]) {
          rig.apply(matchFrameAt(tl, seg.zero + s.t - before).players[s.hitter]);
          rig.object3d.updateMatrixWorld(true);
          const y = (name: string) => new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(name)!.matrixWorld).y;
          gaps.push(y('lowerarmr') - y('upperarmr'));
        }
      }
    }
    expect(gaps.length).toBeGreaterThan(60);
    for (const g of gaps) expect(g).toBeGreaterThan(-0.05);
  });
});

describe('the planned lunge (TD-058)', () => {
  const poses = SAMPLE.slice(0, 3).flatMap((r) => {
    const tl = buildTimeline(r);
    return tl.segments.flatMap((seg) => seg.point.shots.map((s) => ({ s, p: matchFrameAt(tl, seg.zero + s.t).players[s.hitter] })));
  });

  it('is zero for a serve and for a ball the shoulder reaches; otherwise the shortfall, towards the ball, flat', () => {
    const [sx, sy, sz] = PLAYER_RIG.shoulderR;
    let reached = 0;
    let lunged = 0;
    for (const { s, p } of poses) {
      const { contact: c, lunge } = p.stroke!;
      expect(lunge.y).toBe(0);
      const d = Math.hypot(c.x - sx, c.y - sy, c.z - sz);
      if (s.shot === 'serve' || d <= PLAYER_RIG.contactReach) {
        expect(Math.hypot(lunge.x, lunge.z)).toBe(0);
        reached++;
        continue;
      }
      lunged++;
      const flat = Math.hypot(c.x - sx, c.z - sz);
      expect(Math.hypot(lunge.x, lunge.z)).toBeCloseTo(Math.min(PLAYER_RIG.lungeMax, d - PLAYER_RIG.contactReach), 6);
      expect((lunge.x * (c.x - sx) + lunge.z * (c.z - sz)) / (Math.hypot(lunge.x, lunge.z) * flat)).toBeCloseTo(1, 6);
    }
    expect(reached).toBeGreaterThan(100);
    expect(lunged).toBeGreaterThan(5);
  });

  it('matches the rig: the shoulder rests where the plan assumes', () => {
    const rig = new GltfRig(model);
    rig.apply({ ...poses[0]!.p, pos: { x: 0, y: 0 }, facing: { x: 0, y: 1 }, stroke: null, speed: 0, reactionWeight: 0, t: 0, distance: 0 });
    rig.object3d.updateMatrixWorld(true);
    const sh = rig.object3d.worldToLocal(new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName('upperarmr')!.matrixWorld));
    const [sx, sy, sz] = PLAYER_RIG.shoulderR;
    expect(Math.hypot(sh.x - sx, sh.y - sy, sh.z - sz)).toBeLessThan(0.03);
  });
});

describe('the lunge on the skinned rig (TD-058)', () => {
  it('steps the foot on the lunge side out with the body, lifted through the move, and lands it at contact', () => {
    const rig = new GltfRig(model);
    const toes = () => {
      rig.object3d.updateMatrixWorld(true);
      return ['toesl', 'toesr'].map((n) => new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(n)!.matrixWorld).y);
    };
    let lunges = 0;
    for (const r of SAMPLE) {
      const tl = buildTimeline(r);
      for (const seg of tl.segments) {
        for (const s of seg.point.shots) {
          const at = (dt: number) => matchFrameAt(tl, seg.zero + s.t + dt).players[s.hitter];
          const lunge = at(0).stroke!.lunge;
          const length = Math.hypot(lunge.x, lunge.z);
          if (length < 0.1) continue;
          lunges++;
          // Halfway in, the stepping foot is in the air; at contact it is down.
          let highest = 0;
          for (let dt = -0.12; dt <= -0.04; dt += 0.01) {
            rig.apply(at(dt));
            highest = Math.max(highest, ...toes());
          }
          expect(highest).toBeGreaterThan(Math.min(PLAYER_RIG.step.liftMax, PLAYER_RIG.step.liftPerMetre * length) * 0.5);
          rig.apply(at(0));
          expect(Math.min(...toes())).toBeLessThan(0.05);
        }
      }
    }
    expect(lunges).toBeGreaterThanOrEqual(3);
  });
});

describe('the player frame (TD-063)', () => {
  it('agrees between the planner’s toLocal and the rig’s yawFor: a court point taken local and back lands on itself', () => {
    const frame = new Group();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * 2 * Math.PI;
      const pos = { x: Math.sin(i * 1.3) * 4, y: Math.cos(i * 0.7) * 12 };
      const facing = { x: Math.cos(a), y: Math.sin(a) };
      const p = { x: pos.x + Math.sin(i) * 2, y: pos.y + Math.cos(i * 2.1) * 2, z: 0.3 + (i % 5) * 0.4 };
      frame.position.copy(groundToThree(pos));
      frame.rotation.set(0, yawFor(facing), 0);
      frame.updateMatrixWorld(true);
      const local = toLocal(p, pos, facing);
      expect(frame.localToWorld(new Vector3(local.x, local.y, local.z)).distanceTo(toThree(p))).toBeLessThan(1e-9);
    }
  });
});
