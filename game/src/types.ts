// Career data: players with the hidden and dynamic state a season needs (ADR-011).
import type { PlayerAttributes, PlayStyle } from '@tennis/engine';

export interface CareerPlayer {
  id: string;
  name: string;
  style: PlayStyle;
  attributes: PlayerAttributes;
  age: number;
  /** Hidden: the overall level this player can grow to. */
  potential: number;
  /** Training progress towards the next point, per rating (0–1). */
  progress: Partial<Record<keyof PlayerAttributes, number>>;
  /** 0 fresh – 1 exhausted; carried into matches as starting fatigue. */
  fatigue: number;
  /** Weeks still out injured. */
  injuryWeeks: number;
}

export interface World {
  players: CareerPlayer[];
  userId: string;
}
