// Solves a stroke's effector targets onto the skinned bones (ADR-024, D2), after the clips have posed them: hips and
// chest turn, crouch and hop, legs back onto the clip's feet, A1's two-bone IK for both arms, and the hand turned so
// the racket points along its target. Near contact the racket head is bent onto the engine's contact point; what the
// arm cannot reach is taken by arm stretch, then extra crouch, then a shift of the whole body (A1's lunge, TD-058).
import { Matrix4, Quaternion, Vector3, type Bone, type Object3D } from 'three';
import { clamp, smoothstep } from '../math.ts';
import type { StrokePose } from '../playback/stroke.ts';
import { PLAYER_RIG } from '../tuning/index.ts';
import { solveTwoBone } from './ik.ts';

export type Bones = Record<string, Bone>;
const UP = new Vector3(0, 1, 0);
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const ARM_POLE = { r: new Vector3(-0.3, -1, -0.4), l: new Vector3(0.3, -1, -0.4) };
const LEG_POLE = new Vector3(0, 0.3, 1);

const worldPos = (o: Object3D) => new Vector3().setFromMatrixPosition(o.matrixWorld);
const worldQuat = (o: Object3D) => o.getWorldQuaternion(new Quaternion());

/** Turn `bone` (weight w) so its +y points at `target` (world), keeping the clip's twist. */
function aim(bone: Bone, target: Vector3, w: number): void {
  bone.updateWorldMatrix(true, false);
  const parentQ = worldQuat(bone.parent!).invert();
  const want = target.clone().sub(worldPos(bone)).normalize().applyQuaternion(parentQ);
  const now = Y.clone().applyQuaternion(bone.quaternion);
  const q = new Quaternion().setFromUnitVectors(now, want).multiply(bone.quaternion);
  bone.quaternion.slerp(q, w);
}

/** Set `bone`'s world rotation to `q` (weight w). */
function orient(bone: Bone, q: Quaternion, w: number): void {
  bone.updateWorldMatrix(true, false);
  const local = worldQuat(bone.parent!).invert().multiply(q);
  bone.quaternion.slerp(local, w);
}

/** Two-bone chain root → mid → end (each child along its parent's +y) reaching `target`, bent towards `pole`. */
function limb(root: Bone, mid: Bone, end: Bone, target: Vector3, pole: Vector3, w: number): void {
  root.updateWorldMatrix(true, true);
  const origin = worldPos(root);
  const upper = mid.position.length();
  const lower = end.parent === mid ? end.position.length() : worldPos(end).distanceTo(worldPos(mid));
  const { elbow, end: reach } = solveTwoBone(target.clone().sub(origin), upper, lower, pole);
  aim(root, elbow.add(origin), w);
  aim(mid, reach.add(origin), w);
}

/** The racket's direction and face in hand space (from the hand slot) and its centre's offset from the hand. */
export function racketInHand(slot: Object3D): { axis: Vector3; normal: Vector3; centre: Vector3 } {
  const axis = Y.clone().applyQuaternion(slot.quaternion);
  const normal = new Vector3(0, 0, 1).applyQuaternion(slot.quaternion);
  return { axis, normal, centre: slot.position.clone().addScaledVector(axis, PLAYER_RIG.racket.length) };
}

/** World rotation of the hand that points the racket along `dir` with its strings facing `face`'s side. */
function handRotation(slot: Object3D, dir: Vector3, forward: Vector3): Quaternion {
  const { axis, normal } = racketInHand(slot);
  let face = UP.clone().cross(dir);
  if (face.lengthSq() < 0.04) face = forward.clone();
  if (face.dot(forward) < 0) face.negate();
  face.addScaledVector(dir, -face.dot(dir)).normalize();
  const want = new Matrix4().makeBasis(dir, face, dir.clone().cross(face));
  const have = new Matrix4().makeBasis(axis, normal, axis.clone().cross(normal));
  return new Quaternion().setFromRotationMatrix(want.multiply(have.transpose()));
}

interface Rest { quats: Map<Bone, Quaternion>; positions: Map<Bone, Vector3>; hips: Vector3 }

/**
 * One solve at a given whole-body shift and extra crouch; returns how far the racket head still is from the contact
 * point (world).
 */
