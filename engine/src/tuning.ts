// Every tuning coefficient of the engine lives here (CLAUDE.md rule 5).
// Probabilities are written as the rate for two average players (all ratings 13) on hard court. Skill differences
// shift them on the logit scale, so rates stay inside (0, 1) and rise or fall monotonically with the ratings.
// Skill slopes are kept small: every rating one point higher wins about 70% of best-of-3 matches (ADR-005).
import type { Surface } from './types.ts';

/** Normalised value of the reference rating 13. */
export const AVG = 12 / 19;

export interface SurfaceTuning {
  /** Multiplier on ace odds. */
  ace: number;
  /** Added to serve quality (0–1). */
  serveQuality: number;
  /** Added to the winner logit of rally shots: fast courts end rallies sooner. */
  winner: number;
  /** Multiplier on rally error rates. */
  error: number;
  /** Multiplier on fatigue gained per shot. */
  fatigue: number;
  /** Ball speed multiplier for generated geometry. */
  speed: number;
}

export const SURFACES: Record<Surface, SurfaceTuning> = {
  hard: { ace: 1, serveQuality: 0, winner: 0, error: 1, fatigue: 1, speed: 1 },
  clay: { ace: 0.75, serveQuality: -0.01, winner: -0.12, error: 1, fatigue: 1.25, speed: 0.92 },
  grass: { ace: 1.2, serveQuality: 0.015, winner: 0.15, error: 1, fatigue: 0.9, speed: 1.06 },
};

export const SERVE = {
  firstIn: 0.63,
  secondIn: 0.9,
  /** Logit shift per unit of normalised rating above average. */
  firstInAccuracy: 0.8,
  firstInPower: -0.6,
  secondInSkill: 1,
  /** Ace odds per serve that lands in. */
  aceFirst: 0.13,
  aceSecond: 0.025,
  acePower: 3,
  aceAccuracy: 1,
  aceReturn: -1,
  /** Mean quality (difficulty for the returner, 0–1) of a serve that lands in. */
  qualityFirst: 0.71,
  qualitySecond: 0.5,
  qualityPower: 0.15,
  qualityAccuracy: 0.08,
  qualitySpread: 0.14,
  /** Pressure lowers in % for players without composure. */
  pressureIn: -0.6,
  targets: {
    wide: { in: -0.12, ace: 0.2, quality: 0.03 },
    t: { in: -0.06, ace: 0.25, quality: 0.02 },
    body: { in: 0.15, ace: -0.9, quality: -0.03 },
  },
} as const;

export type Risk = 'safe' | 'neutral' | 'aggressive';

export const RALLY = {
  /** p_error = base(risk) × (1 − skill) × difficulty × fatigue × pressure × surface (GDD §5.2). */
  errorBase: { safe: 0.19, neutral: 0.31, aggressive: 0.5 } satisfies Record<Risk, number>,
  /** Effective skill in (1 − skill) is AVG + errorSkill × (skill − AVG). */
  errorSkill: 0.15,
  /** Floor on (1 − skill) so the best players still miss. */
  minSkillGap: 0.08,
  /** difficulty = exp(errorIncoming × (incoming − 0.5)). */
  errorIncoming: 2.4,
  fatigueError: 0.6,
  pressureError: 0.5,
  /** Shot quality handed to the opponent: base + risk + skill − incoming pace, plus noise. */
  qualityBase: 0.45,
  qualityRisk: { safe: -0.1, neutral: 0, aggressive: 0.12 } satisfies Record<Risk, number>,
  qualitySkill: 0.1,
  qualityIncoming: 0.6,
  qualitySpread: 0.16,
  /** p_winner = sigmoid(winnerSlope × (quality − defence) + winnerBias + risk bonus). */
  winnerSlope: 7,
  winnerBias: -2,
  winnerRisk: { safe: -0.6, neutral: 0, aggressive: 0.35 } satisfies Record<Risk, number>,
  defenceBase: 0.62,
  defenceSkill: 0.08,
  defenceFatigue: 0.15,
  /** An error on a ball harder than this is forced, otherwise unforced. */
  forcedThreshold: 0.6,
  /** Points longer than this are a bug, not tennis. */
  maxShots: 400,
} as const;

export const SELECTION = {
  /** Mix of the tactic slider and the aggression rating that sets risk appetite. */
  tacticWeight: 0.5,
  safeBase: 1.1,
  aggressiveBase: 1.2,
  /** How strongly decision-making reads the incoming ball. */
  decisionRead: 2.2,
  middle: 0.55,
  targetBackhand: 2.2,
  /** Decision-making aims at the weaker wing: logit shift per unit of wing gap. */
  decisionWing: 4,
} as const;

