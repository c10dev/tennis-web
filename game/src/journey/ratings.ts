// What the text career shows of a player (ADR-032): six groups and an OVR on a 0–100 scale over the engine's
// 1–20 ratings, three creation candidates at OVR 45, and growth given as a gain in overall.
import type { PlayerAttributes, PlayStyle } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { adjust } from '../player/week.ts';
import { normal, pick, stream, uniform } from '../rng.ts';
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

export interface CandidateInput {
  name: string;
  nation: Nation;
  style: CreatableStyle;
}

/** Three 14-year-olds at OVR 45: the chosen style, each strong in a different pair of groups, hidden potential. */
export function candidates(seed: number, input: CandidateInput): JPlayer[] {
  const rng = stream(seed, 'candidates');
  const strong = shuffled(rng, [...GROUPS]);
  return [0, 1, 2].map((i) => {
    const pair = [strong[i * 2]!, strong[i * 2 + 1]!];
    const ratings = {} as Record<Rated, number>;
    for (const k of EDITABLE) {
      const g = GROUP_OF.get(k);
      const lift = g && pair.includes(g) ? CREATE.strongLift : 0;
      const base = k in OVERALL_WEIGHTS ? CREATE.level : CREATE.level - 1;
      ratings[k] = clamp(Math.round(base + lift + (STYLES[input.style][k] ?? 0) + uniform(rng, -1, 1)));
    }
    const attributes = { ...ratings, injuryProneness: CREATE.injuryProneness, surfaceAffinity: { hard: 13, clay: 13, grass: 13 } } as PlayerAttributes;
    const p: JPlayer = {
      id: 'user', name: input.name, nation: input.nation, style: input.style, attributes, age: CREATE.age,
      potential: 0, progress: {}, fatigue: 0, injuryWeeks: 0,
    };
    settleAt(p, CREATE.ovr, rng);
    const [lo, hi] = CREATE.potentialRange;
    p.potential = round1(Math.min(hi, Math.max(lo, CREATE.potentialMean + CREATE.potentialSd * normal(rng))));
    return p;
  });
}

/** Nudges whole ratings one at a time until the 0–100 OVR is `target`. */
function settleAt(p: JPlayer, target: number, rng: ReturnType<typeof stream>): void {
  const keys = Object.keys(OVERALL_WEIGHTS) as Rated[];
  for (let i = 0; i < 200 && ovr(p) !== target; i++) {
    const k = pick(rng, keys);
    p.attributes[k] = clamp(p.attributes[k] + (ovr(p) < target ? 1 : -1));
  }
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

function shuffled<T>(rng: ReturnType<typeof stream>, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

const clamp = (v: number) => Math.min(20, Math.max(1, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