function pass(frame: Object3D, model: Object3D, b: Bones, slot: Object3D, s: StrokePose, rest: Rest, feet: { p: Vector3; q: Quaternion }[], shift: Vector3, extraDrop: number): Vector3 {
  const w = s.weight;
  const e = s.keys;
  for (const [bone, q] of rest.quats) bone.quaternion.copy(q);
  for (const [bone, p] of rest.positions) bone.position.copy(p);
  model.position.copy(shift);
  b.hips!.position.copy(rest.hips).add(new Vector3(0, (s.hop - e.drop - extraDrop) * w, 0));
  b.hips!.quaternion.premultiply(new Quaternion().setFromAxisAngle(UP, e.pelvis * w));
  const half = (e.turn - e.pelvis) * w * 0.5;
  for (const name of ['spine', 'chest']) {
    b[name]!.quaternion.premultiply(new Quaternion().setFromAxisAngle(X, e.lean * w * 0.5)).premultiply(new Quaternion().setFromAxisAngle(UP, half));
  }
  frame.updateMatrixWorld(true);
  const shiftWorld = shift.clone().applyQuaternion(worldQuat(frame));
  // A lunge (TD-058): the foot on the side the body shifts to steps out with it, lifted through the move (the shift
  // grows and shrinks with the contact weight, so the step peaks halfway); the other foot stays planted.
  const root = worldPos(frame);
  const reachOut = (side: 'l' | 'r') => (s.plant[side].x - root.x) * shiftWorld.x + (-s.plant[side].y - root.z) * shiftWorld.z;
  const lead = shiftWorld.lengthSq() > 1e-8 ? (reachOut('l') >= reachOut('r') ? 'l' : 'r') : null;
  const P = PLAYER_RIG.step;
  (['l', 'r'] as const).forEach((side, i) => {
    // The clip's foot (moved with the body), drawn onto the planted spot.
    const target = feet[i]!.p.clone().add(shiftWorld);
    const plant = s.plant[side];
    const stepOut = side === lead ? shiftWorld : new Vector3();
    target.x += (plant.x + stepOut.x - target.x) * s.plant.weight;
    target.z += (-plant.y + stepOut.z - target.z) * s.plant.weight;
    target.y += s.hop * w;
    const lungeLength = Math.hypot(s.lunge.x, s.lunge.z);
    if (side === lead) target.y += Math.min(P.liftMax, P.liftPerMetre * lungeLength) * Math.sin(Math.PI * s.contactWeight) * s.plant.weight;
    const hip = worldPos(b[`upperleg${side}`]!);
    const legLength = b[`lowerleg${side}`]!.position.length() + b[`foot${side}`]!.position.length() - 0.01;
    const flat = new Vector3(target.x - hip.x, 0, target.z - hip.z);
    // A leg that still cannot reach is drawn in, lifted as it goes (a step, not a drag).
    const excess = flat.length() - Math.sqrt(Math.max(0, legLength ** 2 - (target.y - hip.y) ** 2));
    if (excess > 0) target.y += P.dragLift * smoothstep(excess / P.dragLiftOver);
    const room = Math.sqrt(Math.max(0, legLength ** 2 - (target.y - hip.y) ** 2));
    if (flat.length() > room) target.set(hip.x, target.y, hip.z).add(flat.setLength(room));
    const pole = LEG_POLE.clone().applyQuaternion(worldQuat(frame));
    limb(b[`upperleg${side}`]!, b[`lowerleg${side}`]!, b[`foot${side}`]!, target, pole, 1);
    orient(b[`foot${side}`]!, feet[i]!.q, 1);
  });

  // Racket arm: the keyed hand and racket, bent onto the contact point near contact.
  const toWorld = (v: { x: number; y: number; z: number }) => frame.localToWorld(new Vector3(v.x, v.y, v.z));
  const forward = new Vector3(0, 0, 1).applyQuaternion(worldQuat(frame));
  const shoulder = worldPos(b.upperarmr!);
  const contact = toWorld(s.contact);
  const keyDir = toWorld(e.dir).sub(toWorld({ x: 0, y: 0, z: 0 })).normalize();
  const cw = s.contactWeight;
  const dir = keyDir.clone().lerp(contact.clone().sub(shoulder).normalize(), cw).normalize();
  const hand = handRotation(slot, dir, forward);
  const centre = racketInHand(slot).centre.applyQuaternion(hand);
  const handTarget = toWorld(e.hand).lerp(contact.clone().sub(centre), cw);
  const reach = b.lowerarmr!.position.length() + b.wristr!.position.length() + b.handr!.position.length();
  const stretch = clamp(handTarget.distanceTo(shoulder) / reach, 1, 1 + PLAYER_RIG.stretchMax * cw);
  for (const name of ['lowerarmr', 'wristr', 'handr']) b[name]!.position.multiplyScalar(1 + (stretch - 1) * w);
  b.wristr!.quaternion.slerp(new Quaternion(), w);
  limb(b.upperarmr!, b.lowerarmr!, b.handr!, handTarget, ARM_POLE.r.clone().applyQuaternion(worldQuat(frame)), w);
  orient(b.handr!, hand, w);
  // Free arm.
  b.wristl!.quaternion.slerp(new Quaternion(), w);
  limb(b.upperarml!, b.lowerarml!, b.handl!, toWorld(e.free), ARM_POLE.l.clone().applyQuaternion(worldQuat(frame)), w);
  frame.updateMatrixWorld(true);
  const racket = slot.localToWorld(new Vector3(0, PLAYER_RIG.racket.length, 0));
  return contact.sub(racket);
}

/** Pose the bones for `stroke` on top of the clip pose already on them; `model` is the body group inside `frame`. */
export function solveStroke(frame: Object3D, model: Object3D, bones: Bones, slot: Object3D, stroke: StrokePose, restPositions: Map<Bone, Vector3>): void {
  frame.updateMatrixWorld(true);
  const quats = new Map<Bone, Quaternion>();
  for (const bone of Object.values(bones)) quats.set(bone, bone.quaternion.clone());
  const rest: Rest = { quats, positions: restPositions, hips: bones.hips!.position.clone() };
  const feet = (['l', 'r'] as const).map((side) => ({ p: worldPos(bones[`foot${side}`]!), q: worldQuat(bones[`foot${side}`]!) }));
  const inverse = worldQuat(frame).invert();
  // The lunge is planned (a function of time, so the stepping foot moves smoothly); what is left low is crouched to.
  const shift = new Vector3(stroke.lunge.x, 0, stroke.lunge.z).multiplyScalar(stroke.contactWeight);
  let drop = 0;
  for (let i = 0; i < 3; i++) {
    const miss = pass(frame, model, bones, slot, stroke, rest, feet, shift, drop);
    // A serve reaches its toss by the hop rule alone: no extra crouch.
    if (stroke.kind === 'serve' || stroke.contactWeight === 0 || miss.length() < 0.005) return;
    const local = miss.applyQuaternion(inverse);
    drop = clamp(drop - local.y * stroke.contactWeight, 0, PLAYER_RIG.dropMax);
  }
}
