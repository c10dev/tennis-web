// The world around the user (ADR-032): named pros, four junior cohorts, and the year's turnover (aging, retirements,
// juniors turning pro, a new cohort of 14-year-olds). Pure: state in, state out.
import type { PlayerAttributes, PlayStyle, Rng } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { int, normal, pick, stream, uniform } from '../rng.ts';
import { EDITABLE, OVERALL_WEIGHTS, STYLES, WORLD, type Rated } from '../tuning.ts';
import { drawNation, nameFor } from './names.ts';
import { WORLD_J } from './tuning.ts';
import type { JPlayer, Nation } from './types.ts';

const AI_STYLES = Object.keys(STYLES) as Exclude<PlayStyle, 'serve_and_volley'>[];

export interface Roster {
  pros: JPlayer[];
  juniors: JPlayer[];
  nextId: number;
}

/** A player at `level` (1–20 overall), the style's shape and per-rating noise around it. */
export function playerAt(rng: Rng, id: string, level: number, age: number, nation: Nation, name: string): JPlayer {
  const style = pick(rng, AI_STYLES);
  const ratings = {} as Record<Rated, number>;
  for (const k of EDITABLE) {
    const base = k in OVERALL_WEIGHTS ? level : level - WORLD.unusedBelow;
    ratings[k] = clamp(Math.round(base + (STYLES[style][k] ?? 0) + uniform(rng, -WORLD.ratingNoise, WORLD.ratingNoise)));
  }
  const [lo, hi] = WORLD.surfaceAffinity;
  const attributes = {
    ...ratings,
    injuryProneness: int(rng, ...WORLD.injuryProneness),
    surfaceAffinity: { hard: int(rng, lo, hi), clay: int(rng, lo, hi), grass: int(rng, lo, hi) },
  } as PlayerAttributes;
  return { id, name, nation, style, attributes, age, potential: 0, progress: {}, fatigue: 0, injuryWeeks: 0 };
}

export function createRoster(seed: number, userName: string): Roster {
  const rng = stream(seed, 'roster');
  const taken = new Set([userName]);
  let nextId = 1;
  const pros: JPlayer[] = [];
  for (let i = 1; i <= WORLD_J.pros; i++) {
    const level = WORLD_J.proTop - WORLD_J.proSpan * (i / WORLD_J.pros) ** WORLD_J.proShape + WORLD_J.proNoise * normal(rng);
    const age = int(rng, ...WORLD_J.proAges);
    const nation = drawNation(rng);
    const p = playerAt(rng, id(nextId++), level, age, nation, nameFor(rng, nation, taken));
    p.potential = proPotential(rng, p);
    pros.push(p);
  }
  const juniors: JPlayer[] = [];
  for (const age of [14, 15, 16, 17]) for (let i = 0; i < WORLD_J.cohort; i++) juniors.push(junior(rng, id(nextId++), age, taken));
  return { pros, juniors, nextId };
}

function junior(rng: Rng, pid: string, age: number, taken: Set<string>): JPlayer {
  const nation = drawNation(rng);
  const p = playerAt(rng, pid, WORLD_J.juniorLevel[age]! + WORLD_J.juniorSd * normal(rng), age, nation, nameFor(rng, nation, taken));
  const [mean, sd] = WORLD_J.juniorPotential;
  p.potential = round1(Math.max(overall(p) + 1, Math.min(19, mean + sd * normal(rng))));
  return p;
}

function proPotential(rng: Rng, p: JPlayer): number {
  const [, lo, hi] = WORLD_J.potential.find(([upTo]) => p.age <= upTo)!;
  return round1(Math.min(19, overall(p) + uniform(rng, lo, hi)));
}

/**
 * The year's turnover, after the last swing: everyone a year older, some pros retire, the best 17-year-olds turn pro,
 * a new cohort arrives and the pool is trimmed. `rank` orders pros best first; `juniorRank` orders juniors.
 */
export function turnOver(r: Roster, seed: number, year: number, rank: readonly string[], juniorRank: readonly string[], keepName: string): { roster: Roster; retired: JPlayer[] } {
  const rng = stream(seed, 'turnover', year);
  const taken = new Set([keepName, ...r.pros.map((p) => p.name), ...r.juniors.map((p) => p.name)]);
  const { from, base, perYear, last } = WORLD_J.retire;
  const retired: JPlayer[] = [];
  const pros: JPlayer[] = [];
  for (const p of r.pros) {
    const age = p.age + 1;
    const stops = age > last || (age >= from && rng.next() < base + perYear * (age - from));
    if (stops) retired.push(p);
    else pros.push({ ...p, age });
  }
  const order = new Map(juniorRank.map((pid, i) => [pid, i]));
  const leaving = r.juniors.filter((p) => p.age >= 17).sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || overall(b) - overall(a));
  for (const p of leaving.slice(0, WORLD_J.graduates)) pros.push({ ...p, age: p.age + 1 });
  let nextId = r.nextId;
  const juniors = r.juniors.filter((p) => p.age < 17).map((p) => ({ ...p, age: p.age + 1 }));
  for (let i = 0; i < WORLD_J.cohort; i++) juniors.push(junior(rng, id(nextId++), 14, taken));
  const proOrder = new Map(rank.map((pid, i) => [pid, i]));
  const trimmed = pros
    .map((p, i) => ({ p, at: proOrder.get(p.id) ?? WORLD_J.pros + i }))
    .sort((a, b) => a.at - b.at)
    .slice(0, WORLD_J.maxPros)
    .map(({ p }) => p);
  return { roster: { pros: trimmed, juniors, nextId }, retired };
}

/** An unnamed player who fills a draw: made fresh from the event and slot, never kept. */
export function filler(seed: number, eventKey: string, slot: number, level: number, age: number): JPlayer {
  const rng = stream(seed, 'filler', eventKey, slot);
  const nation = drawNation(rng);
  return playerAt(rng, `f:${eventKey}:${slot}`, level, age, nation, nameFor(rng, nation, new Set()));
}

const id = (n: number) => `p${String(n).padStart(4, '0')}`;
const clamp = (v: number) => Math.min(20, Math.max(1, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
