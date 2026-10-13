// Public API of the renderer: turns a MatchResult into frames and draws them with Three.js (GDD §8).
// It reads engine data through @tennis/engine's index only and never imports ui/.

/** The event schema this renderer understands (ShotEvent.flightSec arrived in v2); other versions are rejected. */
export const SUPPORTED_SCHEMA_VERSION = 2;
