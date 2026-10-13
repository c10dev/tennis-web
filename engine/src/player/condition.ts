// A player's in-match view: normalised ratings, the current tactic, fatigue and surface affinity.
import { AVG, FATIGUE, PRESSURE, SKILL_MIX, SURFACES } from '../tuning.ts';
import type { PlayerId, PlayerProfile, PointTag, Surface, Tactic, Wing } from '../types.ts';
import { normalizeAttributes, type NormalizedAttributes } from './attributes.ts';
import { clamp01 } from '../point/prob.ts';

export interface PlayerRuntime {
  id: PlayerId;
  n: NormalizedAttributes;
  tactic: Tactic;
  /** 0 (fresh) to 1 (spent). */
  fatigue: number;
  /** Shift added to every skill from the surface affinity rating. */
  affinity: number;
}

export function runtime(profile: PlayerProfile, tactic: Tactic, id: PlayerId, surface: Surface, fatigue = 0): PlayerRuntime {
  const n = normalizeAttributes(profile.attributes);
  return { id, n, tactic, fatigue, affinity: SKILL_MIX.surfaceAffinity * (n.surfaceAffinity[surface] - AVG) };
}

export function strokeSkill(p: PlayerRuntime, wing: Wing): number {
  const m = SKILL_MIX.stroke;
  return clamp01(m.wing * p.n[wing] + m.consistency * p.n.consistency + m.concentration * p.n.concentration + p.affinity);
}

export function returnSkill(p: PlayerRuntime, wing: Wing): number {
  const m = SKILL_MIX.returnStroke;
  return clamp01(m.return * p.n.return + m.wing * p.n[wing] + m.consistency * p.n.consistency + p.affinity);
}

export function defenceSkill(p: PlayerRuntime): number {
  const m = SKILL_MIX.defence;
  return clamp01(m.movement * p.n.movement + m.agility * p.n.agility + m.decision * p.n.decision + p.affinity);
}

/** Pressure on the coming point, 0–1 (GDD §5.2): the sum of its tags, capped. */
export function pressureIndex(tags: readonly PointTag[], finalSet: boolean): number {
  let total = finalSet ? PRESSURE.finalSet : 0;
  for (const tag of tags) total += PRESSURE[tag];
  return Math.min(1, total);
}

export function addFatigue(fatigue: number, stamina: number, shots: number, surface: Surface): number {
  const perShot = FATIGUE.perShot * (1 - FATIGUE.staminaRelief * stamina) * SURFACES[surface].fatigue;
  return Math.min(1, fatigue + shots * perShot);
}

export function recover(fatigue: number, fraction: number): number {
  return fatigue * (1 - fraction);
}
