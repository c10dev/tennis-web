import { describe, expect, it } from 'vitest';
import { Box3, CapsuleGeometry, Vector3, type Mesh, type MeshToonMaterial, type Object3D } from 'three';
import type { PlayerPose } from '../src/playback/pose.ts';
import { MannequinRig } from '../src/scene/rig.ts';
import { RIG } from '../src/tuning/index.ts';

const pose = (o: Partial<PlayerPose> = {}): PlayerPose => ({
  pos: { x: 1, y: -11 }, facing: { x: 0, y: 1 }, speed: 0, swing: null, reaction: 'none',
  gait: { phase: 0, amount: 0 }, crouch: 0, splitStep: 0, toss: 0, ...o,
});
const world = (o: Object3D) => {
  o.updateWorldMatrix(true, false);
  return new Vector3().setFromMatrixPosition(o.matrixWorld);
};
const head = (rig: MannequinRig) => world(rig.object3d.getObjectByName('racket-head')!);

describe('MannequinRig', () => {
  it('stands on the ground at the pose position, about 1.85 m tall', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose());
    expect(rig.object3d.position.toArray()).toEqual([1, 0, 11]);
    const top = world(rig.object3d.getObjectByName('head')!).y;
    expect(top).toBeGreaterThan(1.6);
    expect(top).toBeLessThan(1.8);
  });

  it('turns to face where the pose faces', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose({ facing: { x: 1, y: 0 } }));
    const nose = world(rig.object3d.getObjectByName('visor')!);
    expect(nose.x).toBeGreaterThan(1);
    rig.apply(pose({ facing: { x: 0, y: 1 } }));
    expect(world(rig.object3d.getObjectByName('visor')!).z).toBeLessThan(11);
  });

  it('holds the racket in the right hand: on +x when facing the far end from the near end', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose());
    expect(head(rig).x).toBeGreaterThan(1.2);
  });

  it('sweeps the racket from behind to in front through a forehand, and the other way round for a backhand', () => {
    const rig = new MannequinRig(0xff0000);
    const at = (kind: 'forehand' | 'backhand', phase: number) => {
      rig.apply(pose({ swing: { kind, phase } }));
      return head(rig);
    };
    // Facing −z (the far end): behind is +z relative to the player at z = 11.
    expect(at('forehand', 0).z).toBeGreaterThan(11);
    expect(at('forehand', 0.5).z).toBeLessThan(11);
    expect(at('forehand', 0.5).x).toBeGreaterThan(1);
    expect(at('backhand', 0).x).toBeLessThan(1);
    expect(at('backhand', 0.5).z).toBeLessThan(11);
  });

  it('reaches up above the head at serve contact', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose({ swing: { kind: 'serve', phase: 0.5 } }));
    expect(head(rig).y).toBeGreaterThan(2.2);
    rig.apply(pose({ swing: { kind: 'serve', phase: 0 } }));
    expect(head(rig).y).toBeLessThan(1.5);
  });

  it('raises the racket to celebrate, slumps when dejected, leans into a run', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose({ reaction: 'celebrate' }));
    expect(head(rig).y).toBeGreaterThan(2);
    const torso = rig.object3d.getObjectByName('torso')!;
    rig.apply(pose({ reaction: 'dejected' }));
    const slump = torso.rotation.x;
    rig.apply(pose({ speed: 7 }));
    const run = torso.rotation.x;
    rig.apply(pose());
    expect(torso.rotation.x).toBe(0);
    expect(slump).toBeGreaterThan(0.1);
    expect(run).toBeGreaterThan(0.1);
  });

  const y = (rig: MannequinRig, name: string) => world(rig.object3d.getObjectByName(name)!).y;

  it('swings its legs in opposition while running, and stands straight when still', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose({ gait: { phase: Math.PI / 2, amount: 1 } }));
    const left = rig.object3d.getObjectByName('leg-left')!.rotation.x;
    const right = rig.object3d.getObjectByName('leg-right')!.rotation.x;
    expect(Math.abs(left)).toBeGreaterThan(0.3);
    expect(right).toBeCloseTo(-left, 9);
    rig.apply(pose());
    expect(rig.object3d.getObjectByName('leg-left')!.rotation.x).toBe(0);
  });

  it('drops its hips into a crouch and lifts off the ground in a split step', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose());
    const standing = y(rig, 'hips');
    rig.apply(pose({ crouch: 1 }));
    expect(y(rig, 'hips')).toBeLessThan(standing - 0.1);
    rig.apply(pose({ splitStep: 1 }));
    expect(y(rig, 'hips')).toBeGreaterThan(standing + 0.05);
    expect(y(rig, 'foot-left')).toBeGreaterThan(0.05);
  });

  it('keeps its feet on the ground when standing', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose());
    expect(y(rig, 'foot-left')).toBeCloseTo(0, 1);
    expect(y(rig, 'foot-right')).toBeCloseTo(0, 1);
  });

  it('lifts the left hand above the head to toss', () => {
    const rig = new MannequinRig(0xff0000);
    rig.apply(pose({ toss: 1, swing: { kind: 'serve', phase: 0.2 } }));
    expect(y(rig, 'left-hand')).toBeGreaterThan(y(rig, 'head'));
    rig.apply(pose());
    expect(y(rig, 'left-hand')).toBeLessThan(1.2);
  });
});

