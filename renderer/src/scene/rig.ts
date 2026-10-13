// Player rigs: anything that can draw a PlayerPose. CapsuleRig is M2's primitive figure; M3 can swap in a skinned
// GLTF rig behind the same interface without touching playback (ADR-007).
import {
  CapsuleGeometry, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, type Object3D,
} from 'three';
import type { PlayerPose } from '../playback/pose.ts';
import { COLOURS, RIG } from '../tuning.ts';
import { groundToThree, yawFor } from './coords.ts';

export interface PlayerRig {
  readonly object3d: Object3D;
  apply(pose: PlayerPose): void;
}

const lambert = (color: number) => new MeshLambertMaterial({ color });
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * Capsule body, sphere head with a cap visor (it shows which way the player faces) and a racket in the right hand.
 * Local +z is the front and −x the player's right. The racket hangs off a shoulder pivot: roll lifts it, yaw sweeps it.
 */
export class CapsuleRig implements PlayerRig {
  readonly object3d = new Group();
  private readonly torso = new Group();
  private readonly arm = new Group();

  constructor(shirt: number) {
    const body = new Mesh(new CapsuleGeometry(RIG.bodyRadius, RIG.bodyLength, 4, 10), lambert(shirt));
    body.position.y = RIG.bodyRadius + RIG.bodyLength / 2;
    const headY = RIG.bodyRadius * 2 + RIG.bodyLength + RIG.headRadius * 0.8;
    const head = new Mesh(new SphereGeometry(RIG.headRadius, 12, 8), lambert(COLOURS.skin));
    head.position.y = headY;
    head.name = 'head';
    const visor = new Mesh(new CylinderGeometry(0.09, 0.09, 0.02, 10, 1, false, -Math.PI / 2, Math.PI), lambert(COLOURS.visor));
    visor.position.set(0, headY + 0.04, RIG.headRadius * 0.8);
    visor.name = 'visor';
    this.torso.name = 'torso';
    this.torso.add(body, head, visor, this.arm);
    this.arm.position.set(-RIG.shoulderOffset, RIG.shoulderHeight, 0);
    this.arm.add(...racketParts());
    const shadow = new Mesh(new CircleGeometry(RIG.shadowRadius, 16), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.name = 'shadow';
    this.object3d.add(this.torso, shadow);
  }

  apply(pose: PlayerPose): void {
    this.object3d.position.copy(groundToThree(pose.pos));
    this.object3d.rotation.y = yawFor(pose.facing);
    let lean = (RIG.runLean * Math.min(pose.speed, RIG.runLeanSpeed)) / RIG.runLeanSpeed;
    let racket: Angles = RIG.idle;
    if (pose.swing) racket = swingAngles(pose.swing.kind, pose.swing.phase);
    else if (pose.reaction === 'celebrate') racket = RIG.celebrate;
    else if (pose.reaction === 'dejected') lean = RIG.dejectedLean;
    this.torso.rotation.x = lean;
    this.arm.rotation.set(0, racket.yaw, racket.roll);
  }
}

interface Angles { yaw: number; roll: number }

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

/** Arm, handle and an oval head laid out along the pivot's −x (out to the right). */
function racketParts(): Mesh[] {
  const along = (mesh: Mesh, start: number, length: number) => {
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = -(start + length / 2);
    return mesh;
  };
  const arm = along(new Mesh(new CylinderGeometry(0.045, 0.04, RIG.armLength, 6), lambert(COLOURS.skin)), 0, RIG.armLength);
  const handle = along(new Mesh(new CylinderGeometry(0.016, 0.016, RIG.handleLength, 6), lambert(COLOURS.racket)), RIG.armLength, RIG.handleLength);
  const head = new Mesh(new CylinderGeometry(RIG.racketHeadRadius, RIG.racketHeadRadius, 0.02, 14), lambert(COLOURS.racket));
  head.rotation.x = Math.PI / 2;
  head.scale.set(1.3, 1, 1);
  head.position.x = -(RIG.armLength + RIG.handleLength + RIG.racketHeadRadius * 1.3);
  head.name = 'racket-head';
  return [arm, handle, head];
}
