// Lockstep (ADR-033): a room is its seed, its members and the log of what each member submitted for each swing. Every
// device folds the same log through the same engine and gets the same room. A missing or broken submission falls back
// to a default, the same on every device.
import { choose, currentChoice } from './events.ts';
import { autoPlan, validatePlan, type Plan } from './plan.ts';
import { assign, stateHash, view, type Member } from './room.ts';
import { createRoom } from './start.ts';
import { advanceRoom } from './swing.ts';
import type { RoomState, SwingReport } from './types.ts';

/** What one member sends for a swing: answers to the choices waiting for them, then the plan. */
export interface Submission {
  answers: string[];
  plan: Plan;
}

/** One swing of the log: submissions by member id (missing members get defaults). */
export type SwingLog = Record<string, Submission>;

export interface Folded {
  room: RoomState;
  /** Reports of the last swing folded, by player id. */
  reports: Record<string, SwingReport>;
  hash: string;
}

/** Answers a human's waiting choices: their answers in order, the first option for anything missing or unknown. */
export function answerChoices(r: RoomState, id: string, answers: readonly string[]): RoomState {
  let v = view(r, id);
  let i = 0;
  while (v.pending.length) {
    const options = currentChoice(v)!.options.map((o) => o.id);
    const pick = answers[i++];
    v = choose(v, pick && options.includes(pick) ? pick : options[0]!).state;
  }
  return assign(r, id, v);
}

/** The plan a missing or unplayable submission falls back to: sensible events, last swing's focus, no staff moves. */
export function fallbackPlan(r: RoomState, id: string): Plan {
  const v = view(r, id);
  return autoPlan(v, 'smart', v.user.focus);
}

/** Plays one swing of the log. */
export function foldSwing(r: RoomState, log: SwingLog, memberIds: Readonly<Record<string, string>>): { room: RoomState; reports: Record<string, SwingReport> } {
  let room = r;
  const plans: Record<string, Plan> = {};
  for (const id of room.order) {
    const sub = log[memberIds[id]!];
    room = answerChoices(room, id, sub?.answers ?? []);
    const v = view(room, id);
    if (v.user.stage === 'retired') continue;
    plans[id] = sub && validatePlan(v, sub.plan).length === 0 ? sub.plan : fallbackPlan(room, id);
  }
  return advanceRoom(room, plans);
}

/** The room after every swing in `log`, from its start. */
export function fold(seed: number, members: readonly Member[], log: readonly SwingLog[]): Folded {
  let room = createRoom(seed, members);
  let reports: Record<string, SwingReport> = {};
  const memberIds = Object.fromEntries(members.map((m) => [`h:${m.id}`, m.id]));
  for (const swing of log) ({ room, reports } = foldSwing(room, swing, memberIds));
  return { room, reports, hash: stateHash(room) };
}
