// Growth and condition over a swing (ADR-032). A swing's gain in overall comes from age, room below potential and
// how the swing was spent (coach, load, morale, matches); from 29 everyone declines. Pure functions.
import type { Rng } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { stream } from '../rng.ts';
import { applyGain, trueLevel, type Group } from './ratings.ts';
import { GROWTH_J, LOADS } from './tuning.ts';
import type { JPlayer, Load } from './types.ts';

/** Gain before multipliers, for a player of this age with this much room below potential. */
export function baseGain(age: number, level: number, potential: number): number {
  const [, rate] = GROWTH_J.byAge.find(([upTo]) => age <= upTo)!;
  const room = Math.min(1, Math.max(0, (potential - level) / GROWTH_J.headroom));
  return rate * room;
}

export const decline = (age: number): number => Math.max(0, age - GROWTH_J.declineFrom + 1) * GROWTH_J.declinePerYear;

export interface UserSwing {
  coach: 0 | 1 | 2;
  load: Load;
  morale: number;
  matches: number;
  injured: boolean;
  focus: readonly Group[];
}

/** The user's growth over a swing. */
export function growUser(p: JPlayer, s: UserSwing): JPlayer {
  const mult = GROWTH_J.coach[s.coach] * LOADS.training[s.load] * (GROWTH_J.moraleBase + GROWTH_J.moraleSpan * s.morale / 100)
    * (GROWTH_J.playBase + GROWTH_J.playSpan * Math.min(1, s.matches / GROWTH_J.playFull)) * (s.injured ? GROWTH_J.injured : 1);
  const gain = baseGain(p.age, trueLevel(p), p.potential) * mult - decline(p.age);
  return applyGain(p, gain, s.focus);
}

/** An AI player's growth over a swing: a talent factor drawn per player and year. */
export function growAi(p: JPlayer, seed: number, year: number): JPlayer {
  const rng = stream(seed, 'ai-growth', year, p.id);
  const talent = 1 + GROWTH_J.aiSpread * (2 * rng.next() - 1);
  const gain = baseGain(p.age, overall(p), p.potential) * talent - decline(p.age);
  return applyGain(p, gain, []);
}

/** Fatigue after a swing of `matches` at `load`, carrying some of the last. */
export const nextFatigue = (fatigue: number, load: Load, matches: number, injured: boolean): number =>
  injured ? 0 : Math.min(1, fatigue * LOADS.carry + LOADS.fatigue[load] + matches * LOADS.fatiguePerMatch);

/** Swings out with an injury picked up this swing (0 none). */
export function injury(rng: Rng, p: JPlayer, load: Load, fatigue: number): number {
  const age = p.age >= LOADS.injuryAgeFrom ? LOADS.injuryAgeFactor : 1;
  const chance = LOADS.injury[load] * (0.6 + fatigue) * (p.attributes.injuryProneness / 10) * age;
  if (rng.next() >= chance) return 0;
  const roll = rng.next();
  return LOADS.injurySwings.find(([upTo]) => roll < upTo)![1];
}
