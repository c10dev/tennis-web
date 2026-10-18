// The racket carried between strokes (ADR-031 A2, TD-079): the arms follow effector keys whenever no stroke owns
// them, relaxed between points, ready while the ball is in play, low at a run; a stroke blends from the carry rather
// than from the clips (which carry a weapon high and swap its height as idle and walk blend). Pure, closed form.
import { lerp, smoothstep } from '../math.ts';
import { CARRY, READY_STANCE, SPLIT_STEP } from '../tuning/index.ts';
import { blendKeys } from './blend.ts';
import type { Effectors, StrokePose } from './stroke.ts';
import { segmentAt, type Timeline } from './timeline.ts';

export interface Carry {
  /** How much the carry owns the arms (1 but in a reaction, whose clips move them). */
  weight: number;
  keys: Effectors;
  /** How much the free arm follows `keys.free`. */
  free: number;
  /** Metres the feet spread beyond the stance (a split step's landing, A4). */
  spread: number;
}

type Keyed = { pelvis: number; turn: number; lean: number; drop: number; hand: readonly number[]; dir: readonly number[]; free: readonly number[] };
const v3 = (a: readonly number[]) => ({ x: a[0]!, y: a[1]!, z: a[2]! });
const effectors = (k: Keyed): Effectors => ({ pelvis: k.pelvis, turn: k.turn, lean: k.lean, drop: k.drop, hand: v3(k.hand), dir: v3(k.dir), free: v3(k.free) });
const RELAXED = effectors(CARRY.relaxed);
const READY = effectors(READY_STANCE);
const RUN = effectors(CARRY.run);

/** 0 between points, 1 from the toss until just after the point's last landing, eased in and out. */
function readiness(timeline: Timeline, t: number): number {
  const seg = timeline.segments[segmentAt(timeline, t)]!;
  const off = seg.landed + CARRY.afterLandSec;
  return smoothstep((t - seg.start) / CARRY.easeSec) * (1 - smoothstep((t - off) / CARRY.easeSec));
}

/** The carry at replay time `t` for a player moving at `speed` (m/s), with a split step's landing bend and feet spread
 *  (0–1 each); its weight is the pose's to set. */
export function carryAt(timeline: Timeline, t: number, speed: number, land = 0, spread = 0): Carry {
  const ready = readiness(timeline, t);
  const run = smoothstep((speed - CARRY.runFrom) / (CARRY.runFull - CARRY.runFrom));
  const keys = blendKeys(blendKeys(RELAXED, READY, ready), RUN, run);
  return { weight: 1, keys: { ...keys, drop: keys.drop + SPLIT_STEP.drop * land }, free: lerp(ready, 0, run), spread: SPLIT_STEP.spread * spread };
}

const NONE = { x: 0, y: 0, z: 0 };

/** No carry: the clips own the arms (a pose built by hand for a clip test). */
export const NO_CARRY: Carry = { weight: 0, keys: RELAXED, free: 0, spread: 0 };

/**
 * The stroke the rig solves: `stroke` over the carry. Their union owns the body; the keys move from the carry's to the
 * stroke's by the stroke's share, scaled so the stroke keeps its own share of the turn, lean and hop.
 */
export function withCarry(stroke: StrokePose | null, carry: Carry): StrokePose | null {
  const ws = stroke?.weight ?? 0;
  const weight = 1 - (1 - carry.weight) * (1 - ws);
  if (weight <= 1e-9) return null;
  if (!stroke) {
    return {
      kind: 'forehand', weight, keys: carry.keys, contact: NONE, contactWeight: 0, hop: 0, keyTimes: [], lunge: NONE,
      plant: { l: { x: 0, y: 0 }, r: { x: 0, y: 0 }, weight: 0 }, freeWeight: carry.free * carry.weight / weight, spread: carry.spread,
    };
  }
  const share = ws / weight;
  if (share >= 1) return { ...stroke, freeWeight: 1, spread: 0 };
  return {
    ...stroke, weight, keys: blendKeys(carry.keys, stroke.keys, share), hop: stroke.hop * share,
    freeWeight: (carry.free * (weight - ws) + ws) / weight, spread: carry.spread * (1 - share),
  };
}
