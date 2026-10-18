// The skinned player (ADR-024, vertical slice): the KayKit body at Pop proportions, toon-shaded with a skinned ink
// hull, a racket in the right hand, and locomotion clips sampled at replay time. Strokes (effector keys and IK) come
// from `PlayerPose.stroke`, solved over the clips (strokeSolver.ts). Same `PlayerRig` interface as the mannequin.
import {
  BufferGeometry, CircleGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, Object3D, Quaternion,
  TorusGeometry, Vector3, type Bone,
  type SkinnedMesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clamp, smoothstep } from '../math.ts';
import { withCarry } from '../playback/carry.ts';
import type { PlayerPose } from '../playback/pose.ts';
import { COLOURS, PLAYER_RIG, RIG } from '../tuning/index.ts';
import { groundToThree, yawFor } from './coords.ts';
import { lit, toonGradient } from './materials.ts';
import { bindClips, loopTime, restPose, sampleClips, type Layer, type SampledClip } from './clipSampler.ts';
import { addOutline, addSkinnedOutline } from './outline.ts';
import { kitTexture, type Kit } from './kit.ts';
import type { PlayerModel } from './playerModel.ts';
import type { PlayerRig } from './rig.ts';
import { solveStroke, type Bones } from './strokeSolver.ts';

type Clip = 'Idle' | 'Running_A' | 'Walking_A' | 'Walking_Backwards' | 'Cheer' | 'Hit_A';
const UP = new Vector3(0, 1, 0);

/** Angle of the run from the facing direction (radians, + towards the player's left), 0 when standing; by the same
 *  averaged velocity the clips blend by (`gaitVelocity`, A6). */
function moveAngle(pose: PlayerPose): number {
  const v = pose.gaitVelocity ?? pose.velocity;
  if (Math.hypot(v.x, v.y) < 1e-3) return 0;
  const a = Math.atan2(v.y, v.x) - Math.atan2(pose.facing.y, pose.facing.x);
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** A geometry with every vertex the colour `hex` (the racket is one vertex-coloured mesh: one draw, one hull). */
function painted(g: BufferGeometry, hex: number): BufferGeometry {
  const c = new Color(hex);
  const n = g.getAttribute('position').count;
  g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [c.r, c.g, c.b][i % 3]!), 3));
  return g;
}

function racket(): Group {
  const R = PLAYER_RIG.racket;
  const g = new Group();
  g.name = 'racket';
  // Handle and throat run from just below the grip to the head's rim; the light strings sit in a dark frame that
  // shows on every tier (B1). One mesh with one outline: the handle is outlined too, so the shaft reads at 41 px.
  const shaft = R.length - R.headRadius + 0.08;
  const handle = new CylinderGeometry(R.handleRadius, R.handleRadius * 1.15, shaft, 8).translate(0, shaft / 2 - 0.08, 0);
  const strings = new CylinderGeometry(R.headRadius, R.headRadius, 0.022, 16).rotateX(Math.PI / 2).scale(R.headAspect, 1, 1).translate(0, R.length, 0);
  const frame = new TorusGeometry(R.headRadius, R.frameTube, 6, 24).scale(R.headAspect, 1, 1).translate(0, R.length, 0);
  const material = lit(0xffffff).clone();
  material.vertexColors = true;
  const mesh = new Mesh(mergeGeometries([painted(handle, COLOURS.racket), painted(strings, COLOURS.strings), painted(frame, COLOURS.racket)]), material);
  mesh.name = 'racket-mesh';
  addOutline(mesh);
  // Named points for whoever needs the head's centre (the smear, the probes) or the handle's middle.
  const head = new Object3D();
  head.name = 'racket-head';
  head.position.y = R.length;
  const grip = new Object3D();
  grip.name = 'racket-handle';
  grip.position.y = shaft / 2 - 0.08;
  g.add(mesh, head, grip);
  return g;
}

interface Transform { position: Vector3; quaternion: Quaternion }

const HANDS = ['handr', 'handl'] as const;

/** `w` of the way from `a` to `b`, both taken on `side`'s hemisphere (normalised linear blend). */
function nlerp(a: Quaternion, b: Quaternion, w: number, side: Quaternion): Quaternion {
  const sa = a.dot(side) < 0 ? -1 : 1;
  const sb = b.dot(side) < 0 ? -1 : 1;
  return new Quaternion(a.x * sa * (1 - w) + b.x * sb * w, a.y * sa * (1 - w) + b.y * sb * w, a.z * sa * (1 - w) + b.z * sb * w, a.w * sa * (1 - w) + b.w * sb * w).normalize();
}

