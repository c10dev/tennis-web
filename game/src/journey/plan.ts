// A swing's plan (ADR-033): the events picked on the 12-week calendar and 1–2 groups to train. Checked before it is
// played; automatic plans stand in for missing ones and drive the balance batch.
import { stream } from '../rng.ts';
import { JTIERS, SWINGS, TIER_ORDER, weeksOf, type JEvent } from './calendar.ts';
import { aiFields, eligible, entryOf, rankFor } from './entry.ts';
import { GROUPS, type Group } from './ratings.ts';
import { market, ROLES, type Role } from './staff.ts';
import { SCHEDULE } from './tuning.ts';
import type { JourneyState } from './types.ts';

export interface Plan {
  /** Event ids of the current swing. */
  events: string[];
  focus: Group[];
  /** Staff ids from this swing's market to hire, and roles to release (ADR-033). */
  hire?: string[];
  release?: Role[];
}

/** What is wrong with a plan, as codes (empty when it can be played): unknown:id, stage:id, overlap:id, focus, college. */
export function validatePlan(s: JourneyState, plan: Plan): string[] {
  const errors: string[] = [];
  const events = SWINGS[s.swing]!.events;
  const taken = new Set<number>();
  const u = s.user;
  const picked = plan.events.map((id) => events.find((e) => e.id === id) ?? id);
  for (const ev of picked) {
    if (typeof ev === 'string') {
      errors.push(`unknown:${ev}`);
      continue;
    }
    if (!eligible(ev, u.stage, u.player.age)) errors.push(`stage:${ev.id}`);
    const weeks = weeksOf(ev);
    if (weeks.some((w) => taken.has(w))) errors.push(`overlap:${ev.id}`);
    for (const w of weeks) taken.add(w);
  }
  if (plan.focus.length > 2 || plan.focus.some((g) => !GROUPS.includes(g)) || new Set(plan.focus).size !== plan.focus.length) errors.push('focus');
  if (u.stage === 'college' && plan.events.length > SCHEDULE.collegeEvents) errors.push('college');
  const offers = market(s);
  const hires = (plan.hire ?? []).map((id) => offers.find((x) => x.id === id) ?? id);
  const roles = new Set<Role>();
  let cost = 0;
  for (const h of hires) {
    if (typeof h === 'string') errors.push(`hire:${h}`);
    else if (roles.has(h.role)) errors.push(`hire-twice:${h.role}`);
    else {
      roles.add(h.role);
      cost += h.salary;
    }
  }
  if (cost > 0 && cost > u.money) errors.push('money');
  for (const r of plan.release ?? []) if (!ROLES.includes(r) || !u.team[r]) errors.push(`release:${r}`);
  return errors;
}

export type AutoStyle = 'smart' | 'busy' | 'light' | 'random';

/**
 * A plan made for the player: `smart` takes the biggest events it gets into with a free week after every two,
 * `busy` everything that fits, `light` the two biggest, `random` a seeded handful.
 */
export function autoPlan(s: JourneyState, style: AutoStyle, focus: Group[], salt = 0): Plan {
  const { fields, proPlace, jrPlace } = aiFields(s);
  const p = s.user.player;
  const open = SWINGS[s.swing]!.events.filter((ev) => {
    if (!eligible(ev, s.user.stage, p.age)) return false;
    const entry = entryOf(ev, rankFor(s, ev, p), fields.get(ev.id)!, JTIERS[ev.tier].junior ? jrPlace : proPlace, s.user.wildcard);
    return entry === 'direct' || (style !== 'smart' && entry === 'qualifying');
  });
  const big = (ev: JEvent) => TIER_ORDER.indexOf(ev.tier);
  const rng = stream(s.seed, 'auto-plan', s.year, s.swing, salt);
  const ordered = style === 'random' ? open.map((ev) => ({ ev, r: rng.next() })).sort((a, b) => a.r - b.r).map((x) => x.ev)
    : [...open].sort((a, b) => big(a) - big(b) || a.week - b.week || (a.id < b.id ? -1 : 1));
  const cap = s.user.stage === 'college' ? SCHEDULE.collegeEvents : { smart: 5, busy: 8, light: 2, random: 1 + Math.floor(rng.next() * 6) }[style];
  const chosen: JEvent[] = [];
  const used = new Set<number>();
  for (const ev of ordered) {
    if (chosen.length >= cap) break;
    const weeks = weeksOf(ev);
    if (weeks.some((w) => used.has(w))) continue;
    if (style === 'smart' && weeks.some((w) => used.has(w - 1) && used.has(w - 2))) continue;
    if (style === 'smart' && weeks.some((w) => used.has(w + 1) && used.has(w + 2))) continue;
    chosen.push(ev);
    for (const w of weeks) used.add(w);
  }
  return { events: chosen.sort((a, b) => a.week - b.week).map((e) => e.id), focus };
}
