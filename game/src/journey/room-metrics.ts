// Room balance (ADR-033, journey-design.md §7): four-player rooms played for a season by policies, measured.
import { answerAll } from './autoplay.ts';
import { autoPlan, type AutoStyle, type Plan } from './plan.ts';
import { GROUPS, type CreatableStyle, type Group, type Talents } from './ratings.ts';
import { rankOf } from './ranking.ts';
import { assign, view, type Member } from './room.ts';
import { stream } from '../rng.ts';
import { market, ROLES, type Role } from './staff.ts';
import { createRoom } from './start.ts';
import { advanceRoom } from './swing.ts';
import type { JourneyState, RoomState } from './types.ts';

export type StaffPolicy = 'none' | Role | 'mix';

export interface Policy {
  schedule: AutoStyle;
  staff: StaffPolicy;
}

const STYLES: readonly CreatableStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];

/** A member with seeded talents and style. */
export function botMember(seed: number, i: number): Member {
  const rng = stream(seed, 'bot', i);
  const talents: Talents = {};
  for (let k = 0; k < 10; k++) {
    const g = GROUPS[Math.floor(rng.next() * GROUPS.length)]!;
    talents[g] = (talents[g] ?? 0) + 1;
  }
  const focus = [GROUPS[Math.floor(rng.next() * GROUPS.length)]!] as Group[];
  return { id: `bot${i}`, name: `선수${i + 1}`, nation: 'KOR', style: STYLES[Math.floor(rng.next() * STYLES.length)]!, hand: 'right', talents, focus };
}

/** Hires for a staff policy: the best affordable member of each wanted role that is missing (keeping a cushion). */
function hires(v: JourneyState, staff: StaffPolicy): string[] {
  const roles: Role[] = staff === 'none' ? [] : staff === 'mix' ? [...ROLES] : [staff];
  const out: string[] = [];
  let budget = v.user.money * 0.5;
  for (const role of roles) {
    if (v.user.team[role]) continue;
    const pickOne = market(v).filter((x) => x.role === role && x.salary * 2 <= budget).sort((a, b) => b.quality - a.quality)[0];
    if (pickOne) {
      out.push(pickOne.id);
      budget -= pickOne.salary * 2;
    }
  }
  return out;
}

export function planFor(v: JourneyState, p: Policy, salt: number): Plan {
  return { ...autoPlan(v, p.schedule, v.user.focus, salt), hire: hires(v, p.staff) };
}

export interface SeasonRun {
  /** Ranking points won over the season, rank at its end, by member index. */
  points: number[];
  rank: (number | null)[];
  winner: number;
}

/** One room, one season (four swings), member i played by policies[i]. */
export function runRoomSeason(seed: number, policies: readonly Policy[]): SeasonRun {
  const members = policies.map((_, i) => botMember(seed, i));
  let room: RoomState = createRoom(seed, members);
  const points = policies.map(() => 0);
  for (let swing = 0; swing < 4; swing++) {
    const plans: Record<string, Plan> = {};
    room.order.forEach((id, i) => {
      room = assign(room, id, answerAll(view(room, id)));
      plans[id] = planFor(view(room, id), policies[i]!, swing);
    });
    const out = advanceRoom(room, plans);
    room.order.forEach((id, i) => (points[i] = points[i]! + out.reports[id]!.events.reduce((a, e) => a + e.points, 0)));
    room = out.room;
  }
  const rank = room.order.map((id) => rankOf(room.humans[id]!.user.player, room.pros, room.points));
  const winner = points.indexOf(Math.max(...points));
  return { points, rank, winner };
}
