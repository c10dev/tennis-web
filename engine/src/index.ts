// Public API of the engine. Consumers (CLI, renderer, UI) import from here only.
export { exhibitionConfig } from './match/exhibition.ts';
export { fingerprint } from './match/fingerprint.ts';
export { advance, finish, isOver, replayMatch, setTactic, startMatch, type LiveMatch } from './match/live.ts';
export { createConfig, DEFAULT_TACTIC, simulateMatch } from './match/simulateMatch.ts';
export { addMetrics, emptyMetrics, matchMetrics, runBatch, summarize, type Metrics, type Summary } from './match/metrics.ts';
export { computeStats } from './match/stats.ts';
export { averagePlayer, bigServer, playerWith, ratedPlayer } from './player/presets.ts';
export { COURT } from './point/court.ts';
export { createRng, deriveSeed } from './rng/mulberry32.ts';
export { formatPoints, formatScore } from './scoring/format.ts';
export * from './types.ts';
