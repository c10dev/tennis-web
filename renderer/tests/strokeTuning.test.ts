// Stroke tuning after the slice (ADR-024, TD-063): the free arm out for balance, the serve's trophy elbow up, a racket
// handle that reads at chase distance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Mesh, Vector3, type CylinderGeometry } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
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
