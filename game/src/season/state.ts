// Season state (ADR-011): everything a save needs, as plain JSON. Updated only by pure functions returning copies.
import type { MatchRecipe, Surface } from '@tennis/engine';
import type { Tournament } from '../calendar/schedule.ts';
import type { Tier } from '../calendar/tiers.ts';
import { generateWorld } from '../world/generate.ts';
import type { Focus, Intensity } from '../player/week.ts';
import { overall } from '../player/overall.ts';
import { rankingOrder, rankingPoints } from '../ranking.ts';
import type { Bracket } from '../tournament/bracket.ts';
import type { CareerPlayer, World } from '../types.ts';

export type UserChoice = { kind: 'enter' } | { kind: 'train'; focus: Focus; intensity: Intensity } | { kind: 'rest' };

export interface Standing {
  /** This season's ranking points and prize money. */
  season: number;
  prize: number;
  /** Ranking at the start of the season, which sets the fading carryover. */
  startRank: number;
}

export interface MatchRecord {
  round: number;
  a: string;
  b: string;
  winner: string;
  /** Set scores from a's side, e.g. "6-4 3-6 7-6". */
  score: string;
  sets: number;
  /** Kept for the user's matches only: enough to replay them (ADR-012). */
  recipe?: MatchRecipe;
}

export interface TournamentState {
  tournament: Tournament;
  bracket: Bracket;
  matches: MatchRecord[];
  /** Sets each entrant has played this week: fatigue within the tournament. */
  setsPlayed: Record<string, number>;
  done: boolean;
}

export interface TournamentRecord {
  id: string;
  name: string;
  week: number;
  tier: Tier;
  surface: Surface;
  champion: string;
  /** Every entrant's rounds won (a bye counts). */
  roundsWon: Record<string, number>;
  /** The user's matches, with recipes. */
  userMatches: MatchRecord[];
}

export interface SeasonState {
  seed: number;
  /** 1–24; 25 once the season is over. */
  week: number;
  world: World;
  standings: Record<string, Standing>;
  startRanking: string[];
  /** What each player does this week when not playing the tournament (set by beginWeek). */
  plans: Record<string, UserChoice>;
  tournament: TournamentState | null;
  /** Last week each player played a tournament: back-to-back events add travel fatigue. */
  lastPlayed: Record<string, number>;
  /** Injuries suffered this season, per player. */
  injuries: Record<string, number>;
  history: TournamentRecord[];
}

export function newSeason(seed: number, user: CareerPlayer): SeasonState {
  const world = generateWorld(seed, user);
  const startRanking = rankingOrder(world.players.map((p) => ({ id: p.id, points: 0, level: overall(p) })));
  const standings = Object.fromEntries(startRanking.map((id, i) => [id, { season: 0, prize: 0, startRank: i + 1 }]));
  return { seed, week: 1, world, standings, startRanking, plans: {}, tournament: null, lastPlayed: {}, injuries: {}, history: [] };
}

export const playerById = (s: SeasonState, id: string): CareerPlayer => s.world.players.find((p) => p.id === id)!;

/** Best first, as of this week. */
export function currentRanking(s: SeasonState): string[] {
  return rankingOrder(s.world.players.map((p) => ({ id: p.id, points: rankingPoints(s.standings[p.id]!, s.week - 1), level: overall(p) })));
}
