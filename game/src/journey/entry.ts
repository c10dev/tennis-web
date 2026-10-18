// Who plays what in a swing (ADR-032): AI pros and juniors enter by their place and the tier's band and chance;
// the user's plan picks the biggest events that accept them; unnamed players fill what is left of a draw.
import { stream } from '../rng.ts';
import { JTIERS, TIER_ORDER, type JEvent } from './calendar.ts';
import { LOADS } from './tuning.ts';
import type { JPlayer, Load, Stage } from './types.ts';

/** AI entrants of one event, best first (by `place`, 1-based; unranked players come after the ranked). */
export function aiEntrants(seed: number, key: string, ev: JEvent, pool: readonly JPlayer[], place: ReadonlyMap<string, number>): JPlayer[] {
  const spec = JTIERS[ev.tier];
  const rng = stream(seed, 'entry', key, ev.id);
  const [from, to] = spec.band;
  return pool
    .filter((p) => {
      const at = place.get(p.id) ?? Number.MAX_SAFE_INTEGER;
      return at >= from && at <= to && rng.next() < spec.chance;
    })
    .sort((a, b) => (place.get(a.id) ?? 1e9) - (place.get(b.id) ?? 1e9) || (a.id < b.id ? -1 : 1));
}

/** Whether the user, at `rank` (null unranked), gets into an event whose AI entrants are `field`. Futures and junior
 * internationals always find a place (qualifying or a wild card); everything else goes by ranking. */
export function accepted(ev: JEvent, rank: number | null, field: readonly JPlayer[], place: ReadonlyMap<string, number>): boolean {
  if (ev.tier === 'futures' || ev.tier === 'jr') return true;
  if (rank === null) return false;
  if (ev.tier === 'finals') return rank <= JTIERS.finals.draw;
  const ahead = field.filter((p) => (place.get(p.id) ?? 1e9) < rank).length;
  return ahead < JTIERS[ev.tier].draw;
}

export interface Pick {
  stage: Stage;
  age: number;
  load: Load;
  /** Events open to the user this swing (accepted), any order. */
  open: readonly JEvent[];
}

/** The user's events for the swing: the Major (or junior Major) whenever open, then the biggest others up to the
 * load's count. Juniors play junior events and, from 16, futures; college players a single futures event. */
export function schedule({ stage, age, load, open }: Pick): JEvent[] {
  const big = (e: JEvent) => e.tier === 'major' || e.tier === 'jrMajor' || e.tier === 'finals';
  const allowed = (e: JEvent) =>
    stage === 'junior' ? JTIERS[e.tier].junior || (e.tier === 'futures' && age >= LOADS.juniorFuturesFrom)
      : stage === 'college' ? e.tier === 'futures'
        : !JTIERS[e.tier].junior;
  const mine = open.filter(allowed);
  const rank = (e: JEvent) => TIER_ORDER.indexOf(e.tier);
  const others = mine.filter((e) => !big(e)).sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : 1));
  const count = stage === 'college' ? LOADS.collegeEvents : LOADS.events[load];
  return [...mine.filter(big), ...others.slice(0, count)];
}
