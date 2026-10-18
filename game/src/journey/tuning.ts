// Tuning for the text career (ADR-032). Measured values say when and how they were measured.

/** The fast model for AI-vs-AI matches, fitted to engine batches on 2026-10-18 (players near overall 8–17). */
export const FAST = {
  /** Serve points won between two players at `pivot` on hard. */
  serve: 0.643,
  pivot: 14,
  /** Per point of the two players' mean level: better players hold more. */
  perLevel: 0.0102,
  /** Per point of the server's level over the returner's. */
  perGap: 0.0225,
  surface: { hard: 0, clay: -0.012, grass: 0.013 },
  /** Level per point of surface affinity above 13 (8 points of affinity moved serve points as 0.64 of overall). */
  affinity: 0.08,
  /** Level lost to starting fatigue: at most `fatigueCap` (0.3 cost 0.5 of a level, 0.6 cost 0.6). */
  fatigue: 1.7,
  fatigueCap: 0.6,
} as const;

/** Creation in a room (ADR-033): everyone at the same age, OVR and hidden potential (1–20 scale), shaped by talent
 * points that lift a group's ratings by `perTalent` each before OVR is evened out. */
export const CREATE = {
  age: 18,
  ovr: 66,
  potential: 16.2,
  talents: 10,
  perTalent: 0.6,
  injuryProneness: 10,
} as const;

export const GROWTH = {
  /** Focused groups take this many times the gain of the others. */
  focusShare: 3,
} as const;

/** The world around the user: a pool of named pros and four junior cohorts. */
export const WORLD_J = {
  pros: 250,
  /** Pro levels by place in the starting pool: top − span × (place / pros)^shape, plus noise. */
  proTop: 17.6,
  proSpan: 3.9,
  proShape: 0.45,
  proNoise: 0.3,
  proAges: [18, 35] as const,
  /** Juniors per age, 14–17, and their mean level by age (spread `juniorSd`). */
  cohort: 24,
  juniorLevel: { 14: 8.6, 15: 9.6, 16: 10.6, 17: 11.6 } as Record<number, number>,
  juniorSd: 0.8,
  juniorPotential: [14.6, 1.4] as const,
  /** Juniors who turn 18 and join the pros each year, best of their cohort first. */
  graduates: 12,
  /** Pool is trimmed to this many after the year's moves, lowest-ranked first, and topped up to `pros` with
   * newcomers (players who come up through the lower tours, not followed as juniors). */
  maxPros: 280,
  newcomerLevel: [13.6, 0.5] as const,
  newcomerAges: [19, 23] as const,
  /** Retirement: chance a year from `from`, rising by `perYear`; everyone stops by `last`. */
  retire: { from: 31, base: 0.12, perYear: 0.1, last: 37 },
  /** Hidden potential above today's level for a pro, by age: [up to age, min gain, max gain]. */
  potential: [[21, 1, 3], [24, 0.5, 2], [27, 0.1, 0.8], [99, 0, 0.2]] as const,
} as const;

/** Places below the named pool from points: rank ≈ scale × points^−exponent (ATP 2025: about 10 points at 1,100th,
 * 200 points at 300th). */
export const RANK = {
  estimateScale: 2988,
  estimateExponent: 0.434,
} as const;

/** Schedule load: events besides the Major, growth from training, fatigue and injury risk. */
export const LOADS = {
  events: { heavy: 4, normal: 3, peak: 1 },
  collegeEvents: 1,
  juniorFuturesFrom: 16,
  /** Growth multiplier from the training a schedule leaves room for. */
  training: { heavy: 0.9, normal: 1, peak: 1.12 },
  /** Fatigue a swing adds before matches, and per match played. */
  fatigue: { heavy: 0.3, normal: 0.18, peak: 0.08 },
  fatiguePerMatch: 0.015,
  /** Share of fatigue carried into the next swing. */
  carry: 0.4,
  /** Injury chance a swing at average proneness, by load, times (0.6 + fatigue). */
  injury: { heavy: 0.1, normal: 0.06, peak: 0.04 },
  /** Older bodies break more: from this age the chance is multiplied. */
  injuryAgeFrom: 30,
  injuryAgeFactor: 1.5,
  /** Swings out: 1 with the first chance, 2 with the next, else 4. */
  injurySwings: [[0.7, 1], [0.95, 2], [1, 4]] as const,
} as const;

/** The user's condition in matches and between swings. */
export const CONDITION_J = {
  /** Share of fatigue carried into a match as the engine's starting fatigue. */
  toMatch: 0.6,
  /** Morale points per rating of composure and concentration (50 is neutral). */
  moralePerPoint: 25,
} as const;

/** Growth a swing, in overall (1–20 scale). */
export const GROWTH_J = {
  /** [up to age, gain a swing at full room]. */
  byAge: [[17, 0.3], [20, 0.25], [23, 0.18], [26, 0.1], [29, 0.04], [99, 0]] as const,
  /** Full speed this far below potential, slower nearer. */
  headroom: 2,
  declineFrom: 29,
  /** Loss a swing per year past `declineFrom` − 1. */
  declinePerYear: 0.03,
  coach: [1, 1.15, 1.3] as const,
  moraleBase: 0.85,
  moraleSpan: 0.3,
  /** Matches teach too: full credit from `playFull` matches a swing. */
  playBase: 0.85,
  playSpan: 0.3,
  playFull: 10,
  /** Share of growth an injured swing keeps (rehab). */
  injured: 0.3,
  /** AI talent: ± this share around the base gain, drawn per player and year. */
  aiSpread: 0.3,
} as const;

/** Morale, reputation and money after a swing. */
export const BOOKS = {
  moraleRest: 55,
  moraleDrift: 0.2,
  morale: { majorTitle: 15, title: 6, final: 2, firstRoundLoss: -2, rankUp: 3, rankDown: -2 },
  reputationKeep: 0.97,
  pointsPerReputation: 150,
  majorReputation: 8,
  /** Dollars a swing. */
  coachFee: [0, 15000, 60000] as const,
  living: { junior: 1000, pro: 4000 },
} as const;

/** The user at 14. */
export const START = {
  morale: 60,
  reputation: 5,
  money: 20000,
} as const;

/** Choices between swings: how many offers or life events come after a swing (stage turns come alone). */
export const CHOICES = {
  none: 0.35,
  one: 0.45,
  /** Events' gains are written as felt; this much of them reaches the ratings (they bypass potential). */
  gainScale: 0.4,
} as const;

/** Stage turns and offers. */
export const STAGES = {
  turnPro: 18,
  /** A junior this good (junior rank, or OVR) at 16–17 is offered an early pro start. */
  earlyProJuniorRank: 3,
  earlyProOvr: 70,
  /** College: swings before turning pro, growth multiplier, a stipend a swing. */
  collegeSwings: 8,
  collegeStipend: 3000,
  /** Retirement advice from this age when OVR is this far under the peak and the rank is past `adviseRank`; always
   * from `adviseAlways`; the career ends at `forced`. Advice comes back at most every `adviseEvery` swings. */
  adviseFrom: 31,
  adviseDrop: 5,
  adviseRank: 100,
  adviseAlways: 35,
  adviseEvery: 4,
  forced: 38,
  /** Korean men serve at this age unless exempt (a medal); 6 swings away. */
  serviceAge: 28,
  serviceSwings: 6,
} as const;

/** The long solo career from 14 (ADR-032, kept for TD-083 and as a reference batch): its start and potential spread. */
export const CAREER_REF = {
  age: 14,
  ovr: 45,
  potentialMean: 15.3,
  potentialSd: 1.6,
  potentialRange: [12.5, 19] as const,
} as const;
