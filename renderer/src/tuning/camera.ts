// Camera placement and movement (GDD §8.1).

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
