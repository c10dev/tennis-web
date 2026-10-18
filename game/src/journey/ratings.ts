// What the text game shows of a player (ADR-032/033): six groups and an OVR on a 0–100 scale over the engine's
// 1–20 ratings, creation by talent points at one OVR for everyone, and growth given as a gain in overall.
import type { PlayerAttributes, PlayStyle } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { adjust } from '../player/week.ts';
import { EDITABLE, OVERALL_WEIGHTS, STYLES, type Rated } from '../tuning.ts';
import type { JPlayer, Nation } from './types.ts';
import { CREATE, GROWTH } from './tuning.ts';

export const GROUPS = ['serve', 'forehand', 'backhand', 'return', 'physical', 'mental'] as const;
export type Group = (typeof GROUPS)[number];
export type CreatableStyle = Exclude<PlayStyle, 'serve_and_volley'>;

export const GROUP_RATINGS: Record<Group, readonly Rated[]> = {
  serve: ['servePower', 'serveAccuracy', 'secondServe'],
  forehand: ['forehand'],
  backhand: ['backhand'],
  return: ['return'],
  physical: ['movement', 'agility', 'stamina'],
  mental: ['composure', 'concentration', 'decision', 'consistency', 'aggression'],
};

const GROUP_OF = new Map<Rated, Group>(GROUPS.flatMap((g) => GROUP_RATINGS[g].map((k) => [k, g] as const)));

/** Overall on the 0–100 scale. */
export const ovr = (p: Pick<JPlayer, 'attributes'>): number => Math.round(overall(p) * 5);

/** Overall counting unspent progress: what growth has added, before whole ratings show it. */
export function trueLevel(p: Pick<JPlayer, 'attributes' | 'progress'>): number {
  const counted = Object.entries(OVERALL_WEIGHTS) as [Rated, number][];
  const total = counted.reduce((a, [, w]) => a + w, 0);
  return counted.reduce((a, [k, w]) => a + w * (p.attributes[k] + (p.progress[k] ?? 0)), 0) / total;
}

export function groupValues(p: Pick<JPlayer, 'attributes'>): Record<Group, number> {
  const out = {} as Record<Group, number>;
  for (const g of GROUPS) {
    const ks = GROUP_RATINGS[g];
    out[g] = Math.round((ks.reduce((a, k) => a + p.attributes[k], 0) / ks.length) * 5);
  }
  return out;
}

export interface ProInput {
  name: string;
  nation: Nation;
  style: CreatableStyle;
}

/** Talent points by group (whole, at least 0, `CREATE.talents` in all). */
export type Talents = Partial<Record<Group, number>>;

export interface ProShape {
  age: number;
  ovr: number;
  potential: number;
}

export const talentsUsed = (t: Talents): number => GROUPS.reduce((a, g) => a + (t[g] ?? 0), 0);

export function checkTalents(t: Talents): void {
  for (const g of GROUPS) {
    const v = t[g] ?? 0;
    if (!Number.isInteger(v) || v < 0) throw new RangeError(`Talent points must be whole and not negative (${g}: ${v})`);
  }
  if (talentsUsed(t) > CREATE.talents) throw new RangeError(`At most ${CREATE.talents} talent points`);
}

/**
 * A player shaped by talent points: the style's shape around a level, each point lifting its group's ratings, then
 * whole ratings nudged (least talented groups first) until the 0–100 OVR is the room's. Equal inputs, equal players.
 */
export function createPro(input: ProInput, talents: Talents, shape: ProShape = { age: CREATE.age, ovr: CREATE.ovr, potential: CREATE.potential }): JPlayer {
  checkTalents(talents);
  const level = shape.ovr / 5;
  const talentOf = (k: Rated) => talents[GROUP_OF.get(k)!] ?? 0;
  const ratings = {} as Record<Rated, number>;
  for (const k of EDITABLE) {
    const base = k in OVERALL_WEIGHTS ? level : level - 1;
    const lift = GROUP_OF.has(k) ? CREATE.perTalent * talentOf(k) : 0;
    ratings[k] = clamp(Math.round(base + lift + (STYLES[input.style][k] ?? 0)));
  }
  const attributes = { ...ratings, injuryProneness: CREATE.injuryProneness, surfaceAffinity: { hard: 13, clay: 13, grass: 13 } } as PlayerAttributes;
  const p: JPlayer = {
    id: 'user', name: input.name, nation: input.nation, style: input.style, attributes, age: shape.age,
    potential: shape.potential, progress: {}, fatigue: 0, injuryWeeks: 0,
  };
  const order = (Object.keys(OVERALL_WEIGHTS) as Rated[]).sort((a, b) => talentOf(a) - talentOf(b) || (a < b ? -1 : 1));
  for (let i = 0; i < 400 && ovr(p) !== shape.ovr; i++) {
    const k = order[i % order.length]!;
    p.attributes[k] = clamp(p.attributes[k] + (ovr(p) < shape.ovr ? 1 : -1));
  }
  return p;
}

/** A copy of `p` grown by `gain` in overall (1–20 scale): focused groups take `GROWTH.focusShare` times as much. A
 * loss (aging) comes off every rating alike. */
export function applyGain(p: JPlayer, gain: number, focus: readonly Group[]): JPlayer {
  const out: JPlayer = { ...p, attributes: { ...p.attributes }, progress: { ...p.progress } };
  const weight = (k: Rated) => (gain > 0 && focus.includes(GROUP_OF.get(k)!) ? GROWTH.focusShare : 1);
  const counted = Object.entries(OVERALL_WEIGHTS) as [Rated, number][];
  const total = counted.reduce((a, [, w]) => a + w, 0);
  const scale = (gain * total) / counted.reduce((a, [k, w]) => a + w * weight(k), 0);
  for (const k of EDITABLE) adjust(out, k, k in OVERALL_WEIGHTS ? scale * weight(k) : scale * 0.5);
  return out;
}

const clamp = (v: number) => Math.min(20, Math.max(1, v));
