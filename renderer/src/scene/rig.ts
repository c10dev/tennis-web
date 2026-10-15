// Player rigs: anything that can draw a PlayerPose. MannequinRig is M3's low-poly figure built from primitives;
// a skinned GLTF rig can replace it behind the same interface without touching playback (ADR-007, ADR-009).
import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, CylinderGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, SphereGeometry,
  type Object3D, type Vector3,
} from 'three';
import { lerp } from '../math.ts';
import type { PlayerPose } from '../playback/pose.ts';
import { COLOURS, LOOK, RIG } from '../tuning/index.ts';
import { aimedTarget, atReach, contactWeight, leftArmParts, RacketArm, contactShift, swingTarget } from './arm.ts';
import { groundToThree, toThree, yawFor } from './coords.ts';
import { lit } from './materials.ts';
import { addOutline } from './outline.ts';

export interface PlayerRig {
  readonly object3d: Object3D;
  apply(pose: PlayerPose): void;
}

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
  private readonly arm = new RacketArm();
  private readonly leftArm = new Group();
  private readonly legs: { thigh: Group; shin: Group }[] = [];
  private readonly shadow = new Mesh(new CircleGeometry(RIG.shadowRadius, 16), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.28 }));

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
    const brim = RIG.headRadius * 0.75;
    const visor = new Mesh(new CylinderGeometry(brim, brim, 0.025, 10, 1, false, -Math.PI / 2, Math.PI), lit(COLOURS.visor));
    visor.position.set(0, headY + RIG.headRadius * 0.3, RIG.headRadius * 0.8);
    visor.name = 'visor';
    this.arm.shoulder.position.set(-RIG.shoulderOffset, RIG.shoulderHeight, 0);
    this.leftArm.position.set(RIG.shoulderOffset, RIG.shoulderHeight, 0);
    this.leftArm.add(...leftArmParts());
    this.torso.add(body, head, visor, this.arm.shoulder, this.leftArm);
    for (const side of ['left', 'right'] as const) this.hips.add(this.leg(side));
    this.hips.add(this.torso);
    const shadow = this.shadow;
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.name = 'shadow';
    this.object3d.add(this.hips, shadow);
    const parts: readonly string[] = LOOK.outline.rigParts;
    const outlined: Mesh[] = [];
    this.object3d.traverse((o) => { if (o instanceof Mesh && parts.includes(o.name)) outlined.push(o); });
    outlined.forEach(addOutline);
  }

  /** A world point in the frame at the end of `chain` (from the rig root down), whatever the rig's parent is. */
  private inFrame(point: Vector3, chain: Object3D[]): Vector3 {
    const m = new Matrix4();
    for (const o of chain) {
      o.updateMatrix();
      m.multiply(o.matrix);
    }
    return point.applyMatrix4(m.invert());
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
    const serveJump = pose.swing?.kind === 'serve' && pose.swing.contact ? RIG.serveJump * contactWeight(pose.swing.phase) : 0;
    this.hips.position.y = legLength * Math.cos(alpha) + RIG.splitStepHop * pose.splitStep + serveJump;
    const stride = RIG.gaitSwing * pose.gait.amount * Math.sin(pose.gait.phase);
    const knee = RIG.gaitKnee * pose.gait.amount;
    this.legs.forEach(({ thigh, shin }, i) => {
      const swing = i === 0 ? stride : -stride;
      thigh.rotation.x = swing - alpha;
      shin.rotation.x = 2 * alpha + knee * Math.max(0, -Math.sin(pose.gait.phase + i * Math.PI));
    });
    let lean = (RIG.runLean * Math.min(pose.speed, RIG.runLeanSpeed)) / RIG.runLeanSpeed;
    // Between swings the racket rests, or eases up into a celebration; a swing leaves from and returns to that rest.
    let rest = atReach(RIG.idle);
    if (pose.reaction === 'celebrate') rest = rest.lerp(atReach(RIG.celebrate), pose.reactionWeight);
    else if (pose.reaction === 'dejected') lean = lerp(lean, RIG.dejectedLean, pose.reactionWeight);
    const swing = pose.swing;
    this.hips.position.x = 0;
    let side = 0;
    if (swing?.contact && swing.kind !== 'serve') {
      const w = contactWeight(swing.phase);
      const shift = contactShift(this.inFrame(toThree(swing.contact), [this.object3d, this.hips]));
      side = w * shift.lean;
      this.hips.position.x = w * shift.lunge;
    }
    this.shadow.position.x = this.hips.position.x;
    this.torso.rotation.set(lean, 0, side);
    if (!swing) this.arm.reach(rest);
    else if (!swing.contact) this.arm.reach(swingTarget(swing.kind, swing.phase, rest));
    else {
      const contact = this.inFrame(toThree(swing.contact), [this.object3d, this.hips, this.torso]).sub(this.arm.shoulder.position);
      this.arm.reach(aimedTarget(swing.kind, swing.phase, rest, contact));
    }
    this.leftArm.rotation.set(0, RIG.leftArm.forward, lerp(RIG.leftArm.down, RIG.leftArm.up, pose.toss));
  }
}
