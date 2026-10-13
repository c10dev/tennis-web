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
} as const;

/** Net tape height in metres (ITF): the ball's clearance is measured from the centre. */
export const NET = { centerHeight: 0.914, postHeight: 1.07 } as const;

export const BALL = {
  radius: 0.0335,
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
