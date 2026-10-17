// A player's pose at replay time t, from the events alone: what a rig needs to draw them (ADR-007).
import type { PlayerId, ShotEvent, Vec2, Vec3 } from '@tennis/engine';
import { smoothstep } from '../math.ts';
import { PLAYBACK, RIG_MOTION } from '../tuning/index.ts';
import { facingAt } from './facing.ts';
import { strokeAt, type StrokePose } from './stroke.ts';
import { distanceAt, positionAt } from './movement.ts';
import { segmentAt, type Timeline } from './timeline.ts';

export type SwingKind = 'serve' | 'forehand' | 'backhand';
export type Reaction = 'none' | 'celebrate' | 'dejected';

export interface PlayerPose {
  pos: Vec2;
  /** Unit vector in court coordinates the player faces. */
  facing: Vec2;
  /** Running speed in m/s. */
  speed: number;
  /** Swing in progress: phase 0 → 1, contact at 0.5, where the engine says the ball was struck (court coordinates). */
  swing: { kind: SwingKind; phase: number; contact?: Vec3 } | null;
  reaction: Reaction;
  /** How far into the reaction the body is, 0–1: it eases in after the ball lands and out before it ends. */
  reactionWeight: number;
  /** Stride phase (radians) and how much of a full running stride, 0–1. */
  gait: { phase: number; amount: number };
  /** Knee bend into a groundstroke, 0–1 (1 at contact). */
  crouch: number;
  /** Split-step hop as the opponent strikes, 0–1. */
  splitStep: number;
  /** Tossing arm raised for a serve, 0–1. */
  toss: number;
  /** Replay time in seconds: looping clips are sampled at it (ADR-024), so a pose stays a function of time. */
  t: number;
  /** The stroke in progress for the skinned rig (ADR-024, effector keys), or null. */
  stroke: StrokePose | null;
  /** Running velocity in court coordinates (m/s) and metres moved since the match began (strides follow it). */
  velocity: Vec2;
  distance: number;
  /** Seconds since the point's last ball landed (negative before): reaction clips play from it. */
  reactionT: number;
}

export function playerPose(timeline: Timeline, id: PlayerId, t: number): PlayerPose {
  const pos = positionAt(timeline, id, t);
  const dt = RIG_MOTION.speedSampleSec;
  const before = positionAt(timeline, id, Math.max(0, t - dt));
  const after = positionAt(timeline, id, Math.min(timeline.totalSec, t + dt));
  const speed = Math.hypot(after.x - before.x, after.y - before.y) / (2 * dt);
  const velocity = { x: (after.x - before.x) / (2 * dt), y: (after.y - before.y) / (2 * dt) };
  const index = segmentAt(timeline, t);
  const seg = timeline.segments[index]!;
  const tau = t - seg.zero;
  const own = seg.point.shots.filter((s) => s.hitter === id);
  const facing = turnToShot(facingAt(timeline, id, index, t, pos), own, tau);
  return {
    pos, facing, speed, swing: swing(timeline, id, t), reaction: reaction(timeline, id, t), reactionWeight: reactionWeight(timeline, t),
    gait: { phase: 2 * Math.PI * RIG_MOTION.gaitHz * t, amount: Math.min(1, speed / RIG_MOTION.fullRunSpeed) },
    crouch: peak(seg.point.shots.filter((s) => s.hitter === id && s.shot !== 'serve'), tau, RIG_MOTION.crouchSec),
    splitStep: peak(seg.point.shots.filter((s) => s.hitter !== id), tau, RIG_MOTION.splitStepSec),
    toss: toss(seg.point.shots.filter((s) => s.hitter === id && s.shot === 'serve'), tau),
    t,
    stroke: strokeAt(timeline, id, t, pos, facing),
    velocity,
    distance: distanceAt(timeline, id, t),
    reactionT: t - seg.landed,
  };
}

/** 1 at a shot's contact, falling to 0 `width` seconds either side; the strongest over the shots. */
function peak(shots: { t: number }[], tau: number, width: number): number {
  let best = 0;
  for (const s of shots) best = Math.max(best, 1 - Math.abs(tau - s.t) / width);
  return best;
}

function toss(serves: { t: number }[], tau: number): number {
  for (const s of serves) {
    const start = s.t - PLAYBACK.tossLeadSec;
    if (tau >= start && tau <= s.t) return Math.min(1, (tau - start) / (RIG_MOTION.tossRiseShare * PLAYBACK.tossLeadSec));
  }
  return 0;
}

/** Near their own contact a player turns towards where the shot goes, so the ball meets them side-on (ADR-023). */
function turnToShot(base: Vec2, own: ShotEvent[], tau: number): Vec2 {
  const s = own.find((x) => Math.abs(tau - x.t) < RIG_MOTION.contactTurnSec);
  if (!s) return base;
  const w = smoothstep(1 - Math.abs(tau - s.t) / RIG_MOTION.contactTurnSec);
  const to = s.bounce ? { x: s.bounce.x - s.from.x, y: s.bounce.y - s.from.y } : { x: 0, y: -Math.sign(s.from.y) };
  const n = Math.hypot(to.x, to.y);
  const dir = { x: to.x / n, y: to.y / n };
  const mix = { x: base.x + (dir.x - base.x) * w, y: base.y + (dir.y - base.y) * w };
  const m = Math.hypot(mix.x, mix.y);
  return m > 1e-6 ? { x: mix.x / m, y: mix.y / m } : dir;
}

function swing(timeline: Timeline, id: PlayerId, t: number): PlayerPose['swing'] {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  const tau = t - seg.zero;
  for (const s of seg.point.shots) {
    if (s.hitter !== id) continue;
    const kind: SwingKind = s.shot === 'serve' ? 'serve' : (s.wing ?? 'forehand');
    const { pre, post } = s.shot === 'serve' ? RIG_MOTION.swing.serve : RIG_MOTION.swing.stroke;
    if (tau < s.t - pre || tau > s.t + post) continue;
    const phase = tau < s.t ? 0.5 * (tau - (s.t - pre)) / pre : 0.5 + 0.5 * (tau - s.t) / post;
    return { kind, phase, contact: s.from };
  }
  return null;
}

function reactionWeight(timeline: Timeline, t: number): number {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  const end = Math.min(seg.landed + RIG_MOTION.reactionSec, seg.next);
  if (t < seg.landed || t >= end) return 0;
  const ramp = Math.min(RIG_MOTION.reactionRampSec, (end - seg.landed) / 2);
  return smoothstep(Math.min(t - seg.landed, end - t) / ramp);
}

function reaction(timeline: Timeline, id: PlayerId, t: number): Reaction {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  if (t < seg.landed || t >= Math.min(seg.landed + RIG_MOTION.reactionSec, seg.next)) return 'none';
  return seg.point.winner === id ? 'celebrate' : 'dejected';
}
