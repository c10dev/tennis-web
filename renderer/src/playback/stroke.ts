// The stroke planner (ADR-024, D2): which stroke a player is in at replay time t and its effector targets, eased
// between key poses timed from the shot events. Pure and closed-form; the rig solves the targets onto bones.
import type { PlayerId, ShotEvent, Vec2, Vec3 } from '@tennis/engine';
import { lerp, smoothstep } from '../math.ts';
import { PLAYBACK, PLAYER_RIG, STROKE, STROKE_KEYS, type StrokeKey } from '../tuning/index.ts';
import type { SwingKind } from './pose.ts';
import { segmentAt, type Timeline } from './timeline.ts';

type V3 = { x: number; y: number; z: number };

/** Effector targets in the player's own frame: +z forward, +x the player's left, y up, metres. */
export interface Effectors {
  pelvis: number;
  turn: number;
  lean: number;
  drop: number;
  hand: V3;
  dir: V3;
  free: V3;
}

export interface StrokePose {
  kind: SwingKind;
  /** How much the stroke owns the body over the clips, 0–1. */
  weight: number;
  keys: Effectors;
  /** Where the engine says the ball is struck, in the player's frame; how strongly the racket is bent onto it. */
  contact: V3;
  contactWeight: number;
  /** Serve hop at this moment (m). */
  hop: number;
  /** Key times in point seconds, for tests. */
  keyTimes: number[];
}

/** A court point in the frame of a player standing at `pos` facing `facing`. */
export function toLocal(p: Vec3, pos: Vec2, facing: Vec2): V3 {
  const dx = p.x - pos.x;
  const dy = p.y - pos.y;
  // Left of the facing direction, in court coordinates, is (−facing.y, facing.x).
  return { x: dx * -facing.y + dy * facing.x, y: p.z, z: dx * facing.x + dy * facing.y };
}

const kindOf = (s: ShotEvent): SwingKind => (s.shot === 'serve' ? 'serve' : (s.wing ?? 'forehand'));
const v3 = (a: readonly [number, number, number]): V3 => ({ x: a[0], y: a[1], z: a[2] });
const mix = (a: V3, b: V3, u: number): V3 => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) });
const unit = (a: V3): V3 => {
  const n = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
};

function blend(a: StrokeKey, b: StrokeKey, u: number): Effectors {
  return {
    pelvis: lerp(a.pelvis, b.pelvis, u), turn: lerp(a.turn, b.turn, u), lean: lerp(a.lean, b.lean, u), drop: lerp(a.drop, b.drop, u),
    hand: mix(v3(a.hand), v3(b.hand), u), dir: unit(mix(v3(a.dir), v3(b.dir), u)), free: mix(v3(a.free), v3(b.free), u),
  };
}

/** Effectors at point time `tau` from keys at `times`, smoothstep-eased from each key to the next. */
function sample(keys: readonly StrokeKey[], times: number[], tau: number): Effectors {
  if (tau <= times[0]!) return blend(keys[0]!, keys[0]!, 0);
  for (let i = 1; i < keys.length; i++) {
    if (tau <= times[i]!) return blend(keys[i - 1]!, keys[i]!, smoothstep((tau - times[i - 1]!) / Math.max(1e-6, times[i]! - times[i - 1]!)));
  }
  return blend(keys.at(-1)!, keys.at(-1)!, 0);
}

/** When this shot's stroke starts: the toss for a serve; otherwise the lead-in, not before the incoming contact plus a reaction. */
function leadStart(shots: ShotEvent[], i: number): number {
  const s = shots[i]!;
  if (s.shot === 'serve') return s.t - PLAYBACK.tossLeadSec;
  const before = shots[i - 1];
  return Math.max(s.t - STROKE.leadSec, before ? before.t + STROKE.reactionSec : -Infinity);
}

/** Serve hop at contact: what the standing reach lacks for this contact height, within hopMax. */
export function serveHop(contactHeight: number, standingReach: number): number {
  return Math.min(STROKE.serve.hopMax, Math.max(0, contactHeight - standingReach));
}

export function strokeAt(timeline: Timeline, id: PlayerId, t: number, pos: Vec2, facing: Vec2): StrokePose | null {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  const tau = t - seg.zero;
  const shots = seg.point.shots;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    if (s.hitter !== id) continue;
    const start = leadStart(shots, i);
    const end = s.t + STROKE.blendOut.toSec;
    if (tau < start || tau > end) continue;
    const kind = kindOf(s);
    const keys = STROKE_KEYS[kind];
    const times = keys.map((key) => s.t + key.at);
    // Groundstrokes: the first key moves to the lead-in start, never past the backswing.
    if (kind !== 'serve') times[0] = Math.min(start, times[1]!);
    const weight = smoothstep((tau - start) / STROKE.blendInSec) * (1 - smoothstep((tau - s.t - STROKE.blendOut.fromSec) / (STROKE.blendOut.toSec - STROKE.blendOut.fromSec)));
    const hopPeak = kind === 'serve' ? serveHop(s.from.z, PLAYER_RIG.standingReach) : 0;
    const { riseSec, fallSec } = STROKE.serve;
    const hop = hopPeak * (tau < s.t ? smoothstep(1 - (s.t - tau) / riseSec) : smoothstep(1 - (tau - s.t) / fallSec));
    return {
      kind, weight, keys: sample(keys, times, tau), contact: toLocal(s.from, pos, facing),
      contactWeight: smoothstep(1 - Math.abs(tau - s.t) / (kind === 'serve' ? STROKE.serve.contactBlendSec : STROKE.contactBlendSec)), hop, keyTimes: times,
    };
  }
  return null;
}
