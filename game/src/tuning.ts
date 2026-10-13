// Every tuning constant of the game layer (CLAUDE.md rule 5): world, creation, calendar, training, season.
import type { PlayerAttributes, PlayStyle } from '@tennis/engine';

export type Rated = Exclude<keyof PlayerAttributes, 'surfaceAffinity'>;

/** Ratings the engine reads, weighted by how much they decide matches (ADR-002 lists the ones in use). */
export const OVERALL_WEIGHTS: Partial<Record<Rated, number>> = {
  servePower: 1.5, serveAccuracy: 1, secondServe: 1, forehand: 1.5, backhand: 1.5, return: 1.2,
  movement: 1.2, agility: 0.8, stamina: 0.8, composure: 0.7, concentration: 0.6, aggression: 0.3, consistency: 0.8, decision: 0.6,
};

/** Ratings a player can set at creation and train later. */
export const EDITABLE: readonly Rated[] = [
  'servePower', 'serveAccuracy', 'secondServe', 'forehand', 'backhand', 'return', 'volley', 'overhead', 'slice', 'dropShot',
  'movement', 'agility', 'stamina', 'strength', 'composure', 'concentration', 'aggression', 'consistency', 'decision',
];

/** Style templates: rating offsets from a player's level. Serve-and-volley waits for net play (TD-001). */
export const STYLES: Record<Exclude<PlayStyle, 'serve_and_volley'>, Partial<Record<Rated, number>>> = {
  big_server: { servePower: 3, serveAccuracy: 2, secondServe: 1, return: -1, movement: -1, consistency: -1 },
  baseliner: { forehand: 2, backhand: 2, consistency: 2, servePower: -1, volley: -1 },
  counter_puncher: { movement: 2, agility: 2, return: 2, consistency: 1, servePower: -2, aggression: -2 },
  all_court: {},
};

export const WORLD = {
  size: 64,
  ages: [18, 34] as const,
  /** AI overall level: mean, spread, and limits. */
  level: { mean: 13.2, sd: 1.45, min: 9.5, max: 17.8 },
  /** Per-rating noise around a player's level, ±. */
  ratingNoise: 1.3,
  /** Ratings a player never trains sit this far below their level. */
  unusedBelow: 1,
  injuryProneness: [5, 15] as const,
  surfaceAffinity: [9, 17] as const,
  /** Hidden potential above today's level, by age: [up to age, min gain, max gain]. */
  potential: [[21, 1.5, 4], [24, 0.8, 2.5], [27, 0.2, 1], [99, 0, 0.3]] as const,
} as const;

/** The skills that decide most points: the suggested spread puts them a point higher. */
export const PRIMARY: readonly Rated[] = ['servePower', 'serveAccuracy', 'secondServe', 'forehand', 'backhand', 'return', 'movement'];

export const CREATION = {
  /** Sum of all editable ratings: the suggested spread plus a few points of the user's own. */
  budget: 230,
  min: 8,
  max: 15,
  /** Suggested allocation: primary skills, other rated skills, unused ones, plus the style template. */
  suggested: { primary: 13, rated: 12, unused: 10 },
  age: 18,
  potential: [16, 18] as const,
  injuryProneness: 10,
  surfaceAffinity: 13,
} as const;

export const RANKING = {
  /** Last season's points for the top player at the start of the season, fading linearly to 0 by its end. */
  carryoverTop: 4000,
  /** Carryover falls by a factor e every this many ranking places. */
  carryoverScale: 14,
} as const;

/** Training focuses (GDD §9.3) and the ratings each one works on. */
export const FOCUS_RATINGS = {
  serve: ['servePower', 'serveAccuracy', 'secondServe'],
  groundstrokes: ['forehand', 'backhand', 'consistency'],
  return: ['return', 'decision', 'concentration'],
  physical: ['movement', 'agility', 'stamina'],
  mental: ['composure', 'concentration', 'decision', 'aggression'],
} as const satisfies Record<string, readonly Rated[]>;

export const TRAINING = {
  /** Progress per focused rating per week, before age and headroom. */
  rate: { light: 0.3, normal: 0.55, hard: 0.8 },
  /** Share of that rate every other rated skill gets. */
  spill: 0.08,
  /** A week of matches teaches every rated skill a little. */
  matchRate: 0.08,
  /** Growth slows as overall nears potential: full speed this far below it. */
  headroom: 2,
  /** Growth by age: [up to age, factor]. */
  age: [[21, 1], [25, 0.75], [29, 0.45], [99, 0.2]] as const,
} as const;

export const CONDITION = {
  train: { light: 0.04, normal: 0.08, hard: 0.14 },
  perSet: 0.03,
  /** A tournament straight after another one. */
  travel: 0.06,
  rest: 0.35,
  /** Every week takes this much off whatever was added. */
  weekly: 0.06,
  /** Share of weekly fatigue a player carries into a match (engine starting fatigue). */
  toMatch: 0.6,
} as const;

export const INJURY = {
  /** Weekly chance at average proneness (10), multiplied by the week's load and fatigue. */
  base: 0.0026,
  load: { rest: 0.2, light: 0.6, normal: 1, hard: 2, tournament: 1.3 },
  fatigueWeight: 3,
  weeks: [1, 4] as const,
} as const;

export const AGING = {
  /** From this age, every rated skill loses this much progress per week per year past it. */
  from: 30,
  weekly: 0.02,
} as const;

/** How AI players plan their weeks (and how the batch plays the user). */
export const AI = {
  /** Too tired to enter above this weekly fatigue; rests instead of training above `restAt`. */
  enterUpTo: 0.75,
  restAt: 0.55,
  /** Chance an eligible AI player enters, by tier: real players pick their events, which leaves room in the draws. */
  enterChance: { major: 1, masters: 1, t250: 0.6, challenger: 0.75 },
  /** Players ranked this high skip Challengers, and skip a 250 straight after another tournament. */
  skipChallengersTop: 24,
  skip250AfterPlayingTop: 12,
  /** Aggression by style; everything else is the engine's default tactic. */
  aggression: { big_server: 0.65, baseliner: 0.5, counter_puncher: 0.35, serve_and_volley: 0.6, all_court: 0.5 },
} as const;
