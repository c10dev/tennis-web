// The demo match the CLI fingerprint and the replay page share, so both can be compared seed for seed.
import { averagePlayer, bigServer } from '../player/presets.ts';
import type { MatchConfig, Surface } from '../types.ts';
import { createConfig } from './simulateMatch.ts';

/** Big server Flint (A) against the average Rook (B), best of 3, A serving first. */
export function exhibitionConfig(surface: Surface): MatchConfig {
  return createConfig([bigServer('Flint'), averagePlayer('Rook')], { surface });
}
