// What the plan screen shows before a swing (ADR-033): for each event, whether the player gets in, the points they
// defend from last year, and for a whole plan the fatigue it builds week by week. Estimates only: nothing is drawn.
import { JTIERS, SWINGS, SWING_WEEKS, weeksOf, type JEvent } from './calendar.ts';
import { NO_CARE, type Care } from './condition.ts';
import { aiFields, eligible, entryOf, qualifyChance, rankFor, type Entry } from './entry.ts';
import type { Plan } from './plan.ts';
import { SCHEDULE } from './tuning.ts';
import type { JourneyState } from './types.ts';

export interface EventForecast {
  event: JEvent;
  allowed: boolean;
  entry: Entry;
  /** Chance through qualifying (entry 'qualifying'). */
  qualify: number;
  /** Points won at this event a year ago, which drop off when it is played again. */
  defending: number;
}

export function forecast(s: JourneyState): EventForecast[] {
  const { fields, proPlace, jrPlace } = aiFields(s);
  const p = s.user.player;
  const lastYear = s.reports.filter((r) => r.year === s.year - 1 && r.swing === s.swing).flatMap((r) => r.events);
  return SWINGS[s.swing]!.events.map((ev) => {
    const entry = entryOf(ev, rankFor(s, ev, p), fields.get(ev.id)!, JTIERS[ev.tier].junior ? jrPlace : proPlace, s.user.wildcard);
    return {
      event: ev, allowed: eligible(ev, s.user.stage, p.age), entry,
      qualify: entry === 'qualifying' ? qualifyChance(ev, p) : entry === 'direct' ? 1 : 0,
      defending: lastYear.find((e) => e.id === ev.id)?.points ?? 0,
    };
  });
}

export interface FatigueForecast {
  /** Fatigue at the end of each week, 1–12 (index 0 is week 1). */
  byWeek: number[];
  peak: number;
  risk: 'low' | 'medium' | 'high';
}

/** Fatigue a plan would build, assuming `matchesPerEvent` matches at each event. */
export function fatigueForecast(s: JourneyState, plan: Plan, care: Care = NO_CARE, matchesPerEvent = 2): FatigueForecast {
  const events = SWINGS[s.swing]!.events.filter((e) => plan.events.includes(e.id)).sort((a, b) => a.week - b.week);
  let f = s.user.player.fatigue;
  let last: JEvent | null = null;
  const byWeek: number[] = [];
  for (let w = 1; w <= SWING_WEEKS; w++) {
    const ev = events.find((e) => e.week === w);
    if (ev) {
      const back = last && weeksOf(last).at(-1) === w - 1 ? SCHEDULE.backToBack : 0;
      const travel = last && last.region !== ev.region ? SCHEDULE.travel : 0;
      f = Math.min(1, f + SCHEDULE.perEvent * ev.weeks + SCHEDULE.perMatch * matchesPerEvent + back + travel);
      last = ev;
    } else if (!events.some((e) => weeksOf(e).includes(w))) {
      f = Math.max(0, f - SCHEDULE.rest * care.rest);
    }
    byWeek.push(Math.round(f * 100) / 100);
  }
  const peak = Math.max(...byWeek);
  return { byWeek, peak, risk: peak >= 0.55 ? 'high' : peak >= 0.35 ? 'medium' : 'low' };
}
