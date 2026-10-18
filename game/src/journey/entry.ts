// Who plays what in a swing (ADR-032/033): AI pros and juniors enter by their place and the tier's band and chance,
// one event a week; humans enter the events their plan names, by ranking, through qualifying, or on a wild card;
// unnamed players fill what is left of a draw.
import type { Rng } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { stream } from '../rng.ts';
import { JTIERS, SWINGS, weeksOf, type JEvent } from './calendar.ts';
import { order, rankOf } from './ranking.ts';
import { SCHEDULE } from './tuning.ts';
import type { JourneyState, JPlayer, Stage, WorldState } from './types.ts';

export type Entry = 'direct' | 'qualifying' | 'out';

export interface Fields {
  /** AI entrants of each event, best first. */
  fields: Map<string, JPlayer[]>;
  proPlace: Map<string, number>;
  jrPlace: Map<string, number>;
}

const places = (ids: readonly string[]) => new Map(ids.map((pid, i) => [pid, i + 1]));

/** Every event's AI field for the swing about to be played: events in week order, nobody in two events at once. */
export function aiFields(s: WorldState): Fields {
  const key = `${s.year}/${s.swing}`;
  const proPlace = places(order(s.pros, s.points));
  const jrPlace = places(order(s.juniors, s.juniorPoints));
  const busy = new Map<string, Set<number>>();
  const fields = new Map<string, JPlayer[]>();
  const events = [...SWINGS[s.swing]!.events].sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : 1));
  for (const ev of events) {
    const spec = JTIERS[ev.tier];
    const rng = stream(s.seed, 'entry', key, ev.id);
    const place = spec.junior ? jrPlace : proPlace;
    const [from, to] = spec.band;
    const weeks = weeksOf(ev);
    const field = (spec.junior ? s.juniors : s.pros)
      .filter((p) => {
        const at = place.get(p.id) ?? Number.MAX_SAFE_INTEGER;
        if (at < from || at > to || weeks.some((w) => busy.get(p.id)?.has(w)) || rng.next() >= spec.chance) return false;
        return true;
      })
      .sort((a, b) => (place.get(a.id) ?? 1e9) - (place.get(b.id) ?? 1e9) || (a.id < b.id ? -1 : 1));
    const taken = ev.tier === 'finals' ? [] : field.slice(0, spec.draw);
    for (const p of taken) for (const w of weeks) busy.set(p.id, (busy.get(p.id) ?? new Set()).add(w));
    fields.set(ev.id, taken);
  }
  return { fields, proPlace, jrPlace };
}

/** Events a player at this stage and age may put in a plan (the Finals come by ranking, never by plan). */
export function eligible(ev: JEvent, stage: Stage, age: number): boolean {
  if (ev.tier === 'finals') return false;
  if (stage === 'junior') return JTIERS[ev.tier].junior || (ev.tier === 'futures' && age >= SCHEDULE.juniorFuturesFrom);
  if (stage === 'college') return ev.tier === 'futures';
  return !JTIERS[ev.tier].junior;
}

/** How a player at `rank` gets into an event whose AI field is `field`: straight in, through qualifying (challengers
 * and 250s), or not at all. Futures and junior internationals always find a place. */
export function entryOf(ev: JEvent, rank: number | null, field: readonly JPlayer[], place: ReadonlyMap<string, number>, wildcard = false): Entry {
  if (ev.tier === 'futures' || ev.tier === 'jr') return 'direct';
  const ahead = rank === null ? field.length : field.filter((p) => (place.get(p.id) ?? 1e9) < rank).length;
  if (ahead < JTIERS[ev.tier].draw) return 'direct';
  if (wildcard && (ev.tier === 'major' || ev.tier === 'masters')) return 'direct';
  return ev.tier === 'challenger' || ev.tier === 't250' ? 'qualifying' : 'out';
}

/** The human's ranking for an event's tour (junior events use the junior ranking). */
export function rankFor(s: JourneyState, ev: JEvent, p: JPlayer): number | null {
  return JTIERS[ev.tier].junior ? rankOf(p, s.juniors, s.juniorPoints) : rankOf(p, s.pros, s.points);
}

/** Chance to come through qualifying, by level over the tier's unnamed players. */
export function qualifyChance(ev: JEvent, p: JPlayer): number {
  const [lo, hi] = SCHEDULE.qualifyRange;
  return Math.min(hi, Math.max(lo, SCHEDULE.qualifyBase + SCHEDULE.qualifyPerLevel * (overall(p) - JTIERS[ev.tier].filler[0])));
}

export const qualifies = (ev: JEvent, p: JPlayer, rng: Rng): boolean => rng.next() < qualifyChance(ev, p);
