import type { PlayerAttributes, Surface } from '../types.ts';

export const RATING_MIN = 1;
export const RATING_MAX = 20;

/** Ratings normalised to 0–1 (1 → 0, 20 → 1). */
export type NormalizedAttributes = PlayerAttributes;

export function normalize(rating: number): number {
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    throw new RangeError(`Rating must be a whole number ${RATING_MIN}–${RATING_MAX}, got ${rating}`);
  }
  return (rating - RATING_MIN) / (RATING_MAX - RATING_MIN);
}

export function validateAttributes(attributes: PlayerAttributes): void {
  normalizeAttributes(attributes);
}

export function normalizeAttributes(attributes: PlayerAttributes): NormalizedAttributes {
  const { surfaceAffinity, ...ratings } = attributes;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(ratings)) out[key] = named(key, value);
  const affinity = {} as Record<Surface, number>;
  for (const surface of Object.keys(surfaceAffinity) as Surface[]) {
    affinity[surface] = named(`surfaceAffinity.${surface}`, surfaceAffinity[surface]);
  }
  return { ...(out as Omit<PlayerAttributes, 'surfaceAffinity'>), surfaceAffinity: affinity };
}

function named(key: string, value: number): number {
  try {
    return normalize(value);
  } catch (e) {
    throw new RangeError(`${key}: ${(e as Error).message}`, { cause: e });
  }
}