export class GltfRig implements PlayerRig {
  readonly object3d = new Group();
  private readonly clips: SampledClip[];
  private readonly restPose: Map<Bone, { quaternion: Quaternion; position: Vector3 }>;
  private readonly model: Object3D;
  private readonly shadow: Mesh;
  private readonly bones: Bones = {};
  private readonly slot: Object3D;
  /** Bind-pose offsets of the bones the solver slides (arm stretch); the clips never move them. */
  private readonly rest = new Map<Bone, Vector3>();
  /** The feet's bind-pose turn in the player's frame (soles flat). */
  private readonly flatFeet: Quaternion[];
  /** What a solve moves below the player: the body, its shadow and every bone (a crossfade mixes them). */
  private readonly moving: Object3D[] = [];

  /** `kit` recolours the garments (TD-062); without it the player wears the model's own palette. */
  constructor(model: PlayerModel, kit: Kit | null = null) {
    const body = clone(model.root) as Group;
    body.name = 'model';
    const skin = body.getObjectByName('body') as SkinnedMesh;
    const map = model.texture && kit ? kitTexture(model.texture, kit) : model.texture;
    skin.material = new MeshToonMaterial({ map, gradientMap: toonGradient() });
    skin.frustumCulled = false;
    addSkinnedOutline(skin);
    (body.getObjectByName('head') as Bone).scale.setScalar(PLAYER_RIG.headScale);
    this.slot = body.getObjectByName('handslotr')!;
    this.slot.add(racket());
    body.traverse((o) => { if ((o as Bone).isBone) this.bones[o.name] = o as Bone; });
    // Longer arms for a swing that shows on a 41 px body (ADR-031 B2): each bone slides out along its parent, as the
    // stretch does, so nothing shears.
    for (const name of ['lowerarml', 'wristl', 'handl', 'lowerarmr', 'wristr', 'handr']) this.bones[name]!.position.multiplyScalar(PLAYER_RIG.armScale);
    for (const name of ['lowerarmr', 'wristr', 'handr']) this.rest.set(this.bones[name]!, this.bones[name]!.position.clone());
    this.restPose = restPose(this.bones);
    // The feet's turn in the bind pose (standing, soles flat), in the player's frame: a planted foot lies flat (A5).
    this.object3d.updateMatrixWorld(true);
    const frame = this.object3d.getWorldQuaternion(new Quaternion()).invert();
    this.flatFeet = (['l', 'r'] as const).map((side) => frame.clone().multiply(this.bones[`foot${side}`]!.getWorldQuaternion(new Quaternion())));
    this.model = body;
    const shadow = this.shadow = new Mesh(new CircleGeometry(RIG.shadowRadius, 16), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.name = 'shadow';
    this.object3d.add(body, shadow);
    this.moving.push(body, shadow);
    body.traverse((o) => { if ((o as Bone).isBone) this.moving.push(o); });
    const used: Clip[] = ['Idle', 'Running_A', 'Walking_A', 'Walking_Backwards', 'Cheer', 'Hit_A'];
    for (const name of used) if (!model.clips.some((c) => c.name === name)) throw new Error(`player model lacks ${name}`);
    this.clips = bindClips(model.clips.filter((c) => (used as string[]).includes(c.name)), this.bones);
  }

  /** Clip layers for this pose, and how far the legs turn towards a sideways move (the chest keeps facing the ball). */
  private blended(pose: PlayerPose): { layers: Layer[]; legs: number } {
    const own = this.layers(pose);
    const forward = own[1]!.weight + own[2]!.weight;
    return { layers: own, legs: clamp(moveAngle(pose), -PLAYER_RIG.legTurnMax, PLAYER_RIG.legTurnMax) * forward };
  }

  /** Clip layers for this pose: idle at replay time, walk, run and backpedal at the phase distance sets, reactions
   * from the landing. */
  private layers(pose: PlayerPose): Layer[] {
    const G = PLAYER_RIG.gait;
    const S = PLAYER_RIG.strides;
    const clip = (name: Clip) => this.clips.find((c) => c.name === name);
    // Standing to stepping eases by the averaged speed (A5). Walk to run takes the higher of it and the speed itself: a
    // stride's phase runs with the metres covered, so a walk at run speed would cycle its legs far too fast (A6), while
    // a run slowing down is only a slow run.
    const speed = pose.gaitSpeed ?? pose.speed;
    const move = smoothstep((speed - G.moveFrom) / (G.moveFull - G.moveFrom));
    const run = smoothstep((Math.max(speed, pose.speed) - G.runFrom) / (G.runFull - G.runFrom));
    const back = smoothstep((Math.abs(moveAngle(pose)) - PLAYER_RIG.backFrom) / 0.4) * (1 - smoothstep((speed - G.backMax) / 0.5));
    const react = pose.reactionWeight;
    const rest = 1 - react;
    const forward = rest * move * (1 - back);
    return [
      { name: 'Idle', weight: rest * (1 - move), time: loopTime(clip('Idle'), pose.t / (clip('Idle')?.duration ?? 1)) },
      { name: 'Walking_A', weight: forward * (1 - run), time: loopTime(clip('Walking_A'), pose.distance / S.Walking_A) },
      { name: 'Running_A', weight: forward * run, time: loopTime(clip('Running_A'), pose.distance / S.Running_A) },
      { name: 'Walking_Backwards', weight: rest * move * back, time: loopTime(clip('Walking_Backwards'), pose.distance / S.Walking_Backwards) },
      { name: 'Cheer', weight: pose.reaction === 'celebrate' ? react : 0, time: pose.reactionT },
      { name: 'Hit_A', weight: pose.reaction === 'dejected' ? react : 0, time: pose.reactionT },
    ];
  }

  apply(pose: PlayerPose): void {
    if (!pose.crossfade || pose.crossfade.weight <= 0) {
      this.solve(pose);
      return;
    }
    // Eased from another pose (B3): solve that one, keep its bones, solve this one, mix. The target as the blend began
    // (`ref`) fixes which way round each turn goes, so it holds while this pose moves on.
    const cf = pose.crossfade;
    let ref: { bones: Transform[]; hands: Quaternion[] } | null = null;
    if (cf.ref) {
      this.solve(cf.ref);
      ref = { bones: this.capture(), hands: this.handTurns() };
    }
    this.apply(cf.from);
    const from = this.capture();
    const hands = this.handTurns();
    this.solve(pose);
    const own = this.handTurns();
    this.mix(from, cf.weight, ref?.bones);
    // The hands turn in the world, where both poses hold them much alike: their local turns differ by however the
    // forearms twist, half a turn at times, and mixed locally they flipped over (B3).
    this.object3d.updateMatrixWorld(true);
    HANDS.forEach((name, i) => {
      const bone = this.bones[name]!;
      const world = nlerp(own[i]!, hands[i]!, cf.weight, ref?.hands[i] ?? own[i]!);
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world));
    });
  }

  private handTurns(): Quaternion[] {
    this.object3d.updateMatrixWorld(true);
    return HANDS.map((name) => this.bones[name]!.getWorldQuaternion(new Quaternion()));
  }

  private solve(pose: PlayerPose): void {
    const hop = RIG.splitStepHop * pose.splitStep;
    this.object3d.position.copy(groundToThree(pose.pos, hop));
    // The whole turn, not just its y: a crossfade's slerp can leave the Euler angles at (π, y′, π) for the same turn.
    this.object3d.rotation.set(0, yawFor(pose.facing), 0);
    // Every bone is set from replay time alone, so any pose can be drawn without the ones before it.
    const { layers, legs } = this.blended(pose);
    sampleClips(this.clips, layers, this.restPose);
    // A sideways move turns the legs towards it while the chest keeps facing the ball.
    this.bones.hips!.quaternion.premultiply(new Quaternion().setFromAxisAngle(UP, legs));
    this.bones.spine!.quaternion.premultiply(new Quaternion().setFromAxisAngle(UP, -legs));
    this.model.position.set(0, 0, 0);
    // The stroke over the carried racket (ADR-031 A2): the arms follow keys whenever a stroke or the carry owns them.
    const stroke = withCarry(pose.stroke, pose.carry);
    if (stroke) solveStroke(this.object3d, this.model, this.bones, this.slot, stroke, this.rest, this.flatFeet);
    this.shadow.position.set(this.model.position.x, 0.004 - hop, this.model.position.z);
  }

  /** Every transform a solve sets below the player's own (whose place and turn the pose already eases). */
  private capture(): Transform[] {
    return this.moving.map((o) => ({ position: o.position.clone(), quaternion: o.quaternion.clone() }));
  }

  /** `w` of the way back to the captured transforms. Turns mix on the hemisphere of `ref`'s (the target as the blend
   *  began) or else the rest pose's, not by the shorter way: between two poses half a turn apart the shorter way
   *  changes side from frame to frame. */
  private mix(from: Transform[], w: number, ref?: Transform[]): void {
    this.moving.forEach((o, i) => {
      const f = from[i]!;
      o.position.lerp(f.position, w);
      const side = ref?.[i]!.quaternion ?? this.restPose.get(o as Bone)?.quaternion;
      if (side) o.quaternion.copy(nlerp(o.quaternion, f.quaternion, w, side));
      else o.quaternion.slerp(f.quaternion, w);
    });
  }



}
