// Stroke key poses (ADR-024, D2): effector targets in the player's own frame (metres; +z forward, +x the player's
// left, y up), timed from contact. Scaled from the style-frame proxy (docs/design/3d-redesign/proto/figure.js) to the
// slice body, whose shoulders stand 1.09 m up.

/** One key: hips and chest angles (radians; + turns to the player's left), drop of the hips (m), the racket hand
 * and racket direction, the free hand. */
export interface StrokeKey {
  at: number;
  pelvis: number;
  turn: number;
  lean: number;
  drop: number;
  hand: readonly [number, number, number];
  dir: readonly [number, number, number];
  free: readonly [number, number, number];
}

export const STROKE = {
  /** A groundstroke's lead-in starts this long before contact, or this long after the incoming contact if later. */
  leadSec: 0.5,
  reactionSec: 0.15,
  /** Backswing complete to contact: never compressed, whatever the incoming ball allows. */
  forwardSwingSec: 0.18,
  /** Seconds to blend in from the clips at the lead-in, and the span after contact over which the stroke hands back. */
  blendInSec: 0.12,
  blendOut: { fromSec: 0.45, toSec: 0.75 },
  /** Either side of contact, the keyed racket bends onto the ball (as A1's contactBlend). */
  contactBlendSec: 0.16,
  /** Serve: the hop that lifts a body too short for the toss (rule: what reach lacks, within hopMax), its rise and
   * fall, and a wider bend onto the ball, so the racket's fastest frame stays under 0.7 m. The serve starts `preTossSec`
   * before the toss (blending in, so the free hand holds the ball when it appears) and the free hand lets the ball go
   * over `letGoSec` after the release (ADR-031 A3). */
  serve: { hopMax: 0.55, riseSec: 0.28, fallSec: 0.32, contactBlendSec: 0.26, preTossSec: 0.3, letGoSec: 0.15 },
  /** Feet planted for the stroke, from contact: in over [in0, in1], held to hold, out by out (seconds; a serve's feet
   * plant from the toss). Positions are the stance below, placed in the frame the player has at contact. */
  plant: { in0: -0.2, in1: -0.08, hold: 0.15, out: 0.32, serveIn: -0.9 },
  /** Stance at contact per stroke, [left foot, right foot] as [x, z] in the player's frame (metres). */
  stance: {
    forehand: [[0.28, 0.12], [-0.3, -0.05]],
    backhand: [[0.3, -0.08], [-0.08, 0.3]],
    serve: [[0.15, 0.2], [-0.2, -0.15]],
  },
} as const;

const k = (at: number, pelvis: number, turn: number, lean: number, drop: number, hand: StrokeKey['hand'], dir: StrokeKey['dir'], free: StrokeKey['free']): StrokeKey =>
  ({ at, pelvis, turn, lean, drop, hand, dir, free });

/**
 * Per stroke, keys at seconds from contact. The first key of a groundstroke is moved to the lead-in start; the last
 * four (backswing, contact, follow-through, recovery) keep their times. Right-handed: the racket side is −x.
 */
export const STROKE_KEYS = {
  forehand: [
    k(-0.5, -0.5, -1.1, 0.15, 0.06, [-0.55, 0.87, -0.05], [-0.1, 0.95, -0.25], [0.35, 0.92, 0.6]),
    k(-0.18, -0.7, -1.35, 0.12, 0.1, [-0.62, 0.62, -0.42], [0.35, -0.15, -0.92], [0.55, 0.95, 0.5]),
    k(0, -0.1, 0.15, 0.12, 0.08, [-0.5, 0.75, 0.42], [-0.96, 0.08, 0.26], [0.5, 0.85, 0.32]),
    k(0.22, 0.5, 1.05, 0.1, 0.04, [0.4, 1.12, 0.14], [0.15, 0.25, -0.95], [0.44, 0.78, -0.1]),
    k(0.5, 0.1, 0.1, 0.2, 0.06, [-0.14, 0.7, 0.4], [0, 0.8, 0.6], [0.14, 0.7, 0.37]),
  ],
  backhand: [
    k(-0.5, 0.5, 1.1, 0.15, 0.06, [0.35, 0.85, 0.1], [0.1, 0.95, -0.25], [0.3, 0.88, 0.25]),
    k(-0.18, 0.75, 1.4, 0.12, 0.1, [0.42, 0.6, -0.35], [-0.3, -0.15, -0.94], [0.3, 0.8, 0.0]),
    k(0, 0.15, -0.1, 0.12, 0.08, [0.2, 0.75, 0.48], [0.96, 0.06, 0.28], [0.45, 0.8, -0.25]),
    k(0.22, -0.4, -0.9, 0.08, 0.04, [-0.5, 1.15, 0.2], [-0.2, 0.55, -0.8], [0.4, 0.85, -0.3]),
    k(0.5, -0.05, -0.05, 0.2, 0.06, [-0.14, 0.7, 0.4], [0, 0.8, 0.6], [0.14, 0.7, 0.37]),
  ],
  serve: [
    k(-1.0, -0.6, -0.6, 0.05, 0.03, [-0.2, 0.7, 0.3], [0.1, 0.4, 0.9], [0.15, 0.8, 0.35]),
    k(-0.45, -1.1, -1.25, -0.15, 0.14, [-0.5, 1.15, -0.2], [0.2, 0.6, -0.75], [0.15, 1.9, 0.2]),
    k(-0.22, -0.9, -0.9, -0.1, 0.08, [-0.35, 1.25, -0.25], [0.1, -0.8, -0.55], [0.2, 1.4, 0.3]),
    k(0, -0.4, -0.2, 0.05, -0.05, [-0.22, 1.75, 0.27], [-0.05, 0.98, 0.18], [0.33, 0.82, 0.27]),
    k(0.3, 0.5, 0.9, 0.3, 0.06, [0.35, 0.55, 0.3], [0.5, -0.5, 0.7], [0.3, 0.75, -0.1]),
    k(0.6, 0.1, 0.1, 0.2, 0.06, [-0.14, 0.7, 0.4], [0, 0.8, 0.6], [0.14, 0.7, 0.37]),
  ],
} as const satisfies Record<string, readonly StrokeKey[]>;

/**
 * The racket carried between strokes (ADR-031 A2): effector keys for the arms whenever no stroke owns them (the
 * KayKit clips carry a weapon high). Relaxed between points, the ready stance (stances.ts READY_STANCE) while the ball
 * is in play (from the toss to `afterLandSec` past the last landing, eased over `easeSec`), out to the racket side at
 * a run (speeds
 * `runFrom`–`runFull`) and between points, so the TV camera behind the near player sees it past the body. `free` is how
 * much the free arm follows its keys (0: the clip's swing).
 */
export const CARRY = {
  relaxed: { pelvis: 0, turn: 0, lean: 0.03, drop: 0, hand: [-0.26, 0.55, 0.15], dir: [-0.3, 0.62, 0.72], free: [0.2, 0.5, 0.05] },
  run: { pelvis: 0, turn: 0, lean: 0.1, drop: 0.03, hand: [-0.3, 0.62, 0.25], dir: [-0.25, 0.65, 0.72], free: [0.2, 0.6, 0.2] },
  runFrom: 1.0,
  runFull: 3.2,
  easeSec: 0.5,
  afterLandSec: 0.3,
  /** The carry reads speed as the average over ± this many seconds: a player reaches a run in a few frames, the
   *  racket must not swing over in them. */
  speedWindowSec: 0.4,
} as const;
