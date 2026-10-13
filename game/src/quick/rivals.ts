// Rival memory (ADR-017): what the user has seen of each opponent, carried to the next meeting.
import type { Card } from '@tennis/engine';
import { QUICK_PERSONA } from '../tuning.ts';
import type { RivalRecord } from './types.ts';

export interface Meeting {
  opponent: string;
  /** Whether the user won. */
  won: boolean;
  /** The opponent's cards at this match's decision points, in order. */
  aiCards: readonly Card[];
}

/** The rival records after one more meeting; the input is left as it was. */
export function recordRival(rivals: Readonly<Record<string, RivalRecord>>, { opponent, won, aiCards }: Meeting): Record<string, RivalRecord> {
  const r = rivals[opponent] ?? { met: 0, wins: 0, losses: 0, seen: [] };
  const next = { met: r.met + 1, wins: r.wins + (won ? 1 : 0), losses: r.losses + (won ? 0 : 1), seen: [...r.seen, ...aiCards].slice(-QUICK_PERSONA.rivalSeen) };
  return { ...rivals, [opponent]: next };
}
