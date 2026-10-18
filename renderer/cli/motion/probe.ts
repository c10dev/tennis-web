// The motion probe (ADR-031, M8 phase 0): the skinned rig sampled frame by frame, over replay time or through a
// decision hold as the viewer plays it (viewer.ts: the walk, the held stance, the release, the next point). Used by
// the continuity tests and `npm run motion`. Node only: it reads the committed glb from disk.
import { readFileSync } from 'node:fs';
import { Quaternion, Vector3 } from 'three';
import { averagePlayer, createConfig, SCHEMA_VERSION, simulateMatch, type PlayerId } from '@tennis/engine';
import { readGlb } from '../../src/asset/glb.ts';
import { matchFrameAt } from '../../src/playback/frame.ts';
import { enteredPlayers, heldPlayers, releasedPlayers, releaseSeconds, type TellStance } from '../../src/playback/hold.ts';
import type { PlayerPose } from '../../src/playback/pose.ts';
import { buildTimeline, type Timeline } from '../../src/playback/timeline.ts';
import { GltfRig } from '../../src/scene/gltfRig.ts';
import { boneName, buildPlayerModel, type PlayerModel } from '../../src/scene/playerModel.ts';
import { HOLD_ENTER_SEC, HOLD_STANCES, PLAYER_MODEL } from '../../src/tuning/index.ts';

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
  /** World positions of the joints an eye follows at TV size (JOINTS), and of the player's root. */
  joints: Record<string, Vector3>;
  root: Vector3;
  /** The racket head in the player's own frame (the run and the turn taken out). */
  racketLocal: Vector3;
}

/** Knees, ankles, elbows, hands, head and the racket head: what shows when a 41 px body pops. */
export const JOINTS = ['lowerlegl', 'lowerlegr', 'footl', 'footr', 'lowerarml', 'lowerarmr', 'handl', 'handr', 'head', 'racket-head'];

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
  const joints: Record<string, Vector3> = {};
  for (const n of JOINTS) joints[n] = at(n);
  return {
    ...frame, racket: joints['racket-head']!, freeHand: joints['handl']!, bones, joints, root: rig.object3d.position.clone(), racketLocal: rig.object3d.worldToLocal(joints['racket-head']!.clone()),
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
  // As the viewer: the hold's clock has run one frame when it is first drawn, and the stance eases in from the walk.
  const walked = matchFrameAt(before, end).players;
  const enterRef = heldPlayers(before, tell, 1 / fps);
  const held = (k: number) => enteredPlayers(walked, heldPlayers(before, tell, k / fps), k / fps / HOLD_ENTER_SEC, enterRef);
  const hold = Math.round(holdSec * fps);
  for (let k = 1; k <= hold; k++) frames.push({ t: end, pose: held(k)[id], phase: 'hold' });
  const from = held(hold);
  const start = after.segments[before.segments.length]!.start;
  const releaseRef = matchFrameAt(after, start + 1 / fps).players;
  let k = 0;
  for (let done = false; !done;) {
    const t = start + ++k / fps;
    const to = matchFrameAt(after, t).players;
    done = k / fps >= releaseSeconds(from, to);
    frames.push({ t, pose: releasedPlayers(from, to, k / fps, releaseRef)[id], phase: 'release' });
  }
  for (let j = 1; j <= Math.round(playSec * fps); j++) {
    const t = start + (k + j) / fps;
    frames.push({ t, pose: matchFrameAt(after, t).players[id], phase: 'play' });
  }
  return frames;
}

/**
 * A seven-point tiebreak (seed 2) as the quick match sees it point by point: after each of its first `count` points,
 * the match so far with the events that follow that point (a changeover after the sixth), as the live match hands
 * them over (engine `advance`), up to the next point.
 */
export function tiebreakSoFar(count = 8): Timeline[] {
  const TIEBREAK = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } as const;
  const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { ...TIEBREAK } });
  const events = simulateMatch(config, 2).events;
  const starts = events.map((e, i) => (e.type === 'point' ? i : -1)).filter((i) => i >= 0);
  return starts.slice(0, count).map((_, k) => buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: events.slice(0, starts[k + 1] ?? events.length) }));
}

/** No tell, then every tell stance (HOLD_STANCES), on B. */
export const ALL_TELLS: readonly (TellStance | null)[] = [null, ...(['attack', 'defend', 'counter'] as const).flatMap((card) => HOLD_STANCES[card].map((_, index) => ({ player: 'B' as const, card, index })))];
