// Rally shot outcome (GDD §5.2): error, winner or the ball in play with a quality for the opponent.
import { defenceSkill, type PlayerRuntime } from '../player/condition.ts';
import { AVG, RALLY, SURFACES, type Risk } from '../tuning.ts';
import type { Surface } from '../types.ts';
import { clamp01, sigmoid } from './prob.ts';

export interface ErrorInput {
  skill: number;
  risk: Risk;
  /** Difficulty of the incoming ball, 0–1. */
  incoming: number;
  fatigue: number;
  pressure: number;
  composure: number;
  surface: Surface;
}

export function errorProbability(e: ErrorInput): number {
  const gap = Math.max(RALLY.minSkillGap, 1 - e.skill);
  const difficulty = Math.exp(RALLY.errorIncoming * (e.incoming - 0.5));
  const tired = 1 + RALLY.fatigueError * e.fatigue;
  const nerves = 1 + RALLY.pressureError * e.pressure * (1 - e.composure);
  return Math.min(0.97, RALLY.errorBase[e.risk] * gap * difficulty * tired * nerves * SURFACES[e.surface].error);
}

/** Mean quality of a shot that goes in, i.e. how hard it is for the opponent. */
export function shotQualityMean(skill: number, risk: Risk, incoming: number, surface: Surface): number {
  return clamp01(
    RALLY.qualityBase + RALLY.qualityRisk[risk] + RALLY.qualitySkill * (skill - AVG)
    - RALLY.qualityIncoming * (incoming - 0.5) + SURFACES[surface].serveQuality / 2,
  );
}

export function winnerProbability(quality: number, defender: PlayerRuntime, surface: Surface, risk: Risk = 'neutral'): number {
  const defence = RALLY.defenceBase + RALLY.defenceSkill * (defenceSkill(defender) - AVG) - RALLY.defenceFatigue * defender.fatigue;
  return sigmoid(RALLY.winnerSlope * (quality - defence) + RALLY.winnerBias + RALLY.winnerRisk[risk] + SURFACES[surface].winner);
}
