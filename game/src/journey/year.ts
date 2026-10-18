// The year's turn after the last swing (ADR-032/033): the world turns over and every human is a year older.
import { order } from './ranking.ts';
import type { JPlayer, RoomState } from './types.ts';
import { turnOver } from './world.ts';

export function yearEnd(r: RoomState): RoomState {
  const names = r.order.map((id) => r.humans[id]!.user.player.name);
  const { roster } = turnOver({ pros: r.pros, juniors: r.juniors, nextId: r.nextId }, r.seed, r.year, order(r.pros, r.points), order(r.juniors, r.juniorPoints), names.join('|'), names);
  const keep = (pts: Record<string, number[]>, ps: readonly JPlayer[]) => {
    const ids = new Set([...ps.map((p) => p.id), ...r.order]);
    return Object.fromEntries(Object.entries(pts).filter(([pid]) => ids.has(pid)));
  };
  const humans = Object.fromEntries(Object.entries(r.humans).map(([id, h]) => [id, { ...h, user: { ...h.user, player: { ...h.user.player, age: h.user.player.age + 1 } } }]));
  return {
    ...r, year: r.year + 1, swing: 0, pros: roster.pros, juniors: roster.juniors, nextId: roster.nextId,
    points: keep(r.points, roster.pros), juniorPoints: keep(r.juniorPoints, roster.juniors), humans,
  };
}
