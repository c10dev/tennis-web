// Where the match left the user on the ladder (ADR-017): the players passed.
import { USER_ID } from '../player/create.ts';
import type { Overtake } from './types.ts';
import type { QuickState } from './ladder.ts';

/** Players above the user in `before` and below in `after` (background matches count), the first passed first. */
export function overtakesBetween(before: readonly string[], after: readonly string[], s: QuickState): Overtake[] {
  const [ub, ua] = [before.indexOf(USER_ID), after.indexOf(USER_ID)];
  const name = new Map(s.world.players.map((p) => [p.id, p.name]));
  return before.slice(0, Math.max(0, ub)).map((id, k) => ({ id, name: name.get(id)!, rank: k + 1 }))
    .filter((o) => after.indexOf(o.id) > ua)
    .reverse();
}
