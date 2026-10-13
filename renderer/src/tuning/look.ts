// Art direction B "Rally Pop" (ADR-018): toon shading, ink outlines, the optic ball and its trail, daylight.

export const LOOK = {
  /** Cel shading on court, venue and players; false brings back the M3 Lambert look for comparison. */
  toon: true,
  /** Light level of each cel band (shadow, mid, lit), 0–255: what MeshToonMaterial's gradient map holds. */
  toonBands: [110, 190, 255],
} as const;
