// A player's week (GDD §9.3): training growth, matches, rest, fatigue, injuries and aging. Pure: player in,
// player out. It always makes two random draws, whatever the week was, so streams never shift.
import type { Rng } from '@tennis/engine';
import { AGING, CONDITION, FOCUS_RATINGS, INJURY, OVERALL_WEIGHTS, TRAINING, type Rated } from '../tuning.ts';
import type { CareerPlayer } from '../types.ts';
import { overall } from './overall.ts';

export type Focus = keyof typeof FOCUS_RATINGS;
export type Intensity = keyof typeof TRAINING.rate;
export type WeekActivity =
  | { kind: 'train'; focus: Focus; intensity: Intensity }
  | { kind: 'rest' }
  | { kind: 'tournament'; sets: number; travelled: boolean };

const RATED = Object.keys(OVERALL_WEIGHTS) as Rated[];

export const canPlay = (p: CareerPlayer): boolean => p.injuryWeeks === 0;

/** Starting fatigue for the engine (MatchConfig.condition). */
export const matchFatigue = (p: CareerPlayer): number => Math.min(1, p.fatigue * CONDITION.toMatch);

export function endWeek(p: CareerPlayer, week: WeekActivity, rng: Rng): CareerPlayer {
  if (p.injuryWeeks > 0 && week.kind !== 'rest') throw new Error(`${p.name} is injured and can only rest`);
  const roll = rng.next();
  const length = rng.next();
  const out: CareerPlayer = { ...p, attributes: { ...p.attributes }, progress: { ...p.progress } };
  const ageFactor = TRAINING.age.find(([upTo]) => p.age <= upTo)![1];
  const headroom = Math.min(1, Math.max(0, (p.potential - overall(p)) / TRAINING.headroom));
  const grow = (k: Rated, rate: number) => adjust(out, k, rate * ageFactor * headroom);

  if (week.kind === 'train') {
    const focus: readonly Rated[] = FOCUS_RATINGS[week.focus];
    const rate = TRAINING.rate[week.intensity];
    for (const k of RATED) grow(k, focus.includes(k) ? rate : rate * TRAINING.spill);
  } else if (week.kind === 'tournament') {
    for (const k of RATED) grow(k, TRAINING.matchRate);
  }
  if (p.age >= AGING.from) for (const k of RATED) adjust(out, k, -AGING.weekly * (p.age - AGING.from + 1));

  const added = week.kind === 'train' ? CONDITION.train[week.intensity]
    : week.kind === 'tournament' ? week.sets * CONDITION.perSet + (week.travelled ? CONDITION.travel : 0)
      : -CONDITION.rest;
  out.fatigue = clamp01(p.fatigue + added - CONDITION.weekly);

  if (p.injuryWeeks > 0) out.injuryWeeks = p.injuryWeeks - 1;
  else {
    const load = INJURY.load[week.kind === 'train' ? week.intensity : week.kind];
    const chance = INJURY.base * load * (1 + INJURY.fatigueWeight * out.fatigue) * (p.attributes.injuryProneness / 10);
    if (roll < chance) out.injuryWeeks = INJURY.weeks[0] + Math.floor(length * (INJURY.weeks[1] - INJURY.weeks[0] + 1));
  }
  return out;
}

/** Adds progress to a rating, turning every whole point into a rating change, within 1–20. */
function adjust(p: CareerPlayer, k: Rated, delta: number): void {
  let progress = (p.progress[k] ?? 0) + delta;
  let rating = p.attributes[k];
  while (progress >= 1 && rating < 20) {
    rating++;
    progress--;
  }
  while (progress <= -1 && rating > 1) {
    rating--;
    progress++;
  }
  if (rating === 20) progress = Math.min(progress, 0);
  if (rating === 1) progress = Math.max(progress, 0);
  p.attributes[k] = rating;
  p.progress[k] = progress;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
