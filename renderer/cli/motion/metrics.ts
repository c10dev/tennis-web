// What the motion probe's samples say (ADR-031): per-frame steps of the racket and every bone, the ground slip of feet
// by what the body is doing, the racket's carry height between strokes, and the serve toss against the free hand.
import type { Quaternion } from 'three';
import type { PlayerId } from '@tennis/engine';
import { matchFrameAt } from '../../src/playback/frame.ts';
import type { Timeline } from '../../src/playback/timeline.ts';
import { toThree } from '../../src/scene/coords.ts';
import { GltfRig } from '../../src/scene/gltfRig.ts';
import type { PlayerModel } from '../../src/scene/playerModel.ts';
import { BALL, PLAYBACK } from '../../src/tuning/index.ts';
import type { TellStance } from '../../src/playback/hold.ts';
import { FPS, holdFrames, measure, sampleFrames, type Phase, type Sample } from './probe.ts';

export interface Step {
  t: number; from: Phase; to: Phase;
  /** Metres the racket head moved, in the world and in the player's frame; whether a stroke or a reaction owned the
   *  body in either frame. */
  racket: number; racketLocal: number; stroke: boolean; reaction: boolean;
  /** Radians each bone turned (local; `(root)` the player's facing). */
  bones: Record<string, number>;
  /** Metres each joint moved in the world, and relative to the player's root (the run taken out). */
  joints: Record<string, number>; jointsRel: Record<string, number>;
}

/** Radians between two rotations: the angle of a⁻¹b, by atan2 (acos loses small angles near 1). */
function turn(a: Quaternion, b: Quaternion): number {
  const d = a.clone().invert().multiply(b);
  return 2 * Math.atan2(Math.hypot(d.x, d.y, d.z), Math.abs(d.w));
}

export function frameSteps(s: readonly Sample[]): Step[] {
  const out: Step[] = [];
  for (let i = 1; i < s.length; i++) {
    const [a, b] = [s[i - 1]!, s[i]!];
    const bones: Record<string, number> = {};
    for (const n of Object.keys(b.bones)) bones[n] = turn(a.bones[n]!, b.bones[n]!);
    const joints: Record<string, number> = {};
    const jointsRel: Record<string, number> = {};
    const moved = b.root.clone().sub(a.root);
    for (const n of Object.keys(b.joints)) {
      joints[n] = a.joints[n]!.distanceTo(b.joints[n]!);
      jointsRel[n] = b.joints[n]!.clone().sub(a.joints[n]!).sub(moved).length();
    }
    const stroke = !!(a.pose.stroke?.weight || b.pose.stroke?.weight);
    const reaction = a.pose.reactionWeight > 0 || b.pose.reactionWeight > 0;
    out.push({ t: b.t, from: a.phase, to: b.phase, racket: a.racket.distanceTo(b.racket), racketLocal: a.racketLocal.distanceTo(b.racketLocal), stroke, reaction, bones, joints, jointsRel });
  }
  return out;
}

export type SlipKind = 'run' | 'walk' | 'idle' | 'planted' | 'plant-ramp' | 'stroke' | 'reaction' | 'hold';

/** Ground slip per frame of each foot whose toes are on the ground (within 5 cm) in both frames, by what the body does. */
export function footSlips(s: readonly Sample[]): { kind: SlipKind; d: number }[] {
  const out: { kind: SlipKind; d: number }[] = [];
  for (let i = 1; i < s.length; i++) {
    const [a, b] = [s[i - 1]!, s[i]!];
    const p = b.pose;
    const w = p.stroke?.plant.weight ?? 0;
    const kind: SlipKind = b.phase === 'hold' ? 'hold' : p.reactionWeight > 0 ? 'reaction'
      : p.stroke ? (w > 0.99 ? 'planted' : w > 0 ? 'plant-ramp' : 'stroke')
      : p.speed > 3 ? 'run' : p.speed > 0.6 ? 'walk' : 'idle';
    for (const [foot, toes] of [['l', 'toesL'], ['r', 'toesR']] as const) {
      if (a.feet[toes].y > 0.05 || b.feet[toes].y > 0.05) continue;
      out.push({ kind, d: Math.hypot(b.feet[foot].x - a.feet[foot].x, b.feet[foot].z - a.feet[foot].z) });
    }
  }
  return out;
}

/** Racket-head height (metres) in frames where no stroke, reaction or hold owns the body. */
export const carryHeights = (s: readonly Sample[]): number[] =>
  s.filter((x) => x.phase !== 'hold' && !(x.pose.stroke && x.pose.stroke.weight > 0) && x.pose.reactionWeight === 0).map((x) => x.racket.y);

/** Free hand to ball (metres) one frame into each of `id`'s serve tosses before `until` replay seconds, and one frame
 *  before the ball leaves the hand (BALL.toss.releaseShare). */
export function tossGaps(model: PlayerModel, tl: Timeline, id: PlayerId, until: number): number[] {
  const rig = new GltfRig(model);
  const out: number[] = [];
  for (const seg of tl.segments) {
    for (const s of seg.point.shots) {
      const toss = seg.zero + s.t - PLAYBACK.tossLeadSec;
      if (s.hitter !== id || s.shot !== 'serve' || toss >= until) continue;
      for (const t of [toss + 1 / FPS, toss + BALL.toss.releaseShare * PLAYBACK.tossLeadSec - 1 / FPS]) {
        const frame = matchFrameAt(tl, t);
        if (!frame.ball) continue;
        out.push(measure(rig, { t, pose: frame.players[id], phase: 'play' }).freeHand.distanceTo(toThree(frame.ball)));
      }
    }
  }
  return out;
}

/** The largest of a record's values, over `only` keys if given. */
export const largest = (r: Record<string, number>, only?: readonly string[]): number =>
  Math.max(...Object.entries(r).filter(([n]) => !only || only.includes(n)).map(([, v]) => v));

export const quantile = (a: readonly number[], p: number): number => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]! : NaN;

export interface HoldSteps { entering: Step[]; leaving: Step[]; own: Step[] }

/**
 * Each decision hold between consecutive timelines of `sofar`, for each player and each of `tells`: the steps into the
 * hold, the steps of the release (and into play), and beside each of those the step the next timeline itself takes at
 * that moment, the motion the release hands over to (a server's wind-up moves the racket 0.17 m a frame).
 */
export function holdSteps(model: PlayerModel, sofar: readonly Timeline[], tells: readonly (TellStance | null)[]): (HoldSteps & { tell: TellStance | null })[] {
  return sofar.slice(0, -1).flatMap((tl, k) => tells.flatMap((tell) => (['A', 'B'] as const).map((id) => {
    const steps = frameSteps(sampleFrames(model, holdFrames(tl, sofar[k + 1]!, id, tell)));
    const leaving = steps.filter((s) => s.to === 'release' || (s.from === 'release' && s.to === 'play'));
    const times = [leaving[0]!.t - 1 / FPS, ...leaving.map((s) => s.t)];
    const own = frameSteps(sampleFrames(model, times.map((t) => ({ t, pose: matchFrameAt(sofar[k + 1]!, t).players[id], phase: 'play' as const }))));
    return { tell, entering: steps.filter((s) => s.from === 'walk' && s.to === 'hold'), leaving, own };
  })));
}
