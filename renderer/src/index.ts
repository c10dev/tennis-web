// Public API of the renderer: turns a MatchResult into frames and draws them with Three.js (GDD §8).
// It reads engine data through @tennis/engine's index only and never imports ui/.
export { SUPPORTED_SCHEMA_VERSION } from './version.ts';
export { buildTimeline, scoreAt, segmentAt, type GapKind, type PointSegment, type Timeline } from './playback/timeline.ts';
export { PLAYBACK } from './tuning.ts';
