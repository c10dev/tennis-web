// Renderer constants: playback pacing, ball look, rig sizes, colours and camera.
// Engine tuning stays in engine/src/tuning.ts; nothing here can change a match result (ADR-007).

/** Seconds of replay time. Real tennis pauses ~25 s between points; the broadcast compresses them. */
export const PLAYBACK = {
  /** Toss before each serve: the ball leaves the hand this long before contact. */
  tossLeadSec: 1.0,
  pointGapSec: 2.5,
  changeoverSec: 6,
  setEndSec: 8,
  matchEndHoldSec: 3,
  speeds: [0.25, 0.5, 1, 2, 4] as const,
  /** Longest real-time step one tick may advance; a stalled or hidden tab resumes instead of jumping. */
  maxTickSec: 0.25,
  /** "Previous point" within this long of a point's start goes to the point before it. */
  prevPointGraceSec: 1,
} as const;

/** Net tape height in metres (ITF): the ball's clearance is measured from the centre. */
export const NET = { centerHeight: 0.914, postHeight: 1.07 } as const;

export const BALL = {
  radius: 0.0335,
  /** Drawn radius: about twice the real one, so the ball reads from the main camera ~30 m away. */
  visualRadius: 0.06,
  gravity: 9.81,
  /** Height of the tossing hand when a serve's toss starts. */
  tossStartHeight: 1.1,
  /** A ball that ends a rally (or a fault) stays visible this long after it lands or hits the net. */
  rollSec: 0.8,
  /** Share of the flight's ground speed kept after the last bounce. */
  rollSpeedRetain: 0.6,
  /** Height of the hop after the last bounce: clay bounces high, grass low (GDD §5.2). */
  hopApex: { hard: 0.9, clay: 1.15, grass: 0.55 },
  /** Extra bow on a ball flying into the net, in metres at mid-flight. */
  netArc: 0.3,
  /** A ball stopped by the net falls this far in front of it, on the hitter's side. */
  netDropOffset: 0.08,
} as const;

/** Player motion read off the events: swing windows around contact, reactions, sanity bound for tests. */
export const RIG_MOTION = {
  /** Seconds before and after contact a swing lasts; contact is half-way. A serve starts with the toss. */
  swing: { stroke: { pre: 0.3, post: 0.3 }, serve: { pre: 0.6, post: 0.35 } },
  /** Seconds a player celebrates or hangs their head after the last ball lands (cut short by the next point). */
  reactionSec: 1.8,
  /** Window for the finite-difference running speed. */
  speedSampleSec: 0.05,
  /** No player moves further than this between two 60 fps frames, except the cut at a change of ends. */
  maxStepPerFrame: 0.5,
} as const;

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

/** Main (TV) camera, in Three coordinates: fixed behind the near end, panning gently with the ball (GDD §8.1). */
export const CAMERA = {
  /** Vertical field of view; widened on narrow screens so the horizontal view never drops below minHorizontalFov. */
  fov: 30,
  minHorizontalFov: 46,
  height: 13,
  /** Distance behind the near baseline. */
  behindBaseline: 18,
  /** Where it looks along the court (Three z; the near half is positive). */
  lookZ: 3.2,
  /** Share of the ball's x the aim follows, the most it moves, and how much of that the camera body follows. */
  panFollow: 0.35,
  maxPan: 1.8,
  positionPanShare: 0.4,
  /** Seconds for the pan to close ~63% of the gap to its target. */
  panTimeConstant: 0.6,
} as const;
