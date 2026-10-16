// The words of the quick-match screens (ADR-022), one catalog per language. Views take a catalog (English by
// default) and keep their numbers and choices language-free, so the same record reads the same in either language.
import type { Card, PlayStyle, ShotType, Surface, Wing } from '@tennis/engine';
import type { GamePlan, Habit } from '../quick/types.ts';

export type Lang = 'en' | 'ko';
export type Role = 'serve' | 'return';
export type Ending = 'ace' | 'double_fault' | 'winner' | 'forced_error' | 'error';

export interface Messages {
  readonly lang: Lang;
  card: Record<Card, string>;
  flavour: Record<Role, Record<Card, string>>;
  /** "Your serve · 5-4". */
  situation(role: Role, score: string): string;
  moment: { matchPoint: string; matchPointDown: string; all(n: number): string; big: string };
  how: Record<'ace' | 'double_fault' | 'winner' | 'unforced_error' | 'forced_error' | 'other', string>;
  plan: Record<GamePlan, { label: string; line: string }>;
  style: Record<PlayStyle, string>;
  surface: Record<Surface, string>;
  rating: Record<string, string>;
  /** The habit said about the player (full name given). */
  habit(name: string, habit: Habit): string;
  scouting(name: string, style: string, habit: Habit): string;
  rival(record: { wins: number; losses: number }, most: { card: Card; n: number; of: number } | null): string;
  /** The plan that throws this style off balance, said before the match (ADR-025). */
  planTip(plan: GamePlan, style: PlayStyle): string;
  /** Tells per card; the game draws an index, so every language needs the same count. */
  tells: Record<Card, readonly string[]>;
  /** The decisive point named: `matchup` > 0 when the user's card beat theirs; `won` when the user won the point. */
  decisive(d: { score: string; user: Card; ai: Card; matchup: number; won: boolean }): string;
  noCards(won: boolean): string;
  headline(won: boolean, score: string): string;
  concededHeadline(score: string): string;
  goal: { stay: string; first: string; top(n: number): string; line(wins: number, label: string): string };
  pbp: {
    opening(score: string, userServes: boolean): string;
    cards(user: Card, ai: Card): string;
    noCards: string;
    serve(first: boolean, kmh: number): string;
    rally(shots: number): string;
    stroke(shot: ShotType, wing: Wing): string;
    ending(kind: Ending, user: boolean, stroke: string): string;
    close(userWon: boolean, matchOver: boolean, score: string): string;
  };
}

/** "Min-jun Kim" → "Kim". */
export const surname = (name: string): string => name.split(' ').at(-1)!;
