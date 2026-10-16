// Render quality tiers for phones (M7, ADR-022). High is the Rally Pop look; low drops what costs most on a weak
// GPU and keeps the game readable.
export const QUALITY = {
  tiers: {
    high: { dprCap: 2, antialias: true, outlines: true, sky: true },
    low: { dprCap: 1.5, antialias: false, outlines: false, sky: false },
  },
  /** Devices with this many logical cores or fewer start on the low tier (antialiasing is fixed at creation). */
  lowCores: 4,
  /** Step down when frames over a `windowSec` stretch average more than `slowMs` (under 30 fps). */
  slowMs: 33,
  windowSec: 2,
  /** Seconds after a (re)load not measured: shader compiles and uploads spike the first frames. */
  warmupSec: 1,
  /** A gap longer than this is a pause (hidden tab, a stall), not a slow frame. */
  pauseSec: 0.25,
} as const;
