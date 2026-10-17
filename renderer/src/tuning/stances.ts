// The decision hold's stances (ADR-024 S2, TD-061): while the cards are up both players wait where the next point
// starts in a ready stance, and the opponent's body shows the tell. Effectors as in strokes.ts (player frame,
// metres: +z forward, +x the player's left, y up).
import type { Card } from '@tennis/engine';

type V3 = readonly [number, number, number];

/** Ready stance: knees soft, chest over the toes, racket held in front with the free hand on its throat. */
export const READY_STANCE = {
  pelvis: 0,
  turn: 0,
  lean: 0.18,
  drop: 0.06,
  hand: [-0.1, 0.6, 0.4] as V3,
  dir: [0.3, 0.3, 0.9] as V3,
  free: [0.12, 0.64, 0.5] as V3,
  /** [left foot, right foot] as [x, z] in the player's frame. */
  feet: [[0.24, 0.02], [-0.24, 0.02]] as readonly [readonly [number, number], readonly [number, number]],
} as const;

/** Where the next point starts (the middle of the engine's serve and return ranges): metres from the centre mark
 * sideways and behind the baseline. */
export const READY_SPOTS = { server: { x: 0.65, back: 0.25 }, receiver: { x: 2.25, back: 1.15 } } as const;

/**
 * A tell on the body, added to the ready stance. `depth` moves the player back (+) or in (−); `sway` (m, side to
 * side) and `step` (m, in and out) at their Hz; `bounce` 0–1 of the split-step hop at `bounceHz` hops a second;
 * `lean` and `drop` add to the stance, and `hand`, `dir`, `free` replace its arms when given.
 */
export interface StanceCue {
  depth: number;
  lean: number;
  drop: number;
  sway: number;
  swayHz: number;
  step: number;
  stepHz: number;
  bounce: number;
  bounceHz: number;
  hand?: V3;
  dir?: V3;
  free?: V3;
}

const cue = (c: Partial<StanceCue>): StanceCue => ({ depth: 0, lean: 0, drop: 0, sway: 0, swayHz: 0, step: 0, stepHz: 0, bounce: 0, bounceHz: 0, ...c });

/** One per tell text, in the order of game/src/text/en.ts `tells` (a ui test checks the counts match). */
export const HOLD_STANCES: Record<Card, readonly StanceCue[]> = {
  attack: [
    // bounces on the toes, looking to step in
    cue({ depth: -0.3, lean: 0.12, bounce: 0.6, bounceHz: 2.4 }),
    // creeps up inside the baseline
    cue({ depth: -1.1, lean: 0.1, drop: 0.04 }),
    // grips the racket hard, eyes on the lines
    cue({ lean: 0.08, drop: 0.04, hand: [-0.08, 0.74, 0.46], dir: [0.2, 0.62, 0.76], free: [0.1, 0.76, 0.5] }),
    // bounces the ball fast, impatient
    cue({ lean: 0.1, bounce: 0.35, bounceHz: 3.2 }),
  ],
  defend: [
    // drifts back behind the baseline
    cue({ depth: 1.5, lean: -0.05 }),
    // settles deep, knees bent
    cue({ depth: 1.0, lean: 0.12, drop: 0.16 }),
    // takes a long breath and slows down
    cue({ lean: -0.16, drop: -0.04, hand: [-0.28, 0.6, 0.2], dir: [0.1, -0.2, 0.97], free: [0.24, 0.62, 0.12] }),
    // towels off, in no hurry
    cue({ depth: 0.6, lean: -0.12, drop: -0.04, hand: [-0.3, 0.55, 0.05], dir: [0, -0.6, 0.8], free: [0.06, 1.38, 0.24] }),
  ],
  counter: [
    // stays light, shuffling side to side
    cue({ sway: 0.35, swayHz: 0.9, bounce: 0.25, bounceHz: 1.8 }),
    // watches your feet closely
    cue({ lean: 0.24, drop: 0.06 }),
    // holds the racket out in front, compact
    cue({ drop: 0.06, hand: [-0.04, 0.72, 0.62], dir: [0.15, 0.45, 0.88], free: [0.1, 0.74, 0.66] }),
    // half-steps in, then back again
    cue({ step: 0.45, stepHz: 0.5 }),
  ],
};
