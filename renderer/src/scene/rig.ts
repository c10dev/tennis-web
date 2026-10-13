// Player rigs: anything that can draw a PlayerPose. MannequinRig is M3's low-poly figure built from primitives;
// a skinned GLTF rig can replace it behind the same interface without touching playback (ADR-007, ADR-009).
import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry,
  type Object3D,
} from 'three';
import { lerp } from '../math.ts';
import type { PlayerPose } from '../playback/pose.ts';
import { COLOURS, LOOK, RIG } from '../tuning/index.ts';
import { groundToThree, yawFor } from './coords.ts';
import { lit } from './materials.ts';
import { addOutline } from './outline.ts';

export interface PlayerRig {
  readonly object3d: Object3D;
  apply(pose: PlayerPose): void;
}

interface Angles { yaw: number; roll: number }

/** A capsule `length` long hanging down from its group's origin. */
function limb(name: string, radius: number, length: number, colour: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, length - 2 * radius, 3, 8), lit(colour));
  mesh.position.y = -length / 2;
  mesh.name = name;
  return mesh;
}

/**
 * Hips carry the legs and the torso; the torso carries head, cap visor (it shows which way the player faces), the
 * racket arm (right) and the tossing arm (left). Local +z is the front and −x the player's right.
 */
export class MannequinRig implements PlayerRig {
  readonly object3d = new Group();
  private readonly hips = new Group();
  private readonly torso = new Group();
  private readonly arm = new Group();
  private readonly leftArm = new Group();
  private readonly legs: { thigh: Group; shin: Group }[] = [];

