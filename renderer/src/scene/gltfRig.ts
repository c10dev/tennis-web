// The skinned player (ADR-024, vertical slice): the KayKit body at Pop proportions, toon-shaded with a skinned ink
// hull, a racket in the right hand, and locomotion clips sampled at replay time. Strokes (effector keys and IK) come
// from `PlayerPose.stroke`, solved over the clips (strokeSolver.ts). Same `PlayerRig` interface as the mannequin.
import {
  CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, Quaternion, Vector3, type Bone, type Object3D,
  type SkinnedMesh,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clamp, smoothstep } from '../math.ts';
import type { PlayerPose } from '../playback/pose.ts';
import { COLOURS, PLAYER_RIG, RIG } from '../tuning/index.ts';
import { groundToThree, yawFor } from './coords.ts';
import { lit, toonGradient } from './materials.ts';
import { bindClips, loopTime, restPose, sampleClips, type Layer, type SampledClip } from './clipSampler.ts';
import { addOutline, addSkinnedOutline } from './outline.ts';
import type { PlayerModel } from './playerModel.ts';
import type { PlayerRig } from './rig.ts';
import { solveStroke, type Bones } from './strokeSolver.ts';

type Clip = 'Idle' | 'Running_A' | 'Walking_A' | 'Walking_Backwards' | 'Cheer' | 'Hit_A';
const UP = new Vector3(0, 1, 0);

/** Angle of the run from the facing direction (radians, + towards the player's left), 0 when standing. */
function moveAngle(pose: PlayerPose): number {
  if (pose.speed < 1e-3) return 0;
  const a = Math.atan2(pose.velocity.y, pose.velocity.x) - Math.atan2(pose.facing.y, pose.facing.x);
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function racket(): Group {
  const R = PLAYER_RIG.racket;
  const g = new Group();
  g.name = 'racket';
  // Handle and throat run from just below the grip to the head's rim.
  const shaft = R.length - R.headRadius + 0.08;
  const handle = new Mesh(new CylinderGeometry(0.02, 0.024, shaft, 6), lit(COLOURS.racket));
  handle.position.y = shaft / 2 - 0.08;
  const head = new Mesh(new CylinderGeometry(R.headRadius, R.headRadius, 0.022, 16), lit(COLOURS.strings));
  head.name = 'racket-head';
  head.rotation.x = Math.PI / 2;
  head.scale.set(R.headAspect, 1, 1);
  head.position.y = R.length;
  addOutline(head);
  g.add(handle, head);
  return g;
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

  constructor(model: PlayerModel) {
    const body = clone(model.root) as Group;
    body.name = 'model';
    const skin = body.getObjectByName('body') as SkinnedMesh;
    skin.material = new MeshToonMaterial({ map: model.texture, gradientMap: toonGradient() });
    skin.frustumCulled = false;
    addSkinnedOutline(skin);
    (body.getObjectByName('head') as Bone).scale.setScalar(PLAYER_RIG.headScale);
    this.slot = body.getObjectByName('handslotr')!;
    this.slot.add(racket());
    body.traverse((o) => { if ((o as Bone).isBone) this.bones[o.name] = o as Bone; });
    for (const name of ['lowerarmr', 'wristr', 'handr']) this.rest.set(this.bones[name]!, this.bones[name]!.position.clone());
    this.restPose = restPose(this.bones);
    this.model = body;
    const shadow = this.shadow = new Mesh(new CircleGeometry(RIG.shadowRadius, 16), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.name = 'shadow';
    this.object3d.add(body, shadow);
    const used: Clip[] = ['Idle', 'Running_A', 'Walking_A', 'Walking_Backwards', 'Cheer', 'Hit_A'];
    for (const name of used) if (!model.clips.some((c) => c.name === name)) throw new Error(`player model lacks ${name}`);
    this.clips = bindClips(model.clips.filter((c) => (used as string[]).includes(c.name)), this.bones);
  }

  /** Clip layers for this pose: idle at replay time, walk, run and backpedal at the phase distance sets, reactions
   * from the landing. */
  private layers(pose: PlayerPose): Layer[] {
    const G = PLAYER_RIG.gait;
    const S = PLAYER_RIG.strides;
    const clip = (name: Clip) => this.clips.find((c) => c.name === name);
    const move = smoothstep((pose.speed - G.moveFrom) / (G.moveFull - G.moveFrom));
    const run = smoothstep((pose.speed - G.runFrom) / (G.runFull - G.runFrom));
    const back = smoothstep((Math.abs(moveAngle(pose)) - PLAYER_RIG.backFrom) / 0.4) * (1 - smoothstep((pose.speed - G.backMax) / 0.5));
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
    const hop = RIG.splitStepHop * pose.splitStep;
    this.object3d.position.copy(groundToThree(pose.pos, hop));
    this.object3d.rotation.y = yawFor(pose.facing);
    // Every bone is set from replay time alone, so any pose can be drawn without the ones before it.
    const layers = this.layers(pose);
    sampleClips(this.clips, layers, this.restPose);
    // A sideways move turns the legs towards it while the chest keeps facing the ball.
    const forward = layers[1]!.weight + layers[2]!.weight;
    const legs = clamp(moveAngle(pose), -PLAYER_RIG.legTurnMax, PLAYER_RIG.legTurnMax) * forward;
    this.bones.hips!.quaternion.premultiply(new Quaternion().setFromAxisAngle(UP, legs));
    this.bones.spine!.quaternion.premultiply(new Quaternion().setFromAxisAngle(UP, -legs));
    this.model.position.set(0, 0, 0);
    if (pose.stroke) solveStroke(this.object3d, this.model, this.bones, this.slot, pose.stroke, this.rest);
    this.shadow.position.set(this.model.position.x, 0.004 - hop, this.model.position.z);
  }
}
