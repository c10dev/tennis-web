// Public API of the renderer: turns a MatchResult into frames and draws them with Three.js (GDD §8).
// It reads engine data through @tennis/engine's index only and never imports ui/.
import { SCHEMA_VERSION } from '@tennis/engine';

/** The event schema this renderer understands; replays written with another version are rejected. */
export const SUPPORTED_SCHEMA_VERSION = SCHEMA_VERSION;
