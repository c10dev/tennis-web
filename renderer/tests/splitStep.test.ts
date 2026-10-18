// The split step (ADR-031 A4): a small hop that lands as the opponent strikes, feet wide and knees bent, so the player
// is ready to push off; none at a run. It used to peak at the opponent's contact as a lift of the whole body.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { CARRY, SPLIT_STEP } from '../src/tuning/index.ts';
import { positionAt } from '../src/playback/movement.ts';
import { loadPlayerModelFile } from '../cli/motion/probe.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'clay'));
// The opponent's contacts, for each player, while that player is near still.
const moments = tl.segments.slice(0, 40).flatMap((seg) => seg.point.shots.flatMap((s) => {
  const id = s.hitter === 'A' ? 'B' as const : 'A' as const;
  const c = seg.zero + s.t;
  const still = [c - SPLIT_STEP.hopSec, c, c + SPLIT_STEP.landSec].every((t) => playerPose(tl, id, t).speed < 0.8);
  return still ? [{ id, c }] : [];
}));

describe('the split step', () => {
  it('is found often enough to judge', () => expect(moments.length).toBeGreaterThan(30));

  it('hops before the opponent’s contact and lands on it', () => {
    for (const { id, c } of moments) {
      expect(playerPose(tl, id, c - SPLIT_STEP.hopSec - 0.02).splitStep).toBe(0);
      expect(playerPose(tl, id, c - SPLIT_STEP.hopSec / 2).splitStep).toBeGreaterThan(0.6);
      expect(playerPose(tl, id, c).splitStep).toBeLessThan(1e-9);
    }
  });

  it('lands wide and low: the feet spread in the air and come together after; the hips drop on landing', () => {
    for (const { id, c } of moments) {
      const land = playerPose(tl, id, c + SPLIT_STEP.landSec / 2).carry;
      expect(land.spread).toBeGreaterThan(SPLIT_STEP.spread * 0.6);
      expect(playerPose(tl, id, c).carry.spread).toBeCloseTo(SPLIT_STEP.spread, 6);
      expect(playerPose(tl, id, c + SPLIT_STEP.spreadOutSec + 0.02).carry.spread).toBe(0);
    }
  });

  it('puts the feet at least 0.5 m apart on the skinned rig as it lands', () => {
    const rig = new GltfRig(loadPlayerModelFile());
    const at = (n: string) => new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(n)!.matrixWorld);
    let wide = 0;
    for (const { id, c } of moments) {
      rig.apply(playerPose(tl, id, c + SPLIT_STEP.landSec / 2));
      rig.object3d.updateMatrixWorld(true);
      if (at('footl').distanceTo(at('footr')) >= 0.5) wide++;
    }
    expect(wide).toBeGreaterThan(moments.length * 0.9);
  });

  it('is skipped at a run', () => {
    // At the carry's averaged speed (±CARRY.speedWindowSec), as the pose reads it.
    const averaged = (id: 'A' | 'B', t: number) => {
      const w = CARRY.speedWindowSec;
      const [p, q] = [positionAt(tl, id, t - w), positionAt(tl, id, t + w)];
      return Math.hypot(q.x - p.x, q.y - p.y) / (2 * w);
    };
    let runs = 0;
    for (const seg of tl.segments) {
      for (const s of seg.point.shots) {
        const id = s.hitter === 'A' ? 'B' as const : 'A' as const;
        const t = seg.zero + s.t - SPLIT_STEP.hopSec / 2;
        if (averaged(id, t) < SPLIT_STEP.runFull) continue;
        runs++;
        expect(playerPose(tl, id, t).splitStep).toBe(0);
      }
    }
    expect(runs).toBeGreaterThan(0);
  });
});
