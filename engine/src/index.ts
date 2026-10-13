// Public API of the engine. Consumers (CLI, renderer, UI) import from here only.
export { createConfig, DEFAULT_TACTIC, simulateMatch } from './match/simulateMatch.ts';
export { addMetrics, emptyMetrics, matchMetrics, runBatch, summarize, type Metrics, type Summary } from './match/metrics.ts';
export { computeStats } from './match/stats.ts';
export { averagePlayer, bigServer, playerWith, ratedPlayer } from './player/presets.ts';
export { createRng, deriveSeed } from './rng/mulberry32.ts';
export { formatPoints, formatScore } from './scoring/format.ts';
export * from './types.ts';