  constructor(shirt: number) {
    this.hips.name = 'hips';
    this.torso.name = 'torso';
    const body = new Mesh(new CapsuleGeometry(RIG.torsoRadius, RIG.torsoLength, 4, 10), lit(shirt));
    body.position.y = RIG.torsoRadius + RIG.torsoLength / 2;
    body.name = 'body';
    const headY = RIG.torsoLength + 2 * RIG.torsoRadius + RIG.headRadius * 0.6;
    const head = new Mesh(new SphereGeometry(RIG.headRadius, 12, 8), lit(COLOURS.skin));
    head.position.y = headY;
    head.name = 'head';
    const visor = new Mesh(new CylinderGeometry(0.09, 0.09, 0.02, 10, 1, false, -Math.PI / 2, Math.PI), lit(COLOURS.visor));
    visor.position.set(0, headY + 0.04, RIG.headRadius * 0.8);
    visor.name = 'visor';
    this.arm.position.set(-RIG.shoulderOffset, RIG.shoulderHeight, 0);
    this.arm.add(...racketParts());
    this.leftArm.position.set(RIG.shoulderOffset, RIG.shoulderHeight, 0);
    this.leftArm.add(...leftArmParts());
    this.torso.add(body, head, visor, this.arm, this.leftArm);
    for (const side of ['left', 'right'] as const) this.hips.add(this.leg(side));
    this.hips.add(this.torso);
    const shadow = new Mesh(new CircleGeometry(RIG.shadowRadius, 16), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.name = 'shadow';
    this.object3d.add(this.hips, shadow);
    const parts: readonly string[] = LOOK.outline.rigParts;
    const outlined: Mesh[] = [];
    this.object3d.traverse((o) => { if (o instanceof Mesh && parts.includes(o.name)) outlined.push(o); });
    outlined.forEach(addOutline);
  }

  private leg(side: 'left' | 'right'): Group {
    const thigh = new Group();
    thigh.name = `leg-${side}`;
    thigh.position.x = (side === 'left' ? 1 : -1) * RIG.hipHalfWidth;
    thigh.add(limb(`thigh-${side}`, RIG.legRadius + 0.01, RIG.legSegment, COLOURS.shorts));
    const shin = new Group();
    shin.position.y = -RIG.legSegment;
    shin.add(limb(`shin-${side}`, RIG.legRadius, RIG.legSegment, COLOURS.skin));
    const foot = new Mesh(new BoxGeometry(0.1, 0.06, 0.24), lit(COLOURS.shoes));
    foot.position.set(0, -RIG.legSegment + 0.03, 0.05);
    foot.name = `foot-${side}`;
    shin.add(foot);
    thigh.add(shin);
    this.legs.push({ thigh, shin });
    return thigh;
  }

  apply(pose: PlayerPose): void {
    this.object3d.position.copy(groundToThree(pose.pos));
    this.object3d.rotation.y = yawFor(pose.facing);
    // Crouch: knees forward by α and shins back by 2α keep the feet on the ground as the hips drop.
    const legLength = 2 * RIG.legSegment;
    const alpha = Math.acos((legLength - RIG.crouchDrop * pose.crouch) / legLength);
    this.hips.position.y = legLength * Math.cos(alpha) + RIG.splitStepHop * pose.splitStep;
    const stride = RIG.gaitSwing * pose.gait.amount * Math.sin(pose.gait.phase);
    const knee = RIG.gaitKnee * pose.gait.amount;
    this.legs.forEach(({ thigh, shin }, i) => {
      const swing = i === 0 ? stride : -stride;
      thigh.rotation.x = swing - alpha;
      shin.rotation.x = 2 * alpha + knee * Math.max(0, -Math.sin(pose.gait.phase + i * Math.PI));
    });
    let lean = (RIG.runLean * Math.min(pose.speed, RIG.runLeanSpeed)) / RIG.runLeanSpeed;
    let racket: Angles = RIG.idle;
    if (pose.swing) racket = swingAngles(pose.swing.kind, pose.swing.phase);
    else if (pose.reaction === 'celebrate') racket = RIG.celebrate;
    else if (pose.reaction === 'dejected') lean = RIG.dejectedLean;
    this.torso.rotation.x = lean;
    this.arm.rotation.set(0, racket.yaw, racket.roll);
    this.leftArm.rotation.set(0, RIG.leftArm.forward, lerp(RIG.leftArm.down, RIG.leftArm.up, pose.toss));
  }
}

function swingAngles(kind: 'serve' | 'forehand' | 'backhand', phase: number): Angles {
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

/** A mesh laid along −x (out to the right of the shoulder) from `start` for `length`. */
function along(mesh: Mesh, start: number, length: number, sign = -1): Mesh {
  mesh.rotation.z = Math.PI / 2;
  mesh.position.x = sign * (start + length / 2);
  return mesh;
}

/** Arm, handle and an oval head laid out along the pivot's −x (out to the right). */
function racketParts(): Mesh[] {
  const arm = along(new Mesh(new CylinderGeometry(0.045, 0.04, RIG.armLength, 6), lit(COLOURS.skin)), 0, RIG.armLength);
  arm.name = 'arm-right';
  const handle = along(new Mesh(new CylinderGeometry(0.016, 0.016, RIG.handleLength, 6), lit(COLOURS.racket)), RIG.armLength, RIG.handleLength);
  const head = new Mesh(new CylinderGeometry(RIG.racketHeadRadius, RIG.racketHeadRadius, 0.02, 14), lit(COLOURS.racket));
  head.rotation.x = Math.PI / 2;
  head.scale.set(1.3, 1, 1);
  head.position.x = -(RIG.armLength + RIG.handleLength + RIG.racketHeadRadius * 1.3);
  head.name = 'racket-head';
  return [arm, handle, head];
}

/** The free arm along the pivot's +x (out to the left), ending in the hand that tosses. */
function leftArmParts(): Mesh[] {
  const arm = along(new Mesh(new CylinderGeometry(0.045, 0.04, RIG.armLength, 6), lit(COLOURS.skin)), 0, RIG.armLength, 1);
  arm.name = 'arm-left';
  const hand = new Mesh(new SphereGeometry(0.05, 8, 6), lit(COLOURS.skin));
  hand.position.x = RIG.armLength;
  hand.name = 'left-hand';
  return [arm, hand];
}
