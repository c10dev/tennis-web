// Court, colours and rig sizes for the Three.js scene.

/** Court dimensions the engine does not need (ITF): doubles alleys, run-off, line widths. */
export const COURT_DRAW = {
  doublesHalfWidth: 5.485,
  /** Net posts stand this far outside the doubles sidelines. */
  postOutside: 0.914,
  lineWidth: 0.05,
  baselineWidth: 0.08,
  centreMarkLength: 0.1,
  /** Coloured surround around the court, in metres from the centre. */
  surroundHalfWidth: 13,
  surroundHalfLength: 21,
  grassStripes: 12,
} as const;

export const COLOURS = {
  background: 0x1f2630,
  ground: 0x2a3037,
  lines: 0xffffff,
  net: 0x161616,
  post: 0x2f4f3a,
  ball: 0xdcf24a,
  shadow: 0x000000,
  surface: {
    hard: { court: 0x3a6ea5, surround: 0x4a7f5a },
    clay: { court: 0xc4673f, surround: 0xb35d39 },
    grass: { court: 0x5f9e4a, surround: 0x56913f, stripe: 0x6aab53 },
  },
  players: { A: 0xd8433b, B: 0xf1f1ee },
  skin: 0xd9a77f,
  racket: 0x26282c,
  visor: 0x20242a,
} as const;

/** Capsule rig sizes in metres and its pose angles in radians (ADR-007). */
export const RIG = {
  bodyRadius: 0.22,
  bodyLength: 1.1,
  headRadius: 0.13,
  shoulderHeight: 1.4,
  shoulderOffset: 0.2,
  armLength: 0.6,
  handleLength: 0.28,
  racketHeadRadius: 0.14,
  /** Racket direction is set by a roll (down +, up −) then a yaw sweep (0 = out to the right, + towards the front). */
  idle: { yaw: 0.4, roll: 0.7 },
  forehand: { from: -1.6, to: 2.6, roll: 0.15 },
  backhand: { from: 3.9, to: 0.4, roll: 0.15 },
  serve: { rollFrom: 0.6, rollContact: -1.5, rollEnd: 0.5, yawEnd: 2.4 },
  celebrate: { yaw: 0.2, roll: -1.3 },
  dejectedLean: 0.3,
  /** Forward lean when running flat out, and the speed (m/s) that counts as flat out. */
  runLean: 0.22,
  runLeanSpeed: 8,
  shadowRadius: 0.45,
} as const;
