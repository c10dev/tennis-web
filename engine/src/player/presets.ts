import type { PlayerAttributes, PlayerProfile, PlayStyle } from '../types.ts';

type Ratings = Partial<Omit<PlayerAttributes, 'surfaceAffinity'>>;

/** Every attribute at the same rating, surface affinity included. */
function uniform(rating: number): PlayerAttributes {
  return {
    servePower: rating, serveAccuracy: rating, secondServe: rating, forehand: rating, backhand: rating, return: rating,
    volley: rating, overhead: rating, slice: rating, dropShot: rating,
    movement: rating, agility: rating, stamina: rating, strength: rating,
    composure: rating, concentration: rating, aggression: rating, consistency: rating, decision: rating,
    injuryProneness: rating,
    surfaceAffinity: { hard: rating, clay: rating, grass: rating },
  };
}

/** Reference "average tour player" for batch tuning (ADR-002): every rating 13. */
export function averagePlayer(name: string): PlayerProfile {
  return ratedPlayer(name, 13);
}

/** Every rating, surface affinity included, at `rating`: the skill ladder in batch checks. */
export function ratedPlayer(name: string, rating: number): PlayerProfile {
  return { name, style: 'all_court', attributes: uniform(rating) };
}

/** Big server: serve ratings 17+ and average elsewhere (GDD M1 target: 1.0+ aces per service game). */
export function bigServer(name: string): PlayerProfile {
  return playerWith(name, { servePower: 18, serveAccuracy: 17, secondServe: 15 }, 'big_server');
}

/** An average player with some ratings changed. */
export function playerWith(name: string, ratings: Ratings, style: PlayStyle = 'all_court'): PlayerProfile {
  return { name, style, attributes: { ...uniform(13), ...ratings } };
}
