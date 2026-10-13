// The tour around the user (GDD §9.6): 63 AI players, levels spread around the tour average, ages 18–34.
import type { PlayerAttributes, PlayStyle } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { int, normal, pick, stream, uniform } from '../rng.ts';
import { EDITABLE, OVERALL_WEIGHTS, STYLES, WORLD } from '../tuning.ts';
import type { CareerPlayer, World } from '../types.ts';
import { uniqueName } from './names.ts';

const AI_STYLES = Object.keys(STYLES) as Exclude<PlayStyle, 'serve_and_volley'>[];

export function generateWorld(seed: number, user: CareerPlayer): World {
  const rng = stream(seed, 'world');
  const names = new Set([user.name]);
  const players: CareerPlayer[] = [user];
  for (let i = 1; i < WORLD.size; i++) {
    const level = Math.min(WORLD.level.max, Math.max(WORLD.level.min, WORLD.level.mean + WORLD.level.sd * normal(rng)));
    const style = pick(rng, AI_STYLES);
    const ratings = {} as Record<string, number>;
    for (const k of EDITABLE) {
      const base = k in OVERALL_WEIGHTS ? level : level - WORLD.unusedBelow;
      ratings[k] = clampRating(Math.round(base + (STYLES[style][k] ?? 0) + uniform(rng, -WORLD.ratingNoise, WORLD.ratingNoise)));
    }
    const [lo, hi] = WORLD.surfaceAffinity;
    const attributes = {
      ...ratings,
      injuryProneness: int(rng, ...WORLD.injuryProneness),
      surfaceAffinity: { hard: int(rng, lo, hi), clay: int(rng, lo, hi), grass: int(rng, lo, hi) },
    } as PlayerAttributes;
    const age = int(rng, ...WORLD.ages);
    const name = uniqueName(rng, names);
    const player: CareerPlayer = { id: `p${String(i).padStart(2, '0')}`, name, style, attributes, age, potential: 0, progress: {}, fatigue: 0, injuryWeeks: 0 };
    const [, gainLo, gainHi] = WORLD.potential.find(([upTo]) => age <= upTo)!;
    player.potential = Math.round(Math.min(19, overall(player) + uniform(rng, gainLo, gainHi)) * 10) / 10;
    players.push(player);
  }
  return { players, userId: user.id };
}

const clampRating = (v: number) => Math.min(20, Math.max(1, v));
