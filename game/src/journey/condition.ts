// A human's condition through a swing's 12 weeks (ADR-033): free weeks recover, events tire (more back to back and
// across regions), and every event played can end in an injury. Pure: condition in, condition out.
import type { Rng } from '@tennis/engine';
import { SWING_WEEKS, type JEvent, type Region } from './calendar.ts';
import { SCHEDULE } from './tuning.ts';
import type { JPlayer } from './types.ts';

/** What a physio changes: recovery in free weeks and injury risk (1 = no physio). */
export interface Care {
  rest: number;
  injury: number;
}

export const NO_CARE: Care = { rest: 1, injury: 1 };

export interface Condition {
  fatigue: number;
  /** Next week not yet accounted for (1–13). */
  week: number;
  lastEnd: number | null;
  lastRegion: Region | null;
  weeksPlayed: number;
  matches: number;
  /** Swings out from an injury picked up this swing (0 none); once hurt, the swing's other events are skipped. */
  hurt: number;
}

export const startCondition = (fatigue: number): Condition =>
  ({ fatigue, week: 1, lastEnd: null, lastRegion: null, weeksPlayed: 0, matches: 0, hurt: 0 });

/** Free weeks up to (not including) `week` recover. */
export function restUntil(c: Condition, week: number, care: Care = NO_CARE): Condition {
  let fatigue = c.fatigue;
  for (let w = c.week; w < week; w++) fatigue = Math.max(0, fatigue - SCHEDULE.rest * care.rest);
  return { ...c, fatigue, week: Math.max(c.week, week) };
}

/** After playing `ev` with `matches` matches: fatigue added, the weeks used, an injury roll. */
export function afterEvent(c: Condition, ev: JEvent, matches: number, p: JPlayer, rng: Rng, care: Care = NO_CARE): Condition {
  const back = c.lastEnd !== null && c.lastEnd === ev.week - 1 ? SCHEDULE.backToBack : 0;
  const travel = c.lastRegion !== null && c.lastRegion !== ev.region ? SCHEDULE.travel : 0;
  const fatigue = Math.min(1, c.fatigue + SCHEDULE.perEvent * ev.weeks + SCHEDULE.perMatch * matches + back + travel);
  const age = p.age >= SCHEDULE.injuryAgeFrom ? SCHEDULE.injuryAgeFactor : 1;
  const chance = SCHEDULE.injury * (0.5 + 2 * fatigue) * (p.attributes.injuryProneness / 10) * age * care.injury;
  const roll = rng.next();
  const length = rng.next();
  const hurt = roll < chance ? SCHEDULE.injurySwings.find(([upTo]) => length < upTo)![1] : 0;
  const end = ev.week + ev.weeks - 1;
  return { ...c, fatigue, week: end + 1, lastEnd: end, lastRegion: ev.region, weeksPlayed: c.weeksPlayed + ev.weeks, matches: c.matches + matches, hurt };
}

export interface SwingEnd {
  /** Fatigue carried into the next swing. */
  fatigue: number;
  trainWeeks: number;
  matches: number;
  hurt: number;
}

export function endSwing(c: Condition, care: Care = NO_CARE): SwingEnd {
  const rested = restUntil(c, SWING_WEEKS + 1, care);
  return { fatigue: rested.fatigue * SCHEDULE.carry, trainWeeks: SWING_WEEKS - c.weeksPlayed, matches: c.matches, hurt: c.hurt };
}
