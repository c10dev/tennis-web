// Art direction B "Rally Pop" (ADR-019): toon shading, ink outlines, the optic ball and its trail, daylight.

export const LOOK = {
  /** Cel shading on court, venue and players; false brings back the M3 Lambert look for comparison. */
  toon: true,
  /** Light level of each cel band (shadow, mid, lit), 0–255: what MeshToonMaterial's gradient map holds. */
  toonBands: [150, 205, 255],
  /** Inverted-hull ink outlines on players, net and ball only: one extra draw per outlined part. */
  outline: {
    colour: 0x15171e,
    /** Width in pixels of a 720-pixel-tall view, whatever the distance or the camera's field of view. */
    px: 1.5,
    referenceHeight: 720,
    /** Rig parts that get a hull (named meshes in MannequinRig); thin ones (handle, visor, feet, hand) do not. */
    rigParts: ['body', 'head', 'racket-head', 'arm-right', 'forearm-right', 'arm-left', 'thigh-left', 'thigh-right', 'shin-left', 'shin-right'],
    /** Ceiling on outline draws for the whole stage: two players, net posts and tape, ball. */
    maxDraws: 24,
  },
} as const;

/** The optic ball (docs/design-references.md §3, ball readability). Sizes in metres, times in seconds of match time. */
export const BALL_LOOK = {
  /** Drawn radius, over three times the real 0.0335 m: ≥ 6 px at the far baseline from the main camera at 720p. */
  radius: 0.11,
  /** Close-ups would make that a beach ball; they draw it smaller. */
  cameraScale: { main: 1, side: 0.8, serve: 0.45, reaction: 0.45, hawkeye: 0.45, chase: 0.8, tell: 0.45, closeup: 0.45 },
  /** On an upright phone the court spans the narrow width, so the ball is drawn this much larger (M7, ADR-022). */
  portraitScale: 1.3,
  shadowOpacity: 0.35,
  /** Scale at contact, easing back to 1 over `sec` (about two frames at 30 fps). */
  pop: { scale: 1.3, sec: 0.07 },
  /** White ribbon behind the ball: how far back it reaches, how many samples, its head width (share of the ball's
   * diameter) and opacity; both taper to nothing at the tail. Half-speed replays reach back half as far in match
   * time, so the trail covers the same time on screen. */
  trail: { sec: 0.2, replayShare: 0.5, samples: 12, widthShare: 0.8, opacity: 0.8, colour: 0xffffff },
} as const;

/** A sunny afternoon (ADR-019): sky dome and fog separate the stands from the court; no tone mapping. */
export const DAYLIGHT = {
  sky: { zenith: 0x4f9de0, horizon: 0xd3e8f2, radius: 200 },
  /** Metres from the camera: clear over the court, a light haze on the far stands. */
  fog: { near: 50, far: 200 },
  hemisphere: { sky: 0xe4f1ff, ground: 0x8a7556, intensity: 1.0 },
  /** The sun gives the toon bands their light side; it stands high over the umpire's shoulder. */
  sun: { colour: 0xfff1d8, intensity: 2.0, position: [-20, 40, 15] },
} as const;
