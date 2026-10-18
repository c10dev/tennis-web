// The motion probe (ADR-031, M8 phase 0): the skinned rig sampled frame by frame, over replay time or through a
// decision hold as the viewer plays it (viewer.ts: the walk, the held stance, the release, the next point). Used by
// the continuity tests and `npm run motion`. Node only: it reads the committed glb from disk.
import { readFileSync } from 'node:fs';
import { Quaternion, Vector3 } from 'three';
import type { PlayerId } from '@tennis/engine';
import { readGlb } from '../../src/asset/glb.ts';
import { matchFrameAt } from '../../src/playback/frame.ts';
import { heldPlayers, releasedPlayers, type TellStance } from '../../src/playback/hold.ts';
import type { PlayerPose } from '../../src/playback/pose.ts';
import type { Timeline } from '../../src/playback/timeline.ts';
import { GltfRig } from '../../src/scene/gltfRig.ts';
import { boneName, buildPlayerModel, type PlayerModel } from '../../src/scene/playerModel.ts';
import { HOLD_RELEASE_SEC, PLAYER_MODEL } from '../../src/tuning/index.ts';

export const FPS = 60;
export type Phase = 'play' | 'walk' | 'hold' | 'release';
export interface Frame { t: number; pose: PlayerPose; phase: Phase }

export interface Sample extends Frame {
  /** World positions (Three coordinates). */
  racket: Vector3;
  freeHand: Vector3;
  feet: { l: Vector3; r: Vector3; toesL: Vector3; toesR: Vector3 };
  /** Local rotations of the deform bones, and `(root)`: the whole player's turn. */
  bones: Record<string, Quaternion>;
}

export const loadPlayerModelFile = (): PlayerModel =>
  buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../../ui/public/models/player.glb', import.meta.url)))));

const DEFORM = PLAYER_MODEL.deformBones.map(boneName);

/** Poses `rig` and returns where its parts are. */
export function measure(rig: GltfRig, frame: Frame): Sample {
  rig.apply(frame.pose);
  rig.object3d.updateMatrixWorld(true);
  const at = (n: string) => new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(n)!.matrixWorld);
  const bones: Record<string, Quaternion> = { '(root)': rig.object3d.quaternion.clone() };
  for (const n of DEFORM) bones[n] = rig.object3d.getObjectByName(n)!.quaternion.clone();
  return {
    ...frame, racket: at('racket-head'), freeHand: at('handl'), bones,
    feet: { l: at('footl'), r: at('footr'), toesL: at('toesl'), toesR: at('toesr') },
  };
}

export function sampleFrames(model: PlayerModel, frames: Iterable<Frame>): Sample[] {
  const rig = new GltfRig(model);
  return Array.from(frames, (f) => measure(rig, f));
}

/** One player from `from` to `to` replay seconds (end excluded), as the match plays. */
export function* timelineFrames(tl: Timeline, id: PlayerId, from: number, to: number, fps = FPS): Generator<Frame> {
  const n = Math.round((to - from) * fps);
  for (let k = 0; k < n; k++) {
    const t = from + k / fps;
    yield { t, pose: matchFrameAt(tl, t).players[id], phase: 'play' };
  }
}

/**
 * A decision hold as the viewer draws it: `walkSec` of the walk into it (the match so far, `before`), `holdSec` held
 * with `tell`, the release while the decision point (`after`, the match with it) starts from its toss, then `playSec`
 * of that point.
 */
export function holdFrames(before: Timeline, after: Timeline, id: PlayerId, tell: TellStance | null, { walkSec = 1, holdSec = 2, playSec = 1, fps = FPS } = {}): Frame[] {
  const frames: Frame[] = [];
  const end = before.segments.at(-1)!.next;
  for (let k = Math.round(walkSec * fps); k >= 0; k--) frames.push({ t: end - k / fps, pose: matchFrameAt(before, end - k / fps).players[id], phase: 'walk' });
  const hold = Math.round(holdSec * fps);
  for (let k = 0; k < hold; k++) frames.push({ t: end, pose: heldPlayers(before, tell, k / fps)[id], phase: 'hold' });
  const from = heldPlayers(before, tell, (hold - 1) / fps);
  const start = after.segments[before.segments.length]!.start;
  const release = Math.round(HOLD_RELEASE_SEC * fps);
  for (let k = 1; k <= release; k++) {
    const t = start + k / fps;
    frames.push({ t, pose: releasedPlayers(from, matchFrameAt(after, t).players, k / release)[id], phase: 'release' });
  }
  for (let k = 1; k <= Math.round(playSec * fps); k++) {
    const t = start + (release + k) / fps;
    frames.push({ t, pose: matchFrameAt(after, t).players[id], phase: 'play' });
  }
  return frames;
}
