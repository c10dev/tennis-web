// Matches shared by the renderer tests: real engine output, so the playback code is checked against what it will play.
import { exhibitionConfig, simulateMatch, type MatchResult, type Surface } from '@tennis/engine';

const cache = new Map<string, MatchResult>();

export function match(seed: number, surface: Surface = 'hard'): MatchResult {
  const key = `${seed}/${surface}`;
  if (!cache.has(key)) cache.set(key, simulateMatch(exhibitionConfig(surface), seed));
  return cache.get(key)!;
}

/** A handful of matches across the three surfaces. */
export const SAMPLE: MatchResult[] = [1, 2, 3, 4, 5, 6].map((seed) => match(seed, (['hard', 'clay', 'grass'] as const)[seed % 3]!));

/** More matches, for rare moments (a lunge, since B2's longer arms reach most balls); simulated on first use. */
export const wideSample = (): MatchResult[] => Array.from({ length: 18 }, (_, k) => match(k + 1, (['hard', 'clay', 'grass'] as const)[(k + 1) % 3]!));
