// Growth and condition over a swing (ADR-032). A swing's gain in overall comes from age, room below potential and
// how the swing was spent (coach, morale, matches, free weeks); from 29 everyone declines. Pure functions.
import { overall } from '../player/overall.ts';
import { stream } from '../rng.ts';
import { applyGain, trueLevel, type Group } from './ratings.ts';
import { GROWTH_J, SCHEDULE } from './tuning.ts';
import type { JPlayer } from './types.ts';

/** Gain before multipliers, for a player of this age with this much room below potential. */
export function baseGain(age: number, level: number, potential: number): number {
  const [, rate] = GROWTH_J.byAge.find(([upTo]) => age <= upTo)!;
  const room = Math.min(1, Math.max(0, (potential - level) / GROWTH_J.headroom));
  return rate * room;
}

export const decline = (age: number): number => Math.max(0, age - GROWTH_J.declineFrom + 1) * GROWTH_J.declinePerYear;

export interface UserSwing {
  /** The coach's growth multiplier and the groups they add to the focus. */
  coach: { mult: number; groups: readonly Group[] };
  morale: number;
  matches: number;
  /** Weeks of the swing without an event. */
  trainWeeks: number;
  injured: boolean;
  focus: readonly Group[];
}

/** The user's growth over a swing: matches teach, free weeks train, and neither alone is enough. */
export function growUser(p: JPlayer, s: UserSwing): JPlayer {
  const mult = s.coach.mult * (GROWTH_J.moraleBase + GROWTH_J.moraleSpan * s.morale / 100)
    * (GROWTH_J.playBase + GROWTH_J.playSpan * Math.min(1, s.matches / SCHEDULE.playFull))
    * (GROWTH_J.trainBase + GROWTH_J.trainSpan * Math.min(1, s.trainWeeks / SCHEDULE.trainFull)) * (s.injured ? GROWTH_J.injured : 1);
  const gain = baseGain(p.age, trueLevel(p), p.potential) * mult - decline(p.age);
  return applyGain(p, gain, [...new Set([...s.focus, ...s.coach.groups])]);
}

/** An AI player's growth over a swing: a talent factor drawn per player and year. */
export function growAi(p: JPlayer, seed: number, year: number): JPlayer {
  const rng = stream(seed, 'ai-growth', year, p.id);
  const talent = 1 + GROWTH_J.aiSpread * (2 * rng.next() - 1);
  const gain = baseGain(p.age, overall(p), p.potential) * talent - decline(p.age);
  return applyGain(p, gain, []);
}
