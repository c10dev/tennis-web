import type { PlayerAttributes, PlayerProfile, PlayStyle } from '../types.ts';

type Ratings = Partial<Omit<PlayerAttributes, 'surfaceAffinity'>>;

/** Reference "average tour player" for batch tuning (ADR-002): every rating 13. */
export function averagePlayer(name: string): PlayerProfile {
  return playerWith(name, {});
}

/** Big server: serve ratings 17+ and average elsewhere (GDD M1 target: 1.0+ aces per service game). */
export function bigServer(name: string): PlayerProfile {
  return playerWith(name, { servePower: 18, serveAccuracy: 17, secondServe: 15 }, 'big_server');
}

export function playerWith(name: string, ratings: Ratings, style: PlayStyle = 'all_court'): PlayerProfile {
  const base: PlayerAttributes = {
    servePower: 13, serveAccuracy: 13, secondServe: 13, forehand: 13, backhand: 13, return: 13,
    volley: 13, overhead: 13, slice: 13, dropShot: 13,
    movement: 13, agility: 13, stamina: 13, strength: 13,
    composure: 13, concentration: 13, aggression: 13, consistency: 13, decision: 13,
    injuryProneness: 13,
    surfaceAffinity: { hard: 13, clay: 13, grass: 13 },
  };
  return { name, style, attributes: { ...base, ...ratings } };
}
