// The user's player (GDD §9.1): a name, a style and ratings spread over a fixed budget.
import type { PlayerAttributes } from '@tennis/engine';
import { stream, uniform } from '../rng.ts';
import { CREATION, EDITABLE, OVERALL_WEIGHTS, PRIMARY, STYLES, type Rated } from '../tuning.ts';
import type { CareerPlayer } from '../types.ts';

export type CreatableStyle = keyof typeof STYLES;
export type Allocation = Record<Rated, number>;

export interface NewPlayer {
  name: string;
  style: CreatableStyle;
  allocation: Partial<Allocation>;
}

export const USER_ID = 'user';

/** A sensible starting spread for a style: rated skills at one level, unused ones lower, plus the style template. */
export function defaultAllocation(style: CreatableStyle): Allocation {
  const out = {} as Allocation;
  for (const k of EDITABLE) {
    const { primary, rated, unused } = CREATION.suggested;
    const base = PRIMARY.includes(k) ? primary : k in OVERALL_WEIGHTS ? rated : unused;
    out[k] = Math.min(CREATION.max, Math.max(CREATION.min, base + (STYLES[style][k] ?? 0)));
  }
  return out;
}

export function createPlayer(input: NewPlayer, seed: number): CareerPlayer {
  const name = input.name.trim();
  if (!name) throw new Error('The player needs a name');
  const allocation = { ...defaultAllocation(input.style), ...input.allocation };
  let spent = 0;
  for (const k of EDITABLE) {
    const v = allocation[k];
    if (!Number.isInteger(v) || v < CREATION.min || v > CREATION.max) throw new RangeError(`${k} must be a whole number from ${CREATION.min} to ${CREATION.max}`);
    spent += v;
  }
  if (spent > CREATION.budget) throw new RangeError(`Ratings add up to ${spent}, over the budget of ${CREATION.budget}`);
  const s = CREATION.surfaceAffinity;
  const attributes = { ...allocation, injuryProneness: CREATION.injuryProneness, surfaceAffinity: { hard: s, clay: s, grass: s } } as PlayerAttributes;
  const rng = stream(seed, 'user');
  return {
    id: USER_ID, name, style: input.style, attributes, age: CREATION.age,
    potential: Math.round(uniform(rng, CREATION.potential[0], CREATION.potential[1]) * 10) / 10,
    progress: {}, fatigue: 0, injuryWeeks: 0,
  };
}
