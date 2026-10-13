// Event and data schema shared by the engine and its consumers (GDD §7).
// Changing anything here means bumping SCHEMA_VERSION and recording an ADR (CLAUDE.md rule 6).

export const SCHEMA_VERSION = 1;

export type PlayerId = 'A' | 'B';
export type Surface = 'hard' | 'clay' | 'grass';
export type ShotType = 'serve' | 'return' | 'drive' | 'slice' | 'lob' | 'drop' | 'volley' | 'overhead' | 'approach';
export type Wing = 'forehand' | 'backhand';
export type Outcome = 'in' | 'winner' | 'ace' | 'fault' | 'double_fault' | 'unforced_error' | 'forced_error' | 'net';
export type PlayStyle = 'big_server' | 'baseliner' | 'counter_puncher' | 'serve_and_volley' | 'all_court';

/** Court coordinates in metres. Origin at the centre of the net, y along the court (A starts at y < 0). */
export interface Vec2 { x: number; y: number }
/** As Vec2, plus height z above the ground. */
export interface Vec3 { x: number; y: number; z: number }

/** Ratings are whole numbers 1–20 (FM style); the engine normalises them to 0–1. */
export interface PlayerAttributes {
  servePower: number;
  serveAccuracy: number;
  secondServe: number;
  forehand: number;
  backhand: number;
  return: number;
  volley: number;
  overhead: number;
  slice: number;
  dropShot: number;
  movement: number;
  agility: number;
  stamina: number;
  strength: number;
  composure: number;
  concentration: number;
  aggression: number;
  consistency: number;
  decision: number;
  injuryProneness: number;
  surfaceAffinity: Record<Surface, number>;
}

export interface PlayerProfile {
  name: string;
  style: PlayStyle;
  attributes: PlayerAttributes;
}

export interface Tactic {
  /** 0 (safe) to 1 (all-out). */
  aggression: number;
  /** 0–1. Stored and reported, no effect in M1 (TD-001). */
  netApproach: number;
  targetBackhand: boolean;
  serveTarget: 'wide' | 'body' | 't' | 'mix';
}

/** 'tiebreak10': at 6-6 in the final set a 10-point tiebreak by 2 (the Grand Slam rule). */
export type FinalSetMode = 'tiebreak7' | 'tiebreak10' | 'advantage';

export interface MatchRules {
  bestOf: 3 | 5;
  noAd: boolean;
  finalSet: FinalSetMode;
}

export interface MatchConfig {
  players: [PlayerProfile, PlayerProfile];
  surface: Surface;
  rules: MatchRules;
  tactics: [Tactic, Tactic];
  firstServer: PlayerId;
}

export interface ShotEvent {
  type: 'shot';
  /** Seconds since the start of the point. */
  t: number;
  hitter: PlayerId;
  shot: ShotType;
  wing?: Wing;
  from: Vec3;
  /** First bounce; outside the court when the shot is out. Absent when the ball does not bounce (net). */
  bounce?: Vec2;
  speedKmh: number;
  spinRpm: number;
  /** Height above the net tape in metres; negative means the ball hit the net. */
  netClearance: number;
  outcome: Outcome;
  hitterPos: Vec2;
  receiverPos: Vec2;
}

export interface ScoreState {
  /** Games of every finished set. */
  sets: [number, number][];
  games: [number, number];
  /** Raw points in the current game or tiebreak (0, 1, 2…); see scoring/format.ts for 15/30/40. */
  points: [number, number];
  tiebreak: boolean;
  server: PlayerId;
}

export type PointTag = 'break_point' | 'set_point' | 'match_point' | 'tiebreak';

export interface PointEvent {
  type: 'point';
  index: number;
  server: PlayerId;
  winner: PlayerId;
  serveNumber: 1 | 2;
  rallyLength: number;
  endedBy: Outcome;
  shots: ShotEvent[];
  scoreBefore: ScoreState;
  scoreAfter: ScoreState;
  tags: PointTag[];
  durationSec: number;
}

export interface MatchStats {
  aces: [number, number];
  doubleFaults: [number, number];
  firstServePct: [number, number];
  winners: [number, number];
  unforcedErrors: [number, number];
  /** "converted/opportunities" per player, e.g. "3/7". */
  breakPoints: [string, string];
  avgRally: number;
}

export type MatchEvent =
  | { type: 'match_start'; seed: number; surface: Surface; players: [string, string]; bestOf: 3 | 5 }
  | PointEvent
  | { type: 'game_end'; winner: PlayerId; score: ScoreState; isBreak: boolean }
  | { type: 'set_end'; winner: PlayerId; score: ScoreState }
  | { type: 'changeover'; score: ScoreState }
  | { type: 'tactic_change'; player: PlayerId; tactic: Tactic }
  | { type: 'match_end'; winner: PlayerId; score: ScoreState; stats: MatchStats };

export interface MatchResult {
  schemaVersion: typeof SCHEMA_VERSION;
  seed: number;
  config: MatchConfig;
  events: MatchEvent[];
  winner: PlayerId;
  stats: MatchStats;
}
