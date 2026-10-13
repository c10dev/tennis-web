// Shared quick-match types (ADR-017): the match flow, the opponent read and the result screen all build on these.
import type { Card, PlayerId, PlayStyle, PointTag, Rng } from '@tennis/engine';

/** The user's plan for the points played without cards. */
export type GamePlan = 'aggressive' | 'balanced' | 'defensive';

/** An opponent's signature habit at big points: what makes them readable. */
export type Habit = 'big_point_attack' | 'counter_after_loss' | 'repeat_winner' | 'defend_when_ahead' | 'copy_user' | 'safe_on_match_point';

export interface Persona {
  habit: Habit;
  /** Chance that the tell shown before a decision points at the card the opponent really plays. */
  tellAccuracy: number;
}

/** A visible sign before a decision, pointing at a card (right `tellAccuracy` of the time). */
export interface Tell {
  card: Card;
  text: string;
}

/** A point where both players chose a card. Scores are tiebreak points, the user (A) first. */
export interface DecisionRecord {
  /** Index of the point in the match. */
  point: number;
  score: [number, number];
  user: Card;
  ai: Card;
  winner: PlayerId;
}

/** What the user has seen of one opponent across earlier meetings. */
export interface RivalRecord {
  met: number;
  wins: number;
  losses: number;
  /** The opponent's cards at big points in earlier meetings, oldest first. */
  seen: Card[];
}

/** Everything the AI weighs at a decision. Roles and scores are from the AI's (B's) side. */
export interface DecisionContext {
  style: PlayStyle;
  persona: Persona;
  role: 'serve' | 'return';
  /** Tiebreak points: [AI, user]. */
  score: [number, number];
  tags: readonly PointTag[];
  /** Who won the point just played (null before the first). */
  lastPointWinner: 'ai' | 'user' | null;
  /** Earlier decisions this match, from the AI's side: its card, the user's, and who won. */
  decisions: readonly { own: Card; user: Card; won: boolean }[];
  rival: RivalRecord | null;
  fatigue: number;
  rng: Rng;
}

export interface AiDecision {
  card: Card;
  tell: Tell | null;
}

/** The opponent as the choose screen shows them: nothing the user could not have seen. */
export interface OpponentRead {
  scouting: string;
  /** Their cards at this match's earlier decisions, with the score each came at. */
  history: { score: string; card: Card }[];
  tell: string | null;
  rival: string | null;
}

/** The point the result screen replays: the user's choice that decided the match, named. */
export interface DecisiveMoment {
  point: number;
  score: string;
  user: Card;
  ai: Card;
  won: boolean;
  line: string;
}

export interface Overtake {
  id: string;
  name: string;
  rank: number;
}

/** A rating as the result screen shows it: whole numbers on a 0–100 scale. */
export interface StatChange {
  key: string;
  label: string;
  before: number;
  after: number;
}

export interface NextGoal {
  label: string;
  winsNeeded: number;
}
