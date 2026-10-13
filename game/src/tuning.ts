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
