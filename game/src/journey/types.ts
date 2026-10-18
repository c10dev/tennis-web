// The text career's state (ADR-032): one user from age 14 to retirement in a world that ages around them.
// Plain JSON: saves store it as it is.
import type { MatchRecipe, Surface } from '@tennis/engine';
import type { CareerPlayer } from '../types.ts';
import type { Group } from './ratings.ts';

export type Nation = 'KOR' | 'JPN' | 'CHN' | 'USA' | 'GBR' | 'AUS' | 'ESP' | 'ARG' | 'ITA' | 'FRA' | 'GER' | 'SUI' | 'SRB' | 'CZE';
export type Hand = 'right' | 'left';
export type Load = 'heavy' | 'normal' | 'peak';
export type Stage = 'junior' | 'college' | 'pro' | 'retired';
export type JTier = 'jr' | 'jrMajor' | 'futures' | 'challenger' | 't250' | 'masters' | 'major' | 'finals';

export interface JPlayer extends CareerPlayer {
  nation: Nation;
}

export interface UserState {
  player: JPlayer;
  hand: Hand;
  stage: Stage;
  /** 0–100: lifts or drags match level a little; moved by results and choices. */
  morale: number;
  /** 0–100: brings offers and the press. */
  reputation: number;
  money: number;
  /** Groups trained on purpose, 1–2. */
  focus: Group[];
  /** 0 none, 1 a good coach, 2 an elite one: faster growth, a fee every swing. */
  coach: 0 | 1 | 2;
  /** A sponsor's fee every swing, and how many swings it still runs. */
  sponsor: { fee: number; swings: number } | null;
  /** Swings still away from the tour (0 playing), and why. */
  injury: number;
  away?: 'injury' | 'service' | undefined;
  /** College years left (stage 'college'). */
  college: number;
  /** Best overall reached, for retirement advice. */
  peak: number;
  /** Exempt from military service (a Korean player with an Asian Games gold or an Olympic medal). */
  exempt?: boolean;
  /** A wild card into the next swing's Major. */
  wildcard?: boolean;
}

export interface CareerStats {
  wins: number;
  losses: number;
  titles: number;
  majors: number;
  juniorTitles: number;
  juniorMajors: number;
  /** Major titles by surface name of the event, for the summary. */
  majorWins: string[];
  finals: number;
  bestRank: number | null;
  bestJuniorRank: number | null;
  /** Swings ended ranked first (13 weeks each). */
  swingsAtOne: number;
  prize: number;
  /** Head to head by AI id: [won, lost]. */
  h2h: Record<string, [number, number]>;
}

export interface MatchLine {
  round: number;
  opponent: string;
  opponentName: string;
  opponentRank: number | null;
  won: boolean;
  score: string;
  /** Kept for big matches, so their text commentary can be played again. */
  recipe?: MatchRecipe;
}

export interface EventResult {
  id: string;
  name: string;
  tier: JTier;
  surface: Surface;
  /** Rounds won (a bye counts) and the rounds the draw has. */
  roundsWon: number;
  rounds: number;
  champion: boolean;
  points: number;
  prize: number;
  matches: MatchLine[];
}

export interface SwingReport {
  year: number;
  swing: number;
  age: number;
  stage: Stage;
  events: EventResult[];
  rankBefore: number | null;
  rankAfter: number | null;
  juniorRankBefore: number | null;
  juniorRankAfter: number | null;
  ovrBefore: number;
  ovrAfter: number;
  groupsBefore: Record<Group, number>;
  groupsAfter: Record<Group, number>;
  /** Swings out from an injury picked up in this swing (0 none). */
  injured: number;
  /** Achievements unlocked this swing (ids for the text layer). */
  milestones: string[];
  money: number;
}

export interface Plan {
  load: Load;
  focus: Group[];
}

export interface JourneyState {
  seed: number;
  /** 1 is the user's first year; swing 0–3 is the next one to play. */
  year: number;
  swing: number;
  user: UserState;
  pros: JPlayer[];
  juniors: JPlayer[];
  /** Next AI id number. */
  nextId: number;
  /** Ranking points of the last four swings, by player id, index = swing slot (0–3). */
  points: Record<string, number[]>;
  juniorPoints: Record<string, number[]>;
  stats: CareerStats;
  reports: SwingReport[];
  /** Ids of events already seen (life events that happen once). */
  seen: string[];
  /** Choices waiting for the user before the next swing (events and offers). */
  pending: PendingChoice[];
  /** Short lines the next report shows first (the outcome of the last choices). */
  notes: string[];
}

export interface PendingChoice {
  event: string;
  /** Values the event's text fills in (names, money). */
  vars: Record<string, string | number>;
}
