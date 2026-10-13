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
