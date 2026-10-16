// Rival memory (ADR-017): what the user has seen of each opponent, carried to the next meeting. A rival adapts to the
// head to head (ADR-025): wary of the user's read when the user leads, confident in its habit when it does.
import type { Card } from '@tennis/engine';
import { QUICK_PERSONA } from '../tuning.ts';
import { BEATEN_BY } from './cards.ts';
import type { RivalRecord } from './types.ts';

export interface Meeting {
  opponent: string;
  /** Whether the user won. */
  won: boolean;
  /** The opponent's cards at this match's decision points, in order. */
  aiCards: readonly Card[];
}

export type RivalStance = 'wary' | 'confident';

/** The record after one more meeting; the input is left as it was. */
export function recordRival(rivals: Readonly<Record<string, RivalRecord>>, { opponent, won, aiCards }: Meeting): Record<string, RivalRecord> {
  const r = rivals[opponent] ?? { met: 0, wins: 0, losses: 0, seen: [] };
  const next = { met: r.met + 1, wins: r.wins + (won ? 1 : 0), losses: r.losses + (won ? 0 : 1), seen: [...r.seen, ...aiCards].slice(-QUICK_PERSONA.rivalSeen) };
  return { ...rivals, [opponent]: next };
}

/** How a rival meets the user again: wary when the user leads the head to head, confident when it leads. */
export function rivalStance(r: RivalRecord | null): RivalStance | null {
  if (!r || r.wins === r.losses) return null;
  return r.wins > r.losses ? 'wary' : 'confident';
}

/** A wary rival's switch from its habit card: the card that beats the user's answer to it. */
export const switchCard = (habit: Card): Card => BEATEN_BY[BEATEN_BY[habit]];
