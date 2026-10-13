// One number for a player's level: the weighted mean of the ratings the engine uses.
import type { PlayerProfile } from '@tennis/engine';
import { OVERALL_WEIGHTS, type Rated } from '../tuning.ts';

const ENTRIES = Object.entries(OVERALL_WEIGHTS) as [Rated, number][];
const TOTAL = ENTRIES.reduce((a, [, w]) => a + w, 0);

export function overall(p: Pick<PlayerProfile, 'attributes'>): number {
  return ENTRIES.reduce((a, [k, w]) => a + w * p.attributes[k], 0) / TOTAL;
}
