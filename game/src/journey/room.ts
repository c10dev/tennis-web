// A season room (ADR-033): one world, several humans. Each human's view is the world plus their side, so code written
// for one player reads a view; the swing works on the whole room.
import type { Hand, HumanState, JourneyState, Nation, RoomState, WorldState } from './types.ts';
import type { CreatableStyle, Group, Talents } from './ratings.ts';

export const worldOf = (s: WorldState): WorldState => ({
  seed: s.seed, year: s.year, swing: s.swing, pros: s.pros, juniors: s.juniors, nextId: s.nextId, points: s.points, juniorPoints: s.juniorPoints,
});

export const humanOf = (j: HumanState): HumanState => ({ user: j.user, stats: j.stats, reports: j.reports, seen: j.seen, pending: j.pending, notes: j.notes });

export function view(r: RoomState, id: string): JourneyState {
  const h = r.humans[id];
  if (!h) throw new Error(`No one with id ${id} in this room`);
  return { ...worldOf(r), ...h };
}

/** The room with one human's side replaced from their view (the view's world is ignored). */
export const assign = (r: RoomState, id: string, j: HumanState): RoomState => ({ ...r, humans: { ...r.humans, [id]: humanOf(j) } });

/** A room of one, from a single player's view. */
export const solo = (j: JourneyState): RoomState => ({ ...worldOf(j), humans: { [j.user.player.id]: humanOf(j) }, order: [j.user.player.id] });

export interface Member {
  /** Stable id from the server (or 'user' alone); the player's id is `h:<id>`. */
  id: string;
  name: string;
  nation: Nation;
  style: CreatableStyle;
  hand: Hand;
  talents: Talents;
  focus: Group[];
}

export const humanId = (memberId: string): string => `h:${memberId}`;

/** FNV-1a over the room's JSON: the same plan log gives the same hash on every device (lockstep check). */
export function stateHash(r: RoomState): string {
  const text = JSON.stringify(r);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
