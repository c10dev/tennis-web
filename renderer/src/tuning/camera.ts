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
  /** At this aspect (width / height) and wider the main camera is the TV angle above. */
  landscapeAspect: 1.4,
  /** Close-ups (serve, reaction, hawkeye) keep at least this much across on narrow screens. */
  closeMinHorizontalFov: 32,
  /**
   * A phone held upright (M7, ADR-022), reached at `aspect` and kept narrower: higher and further back, with a frame
   * `horizontalFov` across, so the doubles court and both players fit the stage's width (searched over 0.7–0.85
   * aspects at every pan; the far ball can then be no wider than about 3.7 px on a 412 px stage, hence
   * BALL_LOOK.portraitScale). Between the two aspects the camera moves smoothly from the TV angle.
   */
  portrait: { aspect: 0.82, height: 22, behindBaseline: 23, lookZ: 5.5, horizontalFov: 27 },
} as const;

/** The other broadcast cameras (GDD §8.1), in metres; fov is vertical, degrees. */
export const CAMERAS = {
  /** Behind and to the centre side of the server, so they stand at one side of the frame. */
  serve: { fov: 40, behind: 5, height: 2.3, aside: 1.4, aimHeight: 0.5 },
  reaction: { fov: 32, distance: 4.2, height: 1.75, aside: 1, headHeight: 1.6 },
  /** Wide side shot from beyond the umpire, set back along the court so the chair is not in the middle. */
  side: { fov: 34, x: -19, y: -7, height: 9, replayX: -15, replayHeight: 4, replayFov: 30 },
  hawkeye: { fov: 40, height: 1.3, back: 0.9 },
  /** Game cameras (ADR-024): the tell (M2), low between the opponent and the net, aimed at their chest; the close-up
   * (M5), front three-quarter at head height. Metres from the player towards the net and to one side. */
  tell: { fov: 34, toNet: 6.3, aside: 1.8, height: 1.5, aimHeight: 0.95 },
  closeup: { fov: 34, toNet: 3.9, aside: 1.5, height: 1.4, aimHeight: 1.3 },
} as const;

/**
 * The game camera K2 (ADR-024, docs/3d-redesign.md §3): `behind` m behind my player and `height` up, `myShare` of my
 * x followed, aimed `aim` m down the court from the camera; it follows my depth, so it
 * moves in with me to the net and back with me behind the baseline. Its inputs
 * are averaged over ± `windowSec` of replay time with a smoothstep kernel, so it is smooth and closed-form in time.
 */
export const CHASE = {
  height: 6.2,
  behind: 7.4,
  aim: 15.8,
  /** The ball is not followed: it appears and vanishes, which a windowed average turns into a jump. */
  myShare: 0.75,
  /** Share of the camera's x the aim point keeps (the view leans in towards the centre). */
  aimShare: 0.6,
  /** Vertical field of view on an upright phone (up to a square view) and on a wide screen. */
  fov: { portrait: 48, landscape: 36 },
  windowSec: 0.4,
  samples: 9,
} as const;
