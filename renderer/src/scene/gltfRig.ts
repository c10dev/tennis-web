// The skinned player (ADR-024, vertical slice): the KayKit body at Pop proportions, toon-shaded with a skinned ink
// hull, a racket in the right hand, and locomotion clips sampled at replay time. Strokes (effector keys and IK) come
// in slice step 2; until then the arms follow the clips. Same `PlayerRig` interface as the mannequin (ADR-007).
import {
  AnimationMixer, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, type AnimationAction, type Bone,
  type SkinnedMesh,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { smoothstep } from '../math.ts';
import type { PlayerPose } from '../playback/pose.ts';
import { COLOURS, PLAYER_RIG, RIG, RIG_MOTION } from '../tuning/index.ts';
import { groundToThree, yawFor } from './coords.ts';
import { lit, toonGradient } from './materials.ts';
import { addOutline, addSkinnedOutline } from './outline.ts';
import type { PlayerModel } from './playerModel.ts';
import type { PlayerRig } from './rig.ts';

type Clip = 'Idle' | 'Running_A' | 'Cheer' | 'Hit_A';

function racket(): Group {
  const R = PLAYER_RIG.racket;
  const g = new Group();
  g.name = 'racket';
  const handle = new Mesh(new CylinderGeometry(0.016, 0.018, R.handle, 6), lit(COLOURS.racket));
  handle.position.y = R.handle / 2 - 0.06;
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
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<Clip, AnimationAction>();

  constructor(model: PlayerModel) {
    const body = clone(model.root) as Group;
    body.name = 'model';
    const skin = body.getObjectByName('body') as SkinnedMesh;
    skin.material = new MeshToonMaterial({ map: model.texture, gradientMap: toonGradient() });
    skin.frustumCulled = false;
    addSkinnedOutline(skin);
    (body.getObjectByName('head') as Bone).scale.setScalar(PLAYER_RIG.headScale);
    body.getObjectByName('handslotr')!.add(racket());
    const shadow = new Mesh(new CircleGeometry(RIG.shadowRadius, 16), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.name = 'shadow';
    this.object3d.add(body, shadow);
    this.mixer = new AnimationMixer(body);
    for (const name of ['Idle', 'Running_A', 'Cheer', 'Hit_A'] as const) {
      const clip = model.clips.find((c) => c.name === name);
      if (!clip) throw new Error(`player model lacks ${name}`);
      const action = this.mixer.clipAction(clip);
      action.play();
      this.actions.set(name, action);
    }
  }

  apply(pose: PlayerPose): void {
    this.object3d.position.copy(groundToThree(pose.pos));
    this.object3d.rotation.y = yawFor(pose.facing);
    const run = smoothstep(Math.min(1, pose.speed / RIG_MOTION.fullRunSpeed));
    const react = pose.reactionWeight;
    const rest = 1 - react;
    const weights: Record<Clip, number> = {
      Idle: rest * (1 - run),
      Running_A: rest * run,
      Cheer: pose.reaction === 'celebrate' ? react : 0,
      Hit_A: pose.reaction === 'dejected' ? react : 0,
    };
    for (const [name, action] of this.actions) action.setEffectiveWeight(weights[name]);
    // Every action's time is set from replay time alone, so any pose can be drawn without the ones before it.
    this.mixer.setTime(pose.t);
  }
}
