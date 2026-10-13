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

/** The other broadcast cameras (GDD §8.1), in metres; fov is vertical, degrees. */
export const CAMERAS = {
  /** Behind and to the centre side of the server, so they stand at one side of the frame. */
  serve: { fov: 40, behind: 5, height: 2.3, aside: 1.4, aimHeight: 0.5 },
  reaction: { fov: 32, distance: 4.2, height: 1.75, aside: 1, headHeight: 1.6 },
  /** Wide side shot from beyond the umpire, set back along the court so the chair is not in the middle. */
  side: { fov: 34, x: -19, y: -7, height: 9, replayX: -15, replayHeight: 4, replayFov: 30 },
  hawkeye: { fov: 40, height: 1.3, back: 0.9 },
} as const;