/** Skill mixes, weights summing to 1. */
export const SKILL_MIX = {
  stroke: { wing: 0.65, consistency: 0.2, concentration: 0.15 },
  returnStroke: { return: 0.6, wing: 0.25, consistency: 0.15 },
  defence: { movement: 0.5, agility: 0.3, decision: 0.2 },
  /** Normalised surface affinity above or below average shifts every skill by this much. */
  surfaceAffinity: 0.12,
} as const;

export const FATIGUE = {
  /** Fatigue gained per shot hit by a player with average stamina. */
  perShot: 0.0016,
  /** Stamina scales the gain: (1 − staminaRelief × stamina). */
  staminaRelief: 0.7,
  /** Fraction recovered between points and at the set break. */
  pointRecovery: 0.025,
  setRecovery: 0.35,
} as const;

export const PRESSURE = {
  break_point: 0.5,
  set_point: 0.6,
  match_point: 0.8,
  tiebreak: 0.4,
  finalSet: 0.15,
} as const;

/**
 * Presentation geometry (ADR-008). These numbers place players and the ball; they never change a result, because no
 * outcome reads a position and every RNG draw happens whatever they are.
 */
export const GEOMETRY = {
  /** Share of its ground speed a ball keeps off the bounce: grass skids, clay grabs. */
  bounceRetain: { hard: 0.62, clay: 0.55, grass: 0.7 } as Record<Surface, number>,
  /** Bounce-to-contact time limits, seconds. */
  minContactSec: 0.25,
  maxContactSec: 0.9,
  /** A ball is met at least this far past its bounce, metres. */
  minContactDistance: 1.5,
  /** Average speed between recorded positions, m/s: about a tour player's sprint. */
  maxRunSpeed: 5.5,
  /** The ball passes this far to the racket side of the body at contact. */
  contactSideOffset: 0.75,
  lateralJitter: 0.25,
  /** How far a player steps in (+) or back (−) from where they stand to meet the ball, metres. */
  stepIn: { return: [0, 1], rally: [-0.5, 1] } as const,
  /** Players never stand further than this behind their baseline or outside a singles sideline (court run-off). */
  maxBehindBaseline: 4.5,
  maxWide: 4.5,
} as const;

/**
 * Cards (ADR-015): what each card does for its player on the point, by role, and how much winning the matchup
 * (attack > defend > counter > attack) is worth. Logit shifts and multipliers, scaled by the card's strength.
 */
export const CARDS = {
  roles: {
    serve: {
      attack: { aggression: 0.8, serveIn: -0.45, serveAce: 0.7, serveQuality: 0.03, errorMul: 1.05, winnerShift: 0.03 },
      defend: { aggression: 0.25, serveIn: 0.6, serveAce: -0.5, serveQuality: -0.03, errorMul: 0.93, winnerShift: -0.05 },
      counter: { aggression: 0.5, serveIn: 0, serveAce: 0, serveQuality: 0, errorMul: 1, winnerShift: 0 },
    },
    return: {
      attack: { aggression: 0.8, serveIn: 0, serveAce: 0, serveQuality: 0, errorMul: 1.1, winnerShift: 0.2 },
      defend: { aggression: 0.25, serveIn: 0, serveAce: 0, serveQuality: 0, errorMul: 0.88, winnerShift: -0.15 },
      counter: { aggression: 0.5, serveIn: 0, serveAce: 0, serveQuality: 0, errorMul: 1, winnerShift: 0 },
    },
  },
  /** The second serve takes this share of the serve card's in % shift. */
  secondServeShare: 0.6,
  /** Winning the matchup: own rally errors × exp(−edgeError), winners +edgeWinner on the logit, serve +edgeAce and
   *  +edgeQuality; losing it the reverse. A returner who wins it takes edgeQuality off the serve. */
  edgeError: 0.22,
  edgeWinner: 0.22,
  edgeAce: 0.2,
  edgeQuality: 0.03,
  /** Ratings behind each card; strength = 1 + statWeight × (their mean − average). */
  stats: {
    attack: ['servePower', 'forehand', 'aggression'],
    defend: ['consistency', 'movement'],
    counter: ['return', 'decision', 'agility'],
  },
  statWeight: 1.5,
  /** Styles built for a card get more from it. */
  style: { big_server: { attack: 1.15 }, serve_and_volley: { attack: 1.15 }, baseliner: { defend: 1.15 }, counter_puncher: { counter: 1.15 } },
  /** Attack loses this share of its strength per unit of fatigue. */
  fatigueAttack: 0.6,
  minStrength: 0.3,
} as const;
