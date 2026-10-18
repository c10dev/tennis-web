// The stroke planner (ADR-024, D2): which stroke a player is in at replay time t and its effector targets, eased
// between key poses timed from the shot events. Pure and closed-form; the rig solves the targets onto bones.
import type { PlayerId, ShotEvent, Vec2, Vec3 } from '@tennis/engine';
import { lerp, smoothstep } from '../math.ts';
import { BALL, PLAYBACK, PLAYER_RIG, STROKE, STROKE_KEYS, type StrokeKey } from '../tuning/index.ts';
import type { SwingKind } from './pose.ts';
import { segmentAt, type PointSegment, type Timeline } from './timeline.ts';
import { tossPosition } from './trajectory.ts';

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
  /** Where the feet plant (court x, y), and how firmly, 0–1. */
  plant: { l: Vec2; r: Vec2; weight: number };
  /** The whole-body shift a ball out of reach needs at contact, in the player's frame, flat (TD-058): the rig shifts
   *  by it times `contactWeight`, and the foot on that side steps out with it. */
  lunge: V3;
  /** How much the free arm follows `keys.free` (default `weight`); the carry lets a running free arm swing (A2). */
  freeWeight?: number;
  /** Metres the feet spread sideways beyond where the clips put them (a split step's landing, A4). */
  spread?: number;
}

/** A court point in the frame of a player standing at `pos` facing `facing`. */
export function toLocal(p: Vec3, pos: Vec2, facing: Vec2): V3 {
  const dx = p.x - pos.x;
  const dy = p.y - pos.y;
  // Left of the facing direction, in court coordinates, is (−facing.y, facing.x).
  return { x: dx * -facing.y + dy * facing.x, y: p.z, z: dx * facing.x + dy * facing.y };
}

type Triple = readonly [number, number, number];
const away = (p: Triple, from: Triple, k: number): Triple => [from[0] + (p[0] - from[0]) * k, from[1] + (p[1] - from[1]) * k, from[2] + (p[2] - from[2]) * k];
/** A key with its hands further from the shoulders and its turn wider (STROKE.flourish, B2). */
function flourish(key: StrokeKey): StrokeKey {
  const F = STROKE.flourish;
  const right = PLAYER_RIG.shoulderR;
  const left: Triple = [-right[0], right[1], right[2]];
  return { ...key, pelvis: key.pelvis * F.turn, turn: key.turn * F.turn, hand: away(key.hand, right, F.reach), free: away(key.free, left, F.reach) };
}
const flourished = (keys: readonly StrokeKey[]) => keys.map((k, i) => ((STROKE.flourish.keys as readonly number[]).includes(i) ? flourish(k) : k));
/** The keys the planner plays: the groundstrokes flourished for the TV view, the serve as keyed. */
const KEYS: Record<SwingKind, readonly StrokeKey[]> = { forehand: flourished(STROKE_KEYS.forehand), backhand: flourished(STROKE_KEYS.backhand), serve: STROKE_KEYS.serve };

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

/** When this shot's stroke starts: just before the toss for a serve; otherwise the lead-in, not before the incoming contact plus a reaction. */
function leadStart(shots: ShotEvent[], i: number): number {
  const s = shots[i]!;
  if (s.shot === 'serve') return s.t - PLAYBACK.tossLeadSec - STROKE.serve.preTossSec;
  const before = shots[i - 1];
  return Math.max(s.t - STROKE.leadSec, before ? before.t + STROKE.reactionSec : -Infinity);
}

const NO_LUNGE: V3 = { x: 0, y: 0, z: 0 };

/** How far the body must shift, flat, for the racket to reach a contact point in the player's frame: what the
 *  shoulder's reach falls short by (within lungeMax), towards the ball. */
export function lungeFor(contact: V3): V3 {
  const [sx, sy, sz] = PLAYER_RIG.shoulderR;
  const short = Math.hypot(contact.x - sx, contact.y - sy, contact.z - sz) - PLAYER_RIG.contactReach;
  const fx = contact.x - sx;
  const fz = contact.z - sz;
  const flat = Math.hypot(fx, fz);
  if (short <= 0 || flat < 1e-9) return NO_LUNGE;
  const k = Math.min(PLAYER_RIG.lungeMax, short) / flat;
  return { x: fx * k, y: 0, z: fz * k };
}

