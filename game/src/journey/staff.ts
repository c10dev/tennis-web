// The player's team (ADR-033): a coach, a physio and an agent hired from a market that changes every swing. Quality
// 1–5 buys more effect at a steeper salary; contracts run a few swings; releasing early costs a swing's salary.
import { pick, stream } from '../rng.ts';
import { drawNation, nameFor } from './names.ts';
import type { Group } from './ratings.ts';
import { TEAM } from './tuning.ts';
import type { JourneyState, UserState } from './types.ts';
import type { Care } from './condition.ts';

export type Role = 'coach' | 'physio' | 'agent';
export const ROLES: readonly Role[] = ['coach', 'physio', 'agent'];
export type CoachStyle = 'attack' | 'defense' | 'mind' | 'allround';

export interface Staff {
  id: string;
  role: Role;
  name: string;
  quality: number;
  /** Dollars a swing. */
  salary: number;
  style?: CoachStyle;
}

export interface Hired extends Staff {
  swingsLeft: number;
}

export type Team = Partial<Record<Role, Hired>>;

/** Groups a coach's style works on. */
export const COACH_GROUPS: Record<CoachStyle, Group[]> = {
  attack: ['serve', 'forehand'], defense: ['return', 'physical'], mind: ['mental', 'backhand'], allround: [],
};

/** The team without one role. */
export const withoutRole = (t: Team, role: Role): Team => Object.fromEntries(Object.entries(t).filter(([r]) => r !== role)) as Team;

export const salaryOf = (role: Role, quality: number): number => Math.round((TEAM.salary[role] * quality ** TEAM.salaryPower) / 100) * 100;

/** This swing's market: a few of each role, the same for everyone in a room. */
export function market(s: Pick<JourneyState, 'seed' | 'year' | 'swing'>): Staff[] {
  const rng = stream(s.seed, 'market', s.year, s.swing);
  const taken = new Set<string>();
  const out: Staff[] = [];
  for (const role of ROLES) {
    for (let i = 0; i < TEAM.perRole; i++) {
      const roll = rng.next();
      const quality = TEAM.qualityOdds.findIndex((upTo) => roll < upTo) + 1;
      const nation = drawNation(rng);
      const style = role === 'coach' ? pick(rng, ['attack', 'defense', 'mind', 'allround'] as const) : undefined;
      out.push({ id: `${role}-${s.year}-${s.swing}-${i}`, role, name: nameFor(rng, nation, taken), quality, salary: salaryOf(role, quality), ...(style ? { style } : {}) });
    }
  }
  return out;
}

/** Hires and releases at the start of a swing: a release before the contract ends costs a swing's salary. */
export function changeTeam(u: UserState, s: Pick<JourneyState, 'seed' | 'year' | 'swing'>, hire: readonly string[], release: readonly Role[]): UserState {
  let team: Team = { ...u.team };
  let money = u.money;
  for (const role of release) {
    const h = team[role];
    if (!h) continue;
    if (h.swingsLeft > 0) money -= h.salary;
    team = withoutRole(team, role);
  }
  const offers = market(s);
  for (const id of hire) {
    const st = offers.find((x) => x.id === id);
    if (!st) throw new Error(`No one called ${id} on this swing's market`);
    if (team[st.role]) money -= team[st.role]!.salary;
    team[st.role] = { ...st, swingsLeft: TEAM.contract };
  }
  return { ...u, team, money };
}

/** Growth multiplier and the groups the coach adds to the focus. */
export function coaching(t: Team): { mult: number; groups: Group[] } {
  const c = t.coach;
  if (!c) return { mult: 1, groups: [] };
  return { mult: 1 + TEAM.coachPerQuality * c.quality * (c.style === 'allround' ? TEAM.allroundBonus : 1), groups: COACH_GROUPS[c.style ?? 'allround'] };
}

export function care(t: Team): Care {
  const q = t.physio?.quality ?? 0;
  return { rest: 1 + TEAM.physioRest * q, injury: 1 - TEAM.physioInjury * q };
}

/** The agent's sponsor money a swing and the chance of a wild card into this swing's big events. */
export function agency(t: Team, reputation: number): { sponsor: number; wildcard: number; commission: number } {
  const q = t.agent?.quality ?? 0;
  if (!q) return { sponsor: 0, wildcard: 0, commission: 0 };
  return { sponsor: Math.round(reputation * TEAM.sponsorPerReputation * q), wildcard: Math.min(0.9, TEAM.wildcardPerQuality * q * (0.5 + reputation / 100)), commission: TEAM.commission };
}

/** The swing's wage bill and the contracts a swing shorter; expired staff leave. */
export function payTeam(t: Team): { team: Team; wages: number; left: Hired[] } {
  const team: Team = {};
  const left: Hired[] = [];
  let wages = 0;
  for (const role of ROLES) {
    const h = t[role];
    if (!h) continue;
    wages += h.salary;
    if (h.swingsLeft > 1) team[role] = { ...h, swingsLeft: h.swingsLeft - 1 };
    else left.push(h);
  }
  return { team, wages, left };
}
