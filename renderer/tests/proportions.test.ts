import { describe, expect, it } from 'vitest';
import { Box3, Vector3, type Mesh } from 'three';
import type { PlayerPose } from '../src/playback/pose.ts';
import { MannequinRig } from '../src/scene/rig.ts';
import { RIG } from '../src/tuning/index.ts';

const pose = (o: Partial<PlayerPose> = {}): PlayerPose => ({
  pos: { x: 0, y: -11 }, facing: { x: 0, y: 1 }, speed: 0, swing: null, reaction: 'none',
  gait: { phase: 0, amount: 0 }, crouch: 0, splitStep: 0, toss: 0, ...o,
});
const top = (rig: MannequinRig, name: string) => {
  rig.object3d.updateWorldMatrix(true, true);
  return new Box3().setFromObject(rig.object3d.getObjectByName(name) as Mesh, true).max.y;
};

describe('Rally Pop proportions (ADR-018)', () => {
  const rig = new MannequinRig(0x1f6fd6);
  rig.apply(pose());
  const height = top(rig, 'head');

  it('is chunky: a big head on shorter legs, still about 1.85 m tall', () => {
    expect(height).toBeGreaterThan(1.8);
    expect(height).toBeLessThan(2);
    // A real adult's head is about an eighth of their height; the toy figure's is closer to a fifth.
    expect((2 * RIG.headRadius) / height).toBeGreaterThan(0.17);
    expect(2 * RIG.legSegment).toBeLessThan(0.9);
  });

  it('carries an oversized racket head that still reaches a serve struck at 2.6 m and up', () => {
    expect(RIG.racketHeadRadius).toBeGreaterThanOrEqual(0.17);
    rig.apply(pose({ swing: { kind: 'serve', phase: 0.5 } }));
    expect(top(rig, 'racket-head')).toBeGreaterThan(2.6);
  });

  it('scales the cap visor with the head', () => {
    rig.apply(pose());
    const visor = rig.object3d.getObjectByName('visor') as Mesh;
    const width = new Box3().setFromObject(visor).getSize(new Vector3()).x;
    expect(width).toBeGreaterThan(1.4 * RIG.headRadius);
  });
});
