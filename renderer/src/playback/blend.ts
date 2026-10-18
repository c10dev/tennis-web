// One player pose eased into another (ADR-031 A1, TD-078): the decision hold's stance takes over from the walk into it
// and hands back to the timeline after it, so no body changes in a frame. Pure.
//
// The blended pose is the second one with a `crossfade` back to the first: the skinned rig solves both and mixes their
// bones (B3). Mixing the effector targets instead and solving once flipped elbows and knees whenever the mixed hand or
// foot passed where the IK's bend turns over (a racket cocked behind the head handing over to a serve's toss).
// Position and facing ease here too, for whatever reads them from the pose.
import type { Vec2 } from '@tennis/engine';
import { lerp } from '../math.ts';
import type { PlayerPose } from './pose.ts';
import type { Effectors } from './stroke.ts';

type V3 = { x: number; y: number; z: number };
const v3 = (a: V3, b: V3, k: number): V3 => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });
const v2 = (a: Vec2, b: Vec2, k: number): Vec2 => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

/** From facing `a` towards `b` by `k` of the angle, the shorter way round (anticlockwise from straight back). */
function turn(a: Vec2, b: Vec2, k: number): Vec2 {
  const from = Math.atan2(a.y, a.x);
  let d = Math.atan2(b.y, b.x) - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (d <= -Math.PI + 1e-9) d = Math.PI;
  return { x: Math.cos(from + d * k), y: Math.sin(from + d * k) };
}

/** Unit direction `k` of the way from `a` to `b` along the sphere; between opposite directions it turns through the
 *  one most nearly up (or forward), so the racket never points nowhere on the way. */
function arc(a: V3, b: V3, k: number): V3 {
  const unit = (v: V3) => { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; };
  const [p, q] = [unit(a), unit(b)];
  const cos = Math.max(-1, Math.min(1, p.x * q.x + p.y * q.y + p.z * q.z));
  const theta = Math.acos(cos);
  if (theta < 1e-6) return p;
  // Opposite: go through a perpendicular, up unless p is (nearly) vertical, then forward.
  const side = Math.abs(p.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  const d = side.x * p.x + side.y * p.y + side.z * p.z;
  const perp = theta > Math.PI - 1e-6 ? unit({ x: side.x - d * p.x, y: side.y - d * p.y, z: side.z - d * p.z })
    : unit({ x: q.x - cos * p.x, y: q.y - cos * p.y, z: q.z - cos * p.z });
  const t = theta * k;
  return { x: p.x * Math.cos(t) + perp.x * Math.sin(t), y: p.y * Math.cos(t) + perp.y * Math.sin(t), z: p.z * Math.cos(t) + perp.z * Math.sin(t) };
}

/** Effector keys `k` of the way from `a` to `b`, the racket's direction along the sphere (the carry's mixes, A2). */
export function blendKeys(a: Effectors, b: Effectors, k: number): Effectors {
  return {
    pelvis: lerp(a.pelvis, b.pelvis, k), turn: lerp(a.turn, b.turn, k), lean: lerp(a.lean, b.lean, k), drop: lerp(a.drop, b.drop, k),
    hand: v3(a.hand, b.hand, k), dir: arc(a.dir, b.dir, k), free: v3(a.free, b.free, k),
  };
}

/** `k` (0–1) of the way from pose `a` to pose `b`: `a` itself at 0, `b` at 1. `ref`, `b` as the blend began, keeps
 *  each bone turning the same way round while `b` moves on (B3). */
export function blendPose(a: PlayerPose, b: PlayerPose, k: number, ref?: PlayerPose): PlayerPose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return { ...b, pos: v2(a.pos, b.pos, k), facing: turn(a.facing, b.facing, k), crossfade: ref ? { from: a, weight: 1 - k, ref } : { from: a, weight: 1 - k } };
}
