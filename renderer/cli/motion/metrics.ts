// What the motion probe's samples say (ADR-031): per-frame steps of the racket and every bone, the ground slip of feet
// by what the body is doing, the racket's carry height between strokes, and the serve toss against the free hand.
import type { Quaternion } from 'three';
import type { PlayerId } from '@tennis/engine';
import { matchFrameAt } from '../../src/playback/frame.ts';
import type { Timeline } from '../../src/playback/timeline.ts';
import { toThree } from '../../src/scene/coords.ts';
import { GltfRig } from '../../src/scene/gltfRig.ts';
import type { PlayerModel } from '../../src/scene/playerModel.ts';
import { PLAYBACK } from '../../src/tuning/index.ts';
import { FPS, measure, type Phase, type Sample } from './probe.ts';

export interface Step { t: number; from: Phase; to: Phase; racket: number; bones: Record<string, number> }

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
    out.push({ t: b.t, from: a.phase, to: b.phase, racket: a.racket.distanceTo(b.racket), bones });
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

/** Free hand to ball (metres) one frame into each of `id`'s serve tosses before `until` replay seconds. */
export function tossGaps(model: PlayerModel, tl: Timeline, id: PlayerId, until: number): number[] {
  const rig = new GltfRig(model);
  const out: number[] = [];
  for (const seg of tl.segments) {
    for (const s of seg.point.shots) {
      const t = seg.zero + s.t - PLAYBACK.tossLeadSec + 1 / FPS;
      if (s.hitter !== id || s.shot !== 'serve' || t >= until) continue;
      const frame = matchFrameAt(tl, t);
      if (!frame.ball) continue;
      const hand = measure(rig, { t, pose: frame.players[id], phase: 'play' }).freeHand;
      out.push(hand.distanceTo(toThree(frame.ball)));
    }
  }
  return out;
}

export const quantile = (a: readonly number[], p: number): number => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]! : NaN;
