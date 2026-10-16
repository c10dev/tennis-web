import { describe, expect, it } from 'vitest';
import { Vector3, type Object3D } from 'three';
import type { PlayerPose } from '../src/playback/pose.ts';
import { MannequinRig } from '../src/scene/rig.ts';
import { RIG } from '../src/tuning/index.ts';

const pose = (o: Partial<PlayerPose> = {}): PlayerPose => ({
  pos: { x: 1, y: -11 }, facing: { x: 0, y: 1 }, speed: 0, swing: null, reaction: 'none', reactionWeight: 1,
  gait: { phase: 0, amount: 0 }, crouch: 0, splitStep: 0, toss: 0, t: 0, stroke: null, velocity: { x: 0, y: 0 }, distance: 0, reactionT: -1, ...o,
});
const world = (o: Object3D) => {
  o.updateWorldMatrix(true, false);
  return new Vector3().setFromMatrixPosition(o.matrixWorld);
};
const head = (rig: MannequinRig) => world(rig.object3d.getObjectByName('racket-head')!);
const y = (rig: MannequinRig, name: string) => world(rig.object3d.getObjectByName(name)!).y;

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
    // Facing −z (the far end): behind is +z relative to the player at z = 11. A swing eases out of the rest position
    // first, so the backswing is furthest back once that ease is done.
    const back = RIG.swingEase;
    expect(at('forehand', back).z).toBeGreaterThan(11);
    expect(at('forehand', 0.5).z).toBeLessThan(11);
    expect(at('forehand', 0.5).x).toBeGreaterThan(1);
    expect(at('backhand', back).x).toBeLessThan(1);
    expect(at('backhand', 0.5).z).toBeLessThan(11);
  });

  it('aims the racket head at the contact point through the middle of a swing (ADR-023)', () => {
    const rig = new MannequinRig(0xff0000);
    // Player at (1, −11) facing the far end: the ball 0.7 m to their right, 0.25 m in front, knee high.
    const contact = { x: 1.7, y: -10.75, z: 0.55 };
    rig.apply(pose({ swing: { kind: 'forehand', phase: 0.5, contact } }));
    expect(head(rig).distanceTo(new Vector3(1.7, 0.55, 10.75))).toBeLessThan(0.02);
    rig.apply(pose({ swing: { kind: 'forehand', phase: RIG.swingEase, contact } }));
    expect(head(rig).z).toBeGreaterThan(11);
  });

  it('lunges sideways for a stretched ball, its shadow going with it', () => {
    const rig = new MannequinRig(0xff0000);
    const contact = { x: 2.9, y: -10.9, z: 0.8 };
    rig.apply(pose({ swing: { kind: 'forehand', phase: 0.5, contact } }));
    expect(head(rig).distanceTo(new Vector3(2.9, 0.8, 10.9))).toBeLessThan(0.05);
    const hips = world(rig.object3d.getObjectByName('hips')!);
    expect(hips.x).toBeGreaterThan(1.3);
    expect(world(rig.object3d.getObjectByName('shadow')!).x).toBeCloseTo(hips.x, 9);
    rig.apply(pose());
    expect(world(rig.object3d.getObjectByName('shadow')!).x).toBeCloseTo(1, 9);
  });

  it('jumps into the serve so the racket reaches a toss struck at 2.9 m', () => {
    const rig = new MannequinRig(0xff0000);
    const contact = { x: 1, y: -10.7, z: 2.9 };
    rig.apply(pose({ swing: { kind: 'serve', phase: 0.5, contact } }));
    expect(head(rig).distanceTo(new Vector3(1, 2.9, 10.7))).toBeLessThan(0.15);
    expect(y(rig, 'foot-left')).toBeGreaterThan(0.2);
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
