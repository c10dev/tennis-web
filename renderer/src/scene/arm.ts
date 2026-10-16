// The mannequin's arms. The racket arm bends at the elbow and is posed by aiming the racket-head centre at a target
// with two-bone IK; swings are paths of that target (ADR-023). Local −x is out to the right of the shoulder.
import { CapsuleGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { clamp, lerp, smoothstep } from '../math.ts';
import type { SwingKind } from '../playback/pose.ts';
import { COLOURS, RIG } from '../tuning/index.ts';
import { solveTwoBone } from './ik.ts';
import { lit } from './materials.ts';
import { hand } from './rigParts.ts';

/** Racket direction as M3 set it: a roll (down +, up −) then a yaw sweep (0 = out to the right, + towards the front). */
export interface Angles { yaw: number; roll: number }

const OUT = new Vector3(-1, 0, 0);
const POLE = new Vector3(RIG.elbowPole.x, RIG.elbowPole.y, RIG.elbowPole.z);
const HEAD_OFFSET = RIG.racketHeadRadius * 1.3;
/** Elbow to racket-head centre: forearm, handle and half the oval head, held in line. */
const LOWER = RIG.forearm + RIG.handleLength + HEAD_OFFSET;
/** Shoulder to racket-head centre with the arm straight. */
export const REACH = RIG.upperArm + LOWER;

/** Unit vector a straight arm points along for M3's angles, in the shoulder's parent space. */
export function direction({ yaw, roll }: Angles): Vector3 {
  return new Vector3(-Math.cos(roll) * Math.cos(yaw), -Math.sin(roll), Math.cos(roll) * Math.sin(yaw));
}

/** Where the racket-head centre is at full reach for these angles, from the shoulder. */
export const atReach = (a: Angles): Vector3 => direction(a).multiplyScalar(REACH);

export function swingAngles(kind: SwingKind, phase: number): Angles {
  if (kind === 'serve') {
    const s = RIG.serve;
    // Up from the hip to full stretch at contact, then across the body and down.
    if (phase <= 0.5) return { yaw: 0, roll: lerp(s.rollFrom, s.rollContact, phase / 0.5) };
    const u = (phase - 0.5) / 0.5;
    return { yaw: lerp(0, s.yawEnd, u), roll: lerp(s.rollContact, s.rollEnd, u) };
  }
  const w = RIG[kind];
  return { yaw: lerp(w.from, w.to, phase), roll: w.roll };
}

/** The swing's racket target at `phase`, easing out of `rest` at the start and back into it at the end. */
export function swingTarget(kind: SwingKind, phase: number, rest: Vector3): Vector3 {
  const e = RIG.swingEase;
  const k = phase < e ? smoothstep(phase / e) : phase > 1 - e ? smoothstep((1 - phase) / e) : 1;
  return rest.clone().lerp(atReach(swingAngles(kind, phase)), k);
}

/** How strongly a swing at `phase` is pulled onto its contact point: 1 at contact, 0 outside `RIG.contactBlend`. */
export const contactWeight = (phase: number): number => smoothstep(1 - Math.abs(phase - 0.5) / RIG.contactBlend);

/** The swing's path moved so it passes through `contact` (from the shoulder, torso axes) at phase 0.5 (ADR-023). */
export function aimedTarget(kind: SwingKind, phase: number, rest: Vector3, contact: Vector3): Vector3 {
  const target = swingTarget(kind, phase, rest);
  const w = contactWeight(phase);
  return w > 0 ? target.addScaledVector(contact.clone().sub(atReach(swingAngles(kind, 0.5))), w) : target;
}

/**
 * How a groundstroke meets a contact point given in the rig's frame: a sideways torso lean (radians about the hips,
 * + tips the shoulders to the left) within `RIG.contactLeanMax`, then a sideways lunge of the hips (metres, + to the
 * left) within `RIG.lungeMax`, so the racket shoulder ends up `RIG.contactReach` from the ball.
 */
export function contactShift(contact: Vector3): { lean: number; lunge: number } {
  const sx = -RIG.shoulderOffset;
  const sy = RIG.shoulderHeight;
  const root = Math.sqrt(Math.max(0, RIG.contactReach ** 2 - (contact.y - sy) ** 2 - contact.z ** 2));
  // Of the two shoulder spots at that reach, the one nearer where the shoulder already is.
  const x = Math.abs(contact.x - root - sx) < Math.abs(contact.x + root - sx) ? contact.x - root : contact.x + root;
  const most = sy * Math.sin(RIG.contactLeanMax);
  const leanX = clamp(x - sx, -most, most);
  return { lean: Math.asin(-leanX / sy), lunge: clamp(x - sx - leanX, -RIG.lungeMax, RIG.lungeMax) };
}

/** A mesh laid along −x (out to the right of its pivot) from `start` for `length`; +x with `sign` 1. */
function along(mesh: Mesh, start: number, length: number, sign = -1): Mesh {
  mesh.rotation.z = Math.PI / 2;
  mesh.position.x = sign * (start + length / 2);
  return mesh;
}

/** A rounded arm segment (Rally Pop phase 3, ADR-028): a capsule of the mean of the two radii. */
const limb = (name: string, r0: number, r1: number, length: number, start = 0, sign = -1): Mesh => {
  const r = (r0 + r1) / 2;
  const capsule = new CapsuleGeometry(r, Math.max(0, length - 2 * r), RIG.segments.cap, RIG.segments.radial);
  const mesh = along(new Mesh(capsule, lit(COLOURS.skin)), start, length, sign);
  mesh.name = name;
  return mesh;
};

/** Shoulder (the group to place on the torso), upper arm, elbow, forearm, handle and racket head. */
export class RacketArm {
  readonly shoulder = new Group();
  private readonly elbow = new Group();

  constructor() {
    const r = RIG.armRadius;
    this.shoulder.name = 'shoulder-right';
    this.elbow.name = 'elbow-right';
    this.elbow.position.x = -RIG.upperArm;
    const joint = new Mesh(new SphereGeometry(r * 0.95, 8, 6), lit(COLOURS.skin));
    const handle = along(new Mesh(new CylinderGeometry(RIG.handleRadius, RIG.handleRadius, RIG.handleLength, 6), lit(COLOURS.racket)), RIG.forearm, RIG.handleLength);
    const head = new Mesh(new CylinderGeometry(RIG.racketHeadRadius, RIG.racketHeadRadius, 0.02, 14), lit(COLOURS.strings));
    head.rotation.x = Math.PI / 2;
    head.scale.set(1.3, 1, 1);
    head.position.x = -LOWER;
    head.name = 'racket-head';
    handle.name = 'handle';
    // The mitten hand at the wrist grips the handle (Rally Pop phase 3, ADR-028).
    this.elbow.add(joint, limb('forearm-right', r * 0.95, r * 0.85, RIG.forearm), hand('right-hand', -RIG.forearm), handle, head);
    this.shoulder.add(limb('arm-right', r, r * 0.95, RIG.upperArm), this.elbow);
  }

  /** Bends the arm so the racket-head centre reaches `target`, given from the shoulder in the torso's axes. */
  reach(target: Vector3): void {
    const { elbow, end } = solveTwoBone(target, RIG.upperArm, LOWER, POLE);
    const up = elbow.clone().normalize();
    this.shoulder.rotation.set(0, Math.atan2(up.z, -up.x), -Math.asin(clamp(up.y, -1, 1)));
    const fore = end.sub(elbow).normalize().applyQuaternion(this.shoulder.quaternion.clone().invert());
    this.elbow.quaternion.setFromUnitVectors(OUT, fore);
  }
}

/** The free arm along the pivot's +x (out to the left), ending in the hand that tosses. */
export function leftArmParts(): Mesh[] {
  const arm = limb('arm-left', RIG.armRadius, RIG.armRadius * 0.9, RIG.armLength, 0, 1);
  return [arm, hand('left-hand', RIG.armLength)];
}
