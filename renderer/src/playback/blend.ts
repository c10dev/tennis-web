// One player pose blended into another (ADR-031 step A1, TD-078): the decision hold's stance takes over from the walk
// into it and hands back to the timeline after it, so no body changes in a frame. Pure.
//
// A pose drives two layers on the skinned rig: clips (speed, stride distance, reaction, sampled at `t`) and the stroke
// over them by its weight. The legs follow the clips even under a full stroke when its feet are not planted (a
// swaying tell), so the blend keeps the second pose's clip state and asks the rig to sample the first's too
// (`clipBlend`), fading out.
import type { Vec2 } from '@tennis/engine';
import { lerp } from '../math.ts';
import type { PlayerPose } from './pose.ts';
import type { Effectors, StrokePose } from './stroke.ts';

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

function keys(a: Effectors, b: Effectors, k: number): Effectors {
  return {
    pelvis: lerp(a.pelvis, b.pelvis, k), turn: lerp(a.turn, b.turn, k), lean: lerp(a.lean, b.lean, k), drop: lerp(a.drop, b.drop, k),
    hand: v3(a.hand, b.hand, k), dir: arc(a.dir, b.dir, k), free: v3(a.free, b.free, k),
  };
}

function stroke(a: StrokePose | null, b: StrokePose | null, k: number): StrokePose | null {
  if (a && b) {
    return {
      ...b, weight: lerp(a.weight, b.weight, k), keys: keys(a.keys, b.keys, k), contactWeight: lerp(a.contactWeight, b.contactWeight, k),
      hop: lerp(a.hop, b.hop, k), lunge: v3(a.lunge, b.lunge, k),
      plant: { l: v2(a.plant.l, b.plant.l, k), r: v2(a.plant.r, b.plant.r, k), weight: lerp(a.plant.weight, b.plant.weight, k) },
    };
  }
  if (a) return { ...a, weight: a.weight * (1 - k), plant: { ...a.plant, weight: a.plant.weight * (1 - k) } };
  if (b) return { ...b, weight: b.weight * k, plant: { ...b.plant, weight: b.plant.weight * k } };
  return null;
}

/** `k` (0–1) of the way from pose `a` to pose `b`: `a` itself at 0, `b` at 1. */
export function blendPose(a: PlayerPose, b: PlayerPose, k: number): PlayerPose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return {
    ...b, clipBlend: { from: a, weight: 1 - k }, pos: v2(a.pos, b.pos, k), facing: turn(a.facing, b.facing, k), stroke: stroke(a.stroke, b.stroke, k),
    // Whole-body lifts and bends ease too (a held bounce must not drop in a frame).
    splitStep: lerp(a.splitStep, b.splitStep, k), crouch: lerp(a.crouch, b.crouch, k), toss: lerp(a.toss, b.toss, k),
  };
}
