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

/** Rally Pop palette (ADR-018, docs/design-references.md §3): yellow-green belongs to the ball alone. */
export const COLOURS = {
  background: 0x1f2630,
  ground: 0x5f665a,
  /** Slightly off-white, so the white trail and the paper UI stay the brightest things on screen. */
  lines: 0xf3f0e6,
  net: 0x161616,
  post: 0x1d2a44,
  ball: 0xd6f53a,
  /** Skid mark a bounce leaves, shown on Hawk-Eye close-ups. */
  mark: 0x2b2b2b,
  shadow: 0x000000,
  surface: {
    hard: { court: 0x3470b8, surround: 0x22508f },
    clay: { court: 0xb8552e, surround: 0xa34a28 },
    grass: { court: 0x2f7a45, surround: 0x2a6d3e, stripe: 0x37874f },
  },
  /** Per-surface kits: A wears the colour, B the light kit. No red/orange on clay, no green on grass, no blue on hard. */
  kits: {
    hard: { A: 0xe0473b, B: 0xf4f3ee },
    clay: { A: 0x1f6fd6, B: 0xf4f3ee },
    grass: { A: 0x2c5fd4, B: 0xf4f3ee },
  },
  skin: 0xd9a77f,
  shorts: 0x1d2333,
  shoes: 0xf2f2f2,
  racket: 0x26282c,
  visor: 0x20242a,
} as const;

/** Mannequin rig sizes in metres and its pose angles in radians (ADR-007, ADR-009). */
export const RIG = {
  /** Thigh and shin each; hips stand at twice this. */
  legSegment: 0.45,
  legRadius: 0.07,
  hipHalfWidth: 0.11,
  torsoRadius: 0.19,
  torsoLength: 0.4,
  headRadius: 0.13,
  /** Shoulders above the hips. */
  shoulderHeight: 0.55,
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
  /** How far the hips drop at full crouch, the split-step hop, and the leg swing of a full stride. */
  crouchDrop: 0.22,
  splitStepHop: 0.12,
  gaitSwing: 0.6,
  gaitKnee: 0.5,
  /** Tossing arm roll: hanging at the side, and straight up. */
  leftArm: { down: -1.4, up: 1.35, forward: -0.3 },
  /** Forward lean when running flat out, and the speed (m/s) that counts as flat out. */
  runLean: 0.22,
  runLeanSpeed: 8,
  shadowRadius: 0.45,
} as const;

/** Stands, ad boards and the umpire chair around the surround (Three x across, engine y along the court). */
export const VENUE = {
  /** Inner edge of the side stands (|x|) and end stands (|y|), metres from the centre. */
  sideStandX: 14,
  endStandY: 22,
  /** Side stands run this far along the court each way; end stands fill between the side stands. */
  sideStandHalfLength: 24,
  tiers: 7,
  tierDepth: 1.4,
  tierRise: 0.8,
  boardHeight: 0.9,
  umpireChairX: -7.3,
  umpireChairHeight: 2.2,
  seats: { hard: 0x3b4590, clay: 0x2f6b4a, grass: 0x5b3f8a },
  boards: { hard: 0x15306b, clay: 0x1f5a3a, grass: 0x24502f },
  chair: 0x3b4048,
} as const;
