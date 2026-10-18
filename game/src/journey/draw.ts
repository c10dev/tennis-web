// Building an event's draw (ADR-032/033): the AI field, the humans put in at their places (a qualifier or a late
// entry takes a place at the bottom), then unnamed players fill what is left.
import { stream } from '../rng.ts';
import { JTIERS, type JEvent } from './calendar.ts';
import type { JPlayer } from './types.ts';
import { filler } from './world.ts';

export function buildDraw(seed: number, key: string, ev: JEvent, field: readonly JPlayer[], humans: readonly { player: JPlayer; rank: number | null }[],
  place: ReadonlyMap<string, number>): JPlayer[] {
  const size = JTIERS[ev.tier].draw;
  const list = [...field];
  const ordered = [...humans].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (a.player.id < b.player.id ? -1 : 1));
  ordered.forEach((h, i) => {
    const at = h.rank === null ? list.length : list.filter((p) => !p.id.startsWith('h:') && p.id !== 'user' && (place.get(p.id) ?? 1e9) < h.rank!).length + i;
    list.splice(Math.min(at, size - ordered.length + i), 0, h.player);
  });
  const kept = list.slice(0, size);
  const spec = JTIERS[ev.tier];
  const rng = stream(seed, 'fill', key, ev.id);
  for (let i = kept.length; i < spec.draw; i++) {
    const level = spec.filler[0] + spec.filler[1] * (2 * rng.next() - 1) * 1.7;
    kept.push(filler(seed, `${key}/${ev.id}`, i, level, spec.junior ? 15 + Math.floor(rng.next() * 3) : 19 + Math.floor(rng.next() * 12)));
  }
  return kept;
}
