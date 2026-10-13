// Public API of the engine. Consumers (CLI, renderer, UI) import from here only.
export { createConfig, DEFAULT_TACTIC, simulateMatch } from './match/simulateMatch.ts';
export { computeStats } from './match/stats.ts';
export { averagePlayer, bigServer, playerWith } from './player/presets.ts';
export { createRng, deriveSeed } from './rng/mulberry32.ts';
export { formatPoints, formatScore } from './scoring/format.ts';
export * from './types.ts';
