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

/** Creation (kickru's start): three 14-year-olds at OVR 45 with a hidden potential on the 1–20 overall scale. */
export const CREATE = {
  age: 14,
  ovr: 45,
  level: 9,
  /** Ratings in a candidate's two strong groups sit this much higher before settling at OVR 45. */
  strongLift: 2,
  injuryProneness: 10,
  potentialMean: 15.6,
  potentialSd: 1.3,
  potentialRange: [12.5, 19] as const,
} as const;

export const GROWTH = {
  /** Focused groups take this many times the gain of the others. */
  focusShare: 3,
} as const;

/** The world around the user: a pool of named pros and four junior cohorts. */
export const WORLD_J = {
  pros: 160,
  /** Pro levels by place in the starting pool: top − span × (place / pros)^shape, plus noise. */
  proTop: 17.6,
  proSpan: 3.7,
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
  /** Pool is trimmed to this many after the year's moves, lowest-ranked first. */
  maxPros: 190,
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