/** Serve hop at contact: what the standing reach lacks for this contact height, within hopMax. */
export function serveHop(contactHeight: number, standingReach: number): number {
  return Math.min(STROKE.serve.hopMax, Math.max(0, contactHeight - standingReach));
}

export function strokeAt(timeline: Timeline, id: PlayerId, t: number, pos: Vec2, facing: Vec2): StrokePose | null {
  const index = segmentAt(timeline, t);
  // A serve starts just before its point does (A3), in the walk after the point before.
  const next = timeline.segments[index + 1];
  return strokeIn(timeline.segments[index]!, id, t, pos, facing) ?? (next ? strokeIn(next, id, t, pos, facing) : null);
}

function strokeIn(seg: PointSegment, id: PlayerId, t: number, pos: Vec2, facing: Vec2): StrokePose | null {
  const tau = t - seg.zero;
  const shots = seg.point.shots;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    if (s.hitter !== id) continue;
    const start = leadStart(shots, i);
    const end = s.t + STROKE.blendOut.toSec;
    if (tau < start || tau > end) continue;
    const kind = kindOf(s);
    const keys = KEYS[kind];
    const times = keys.map((key) => s.t + key.at);
    // Groundstrokes: the first key moves to the lead-in start, never past the backswing.
    if (kind !== 'serve') times[0] = Math.min(start, times[1]!);
    const blendIn = kind === 'serve' ? STROKE.serve.preTossSec : STROKE.blendInSec;
    const weight = smoothstep((tau - start) / blendIn) * (1 - smoothstep((tau - s.t - STROKE.blendOut.fromSec) / (STROKE.blendOut.toSec - STROKE.blendOut.fromSec)));
    const hopPeak = kind === 'serve' ? serveHop(s.from.z, PLAYER_RIG.standingReach) : 0;
    const { riseSec, fallSec } = STROKE.serve;
    const hop = hopPeak * (tau < s.t ? smoothstep(1 - (s.t - tau) / riseSec) : smoothstep(1 - (tau - s.t) / fallSec));
    const contact = toLocal(s.from, pos, facing);
    const keyed = sample(keys, times, tau);
    return {
      kind, weight, keys: kind === 'serve' ? holdingBall(keyed, s, tau, pos, facing) : keyed, contact, plant: plantAt(s, kind, tau),
      lunge: kind === 'serve' ? NO_LUNGE : lungeFor(contact),
      contactWeight: smoothstep(1 - Math.abs(tau - s.t) / (kind === 'serve' ? STROKE.serve.contactBlendSec : STROKE.contactBlendSec)), hop, keyTimes: times,
    };
  }
  return null;
}

/** The serve's free hand under the ball (A3): on it until the release, letting go over `letGoSec` after. */
function holdingBall(keys: Effectors, s: ShotEvent, tau: number, pos: Vec2, facing: Vec2): Effectors {
  const T = PLAYBACK.tossLeadSec;
  const u = (tau - (s.t - T)) / T;
  const held = 1 - smoothstep((u - BALL.toss.releaseShare) * T / STROKE.serve.letGoSec);
  if (held <= 0) return keys;
  const ball = toLocal(tossPosition(s, Math.max(0, Math.min(1, u))), pos, facing);
  return { ...keys, free: mix(keys.free, { x: ball.x, y: ball.y - BALL.toss.palm, z: ball.z }, held) };
}

/** The stroke's stance placed in the frame the player has at contact: at `hitterPos`, facing where the shot goes. */
function plantAt(s: ShotEvent, kind: SwingKind, tau: number): StrokePose['plant'] {
  const P = STROKE.plant;
  const to = s.bounce ? { x: s.bounce.x - s.from.x, y: s.bounce.y - s.from.y } : { x: 0, y: -Math.sign(s.from.y) };
  const n = Math.hypot(to.x, to.y) || 1;
  const f = { x: to.x / n, y: to.y / n };
  const at = ([x, z]: readonly [number, number]): Vec2 => ({ x: s.hitterPos.x - f.y * x + f.x * z, y: s.hitterPos.y + f.x * x + f.y * z });
  const [l, r] = STROKE.stance[kind];
  const t = tau - s.t;
  const from = kind === 'serve' ? P.serveIn : P.in0;
  const into = kind === 'serve' ? P.serveIn + 0.12 : P.in1;
  const weight = t < P.hold ? smoothstep((t - from) / (into - from)) : 1 - smoothstep((t - P.hold) / (P.out - P.hold));
  return { l: at(l), r: at(r), weight };
}

