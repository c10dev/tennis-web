// Art direction B "Rally Pop" (ADR-018): toon shading, ink outlines, the optic ball and its trail, daylight.

export const LOOK = {
  /** Cel shading on court, venue and players; false brings back the M3 Lambert look for comparison. */
  toon: true,
  /** Light level of each cel band (shadow, mid, lit), 0–255: what MeshToonMaterial's gradient map holds. */
  toonBands: [110, 190, 255],
} as const;

/** The optic ball (docs/design-references.md §3, ball readability). Sizes in metres, times in seconds of match time. */
export const BALL_LOOK = {
  /** Drawn radius, over three times the real 0.0335 m: ≥ 6 px at the far baseline from the main camera at 720p. */
  radius: 0.11,
  /** Close-ups would make that a beach ball; they draw it smaller. */
  cameraScale: { main: 1, side: 0.8, serve: 0.45, reaction: 0.45, hawkeye: 0.45 },
  shadowOpacity: 0.35,
  /** Scale at contact, easing back to 1 over `sec` (about two frames at 30 fps). */
  pop: { scale: 1.3, sec: 0.07 },
  /** White ribbon behind the ball: how far back it reaches, how many samples, its head width (share of the ball's
   * diameter) and opacity; both taper to nothing at the tail. */
  trail: { sec: 0.2, samples: 12, widthShare: 0.8, opacity: 0.8, colour: 0xffffff },
} as const;
