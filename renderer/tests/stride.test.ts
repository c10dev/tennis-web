// Locomotion clips' strides (ADR-024, slice step 3), measured from the clips themselves: a clip advances one cycle
// per stride of distance travelled, so a foot in stance stays put on the ground.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3, type Bone } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import { bindClips, restPose, sampleClips } from '../src/scene/clipSampler.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { PLAYER_RIG } from '../src/tuning/index.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));

/**
 * Metres the body would travel per cycle of a clip played in place: how fast a foot slides back along `axis` while
 * its toes are on the ground (the median over stance samples), times the clip's length.
 */
export function measureStride(name: string, axis: Vector3): number {
  const rig = new GltfRig(model);
  const bones: Record<string, Bone> = {};
  rig.object3d.traverse((o) => { if ((o as Bone).isBone) bones[o.name] = o as Bone; });
  const clips = bindClips(model.clips, bones);
  const rest = restPose(bones);
  const clip = clips.find((c) => c.name === name)!;
  const n = 240;
  const dt = clip.duration / n;
  const samples: { toe: number; a: number }[] = [];
  for (let i = 0; i <= n; i++) {
    sampleClips(clips, [{ name, weight: 1, time: i * dt }], rest);
    rig.object3d.updateMatrixWorld(true);
    samples.push({ toe: new Vector3().setFromMatrixPosition(bones.toesl!.matrixWorld).y, a: new Vector3().setFromMatrixPosition(bones.footl!.matrixWorld).dot(axis) });
  }
  const low = Math.min(...samples.map((s) => s.toe));
  const speeds = samples.slice(1).flatMap((s, i) => (s.toe < low + 0.04 && samples[i]!.toe < low + 0.04 ? [(samples[i]!.a - s.a) / dt] : []));
  speeds.sort((x, y) => x - y);
  return speeds[Math.floor(speeds.length / 2)]! * clip.duration;
}

const AXES: Record<keyof typeof PLAYER_RIG.strides, Vector3> = {
  Running_A: new Vector3(0, 0, 1), Walking_A: new Vector3(0, 0, 1), Walking_Backwards: new Vector3(0, 0, -1),
};

describe('locomotion strides', () => {
  for (const [name, axis] of Object.entries(AXES)) {
    it(`${name}: the tuned stride is what the clip's feet do (within 10%)`, () => {
      const measured = measureStride(name, axis);
      console.log(name, measured.toFixed(3));
      expect(Math.abs(measured - PLAYER_RIG.strides[name as keyof typeof AXES]) / measured).toBeLessThan(0.1);
    });
  }
});