describe('MannequinRig, Rally Pop phase 3 (ADR-022)', () => {
  const rig = new MannequinRig(0x1f6fd6);
  rig.apply(pose());
  const mesh = (name: string) => rig.object3d.getObjectByName(name) as Mesh;
  const box = (name: string) => {
    rig.object3d.updateWorldMatrix(true, true);
    return new Box3().setFromObject(mesh(name), true);
  };

  it('grips the racket in a right hand at the end of the arm', () => {
    const shoulder = world(rig.object3d.getObjectByName('arm-pivot-right')!);
    const hand = world(mesh('right-hand'));
    expect(hand.distanceTo(shoulder)).toBeCloseTo(RIG.armLength, 2);
    expect(hand.distanceTo(world(mesh('handle')))).toBeCloseTo(RIG.handleLength / 2, 1);
    expect(RIG.hand.radius).toBeGreaterThan(RIG.armRadius);
  });

  it('has rounded arms and limbs with the segment counts in tuning', () => {
    for (const name of ['arm-right', 'arm-left', 'thigh-left', 'shin-right', 'body']) {
      const g = mesh(name).geometry;
      expect(g, name).toBeInstanceOf(CapsuleGeometry);
      expect((g as CapsuleGeometry).parameters.radialSegments, name).toBe(RIG.segments.radial);
    }
    expect(RIG.segments.radial).toBeGreaterThanOrEqual(12);
  });

  it('stands in chunky shoes: soles on the ground, toes forward', () => {
    for (const side of ['left', 'right']) {
      const b = box(`foot-${side}`);
      const size = b.getSize(new Vector3());
      expect(size.z).toBeGreaterThanOrEqual(RIG.shoe.length - 1e-6);
      expect(size.x).toBeGreaterThanOrEqual(RIG.shoe.width - 1e-6);
      expect(size.y).toBeGreaterThanOrEqual(RIG.shoe.height - 1e-6);
      expect(Math.abs(b.min.y)).toBeLessThan(0.01);
      // Facing the far end (−z) from z = 11: the toe reaches further forward than the heel goes back.
      const ankle = world(rig.object3d.getObjectByName(`leg-${side}`)!).z;
      expect(ankle - b.min.z).toBeGreaterThan(b.max.z - ankle);
    }
    expect(RIG.shoe.length).toBeGreaterThan(0.24);
    expect(RIG.shoe.height).toBeGreaterThan(0.06);
  });

  it('wears a cap in the kit colour above the visor', () => {
    const cap = mesh('cap');
    expect((cap.material as MeshToonMaterial).color.getHex()).toBe(0x1f6fd6);
    expect(world(cap).y).toBeGreaterThan(world(mesh('head')).y);
    expect(box('cap').max.y).toBeGreaterThan(box('head').max.y);
    expect(box('cap').max.y).toBeLessThan(2);
  });
});
