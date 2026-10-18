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
  /** Metres the feet stand wider than the ready stance. */
  spread: number;
  /** Radians the chest turns to the player's left (the hips 60 % of it): side-on. */
  turn: number;
  hand?: V3;
  dir?: V3;
  free?: V3;
}

const cue = (c: Partial<StanceCue>): StanceCue => ({ depth: 0, lean: 0, drop: 0, sway: 0, swayHz: 0, step: 0, stepHz: 0, bounce: 0, bounceHz: 0, spread: 0, turn: 0, ...c });

/**
 * What every tell of a card shares, so the card reads on a 30 px far player before its tell does (ADR-031 B3, Q7: one
 * big cue each): attack stands in with the racket cocked up and back, defend sits back with it low, counter goes wide with it out in
 * front, low and wide. A tell adds its numbers to these and replaces the arms it gives.
 */
export const HOLD_CARDS: Record<Card, Partial<StanceCue>> = {
  attack: { depth: -0.7, lean: 0.14, hand: [-0.32, 1.1, 0.05], dir: [-0.1, 0.8, -0.6], free: [0.3, 0.9, 0.45] },
  defend: { depth: 0.6, lean: -0.08, drop: 0.06, hand: [-0.32, 0.45, 0.12], dir: [-0.2, -0.3, 0.93], free: [0.24, 0.5, 0.08] },
  counter: { spread: 0.85, drop: 0.15, hand: [-0.04, 0.68, 0.6], dir: [0.15, 0.4, 0.9], free: [0.12, 0.66, 0.5] },
};

/** One per tell text, in the order of game/src/text/en.ts `tells` (a ui test checks the counts match). */
export const HOLD_STANCES: Record<Card, readonly StanceCue[]> = {
  attack: [
    // bounces on the toes, looking to step in: big, springy hops
    cue({ lean: 0.04, bounce: 0.9, bounceHz: 2.0 }),
    // creeps up inside the baseline
    cue({ depth: -0.9, lean: 0.06, drop: 0.04 }),
    // grips the racket hard, eyes on the lines: both hands on it, cocked high behind the head
    cue({ lean: 0.1, drop: 0.06, hand: [-0.22, 1.34, -0.12], dir: [-0.05, 0.8, -0.6], free: [0.12, 1.15, 0.25] }),
    // bounces the ball fast, impatient: the racket down at the side, the free hand low, bouncing it
    cue({ bounce: 0.3, bounceHz: 3.2, hand: [-0.32, 0.6, 0.12], dir: [-0.1, 0.9, 0.4], free: [0.28, 0.42, 0.4] }),
  ],
  defend: [
    // drifts back behind the baseline
    cue({ depth: 1.0, lean: -0.04 }),
    // settles deep, knees bent
    cue({ depth: 0.3, lean: 0.2, drop: 0.12 }),
    // takes a long breath and slows down: chest back, the racket over the shoulder, the free hand on the hip
    cue({ lean: -0.16, drop: -0.08, hand: [-0.22, 1.0, 0.1], dir: [0.1, 0.5, -0.85], free: [0.28, 0.55, 0.0] }),
    // towels off, in no hurry: the free hand at the face
    cue({ lean: -0.06, drop: -0.06, hand: [-0.3, 0.55, 0.05], dir: [0, -0.6, 0.8], free: [0.06, 1.38, 0.24] }),
  ],
  counter: [
    // stays light, shuffling side to side
    cue({ sway: 0.35, swayHz: 0.9, bounce: 0.25, bounceHz: 1.8 }),
    // watches your feet closely: bent right over, the racket down by them
    cue({ lean: 0.34, hand: [-0.2, 0.5, 0.45], dir: [0, -0.9, 0.45], free: [0.2, 0.55, 0.4] }),
    // holds the racket out in front, compact: both arms out at the chin, the racket tilted at the net
    cue({ drop: -0.04, hand: [0.04, 1.05, 0.85], dir: [0, 0.55, 0.83], free: [0.16, 0.95, 0.6] }),
    // half-steps in, then back again
    cue({ step: 0.6, stepHz: 0.5 }),
  ],
};

/** Seconds after the decision hold over which each player eases from the ready spot to where the point really starts
 *  (READY_SPOTS is the middle of the engine's range, up to about a metre off; ADR-030). */
export const HOLD_RELEASE_SEC = 0.5;

/** Metres a second the release may move a player (a brisk walk): a longer way takes longer than HOLD_RELEASE_SEC. */
export const HOLD_RELEASE_SPEED = 2.5;

/** Seconds over which the walk into the decision hold eases into the held stance (TD-078). */
export const HOLD_ENTER_SEC = 0.35;
