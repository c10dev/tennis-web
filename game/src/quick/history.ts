// The quick match history kept small (ADR-026): the last few matches whole, every older one as a summary.
import { QUICK_SAVE } from '../tuning.ts';
import type { PastRecord, QuickRecord } from './ladder.ts';

/** A match as home and the ladder still need it once its recipe, ratings and decisions are let go. */
export function summarise(r: PastRecord): PastRecord {
  const { matchNo, opponent, opponentRank, won, score, pointsDelta, rankBefore, rankAfter, fingerprint } = r;
  return { matchNo, opponent, opponentRank, won, score, pointsDelta, rankBefore, rankAfter, fingerprint, ...(r.conceded ? { conceded: true as const } : {}) };
}

/** Whether a record can still be replayed and shown on the result screen (older saves may have lost the recipe). */
const whole = (r: Partial<QuickRecord>): r is QuickRecord =>
  typeof r.recipe?.config === 'object' && typeof r.recipe.seed === 'number' && Array.isArray(r.progress);

/**
 * Splits the matches, oldest first, into the last `keep` whole ones (`history`) and summaries of the rest (`past`).
 * A record that is not whole goes to `past` with every record before it, so the two stay in match order.
 */
export function compactHistory(past: readonly PastRecord[], history: readonly Partial<QuickRecord>[], keep = QUICK_SAVE.recipes): { past: PastRecord[]; history: QuickRecord[] } {
  let start = history.length;
  while (start > 0 && history.length - start < keep && whole(history[start - 1]!)) start--;
  return {
    past: [...past, ...history.slice(0, start).map((r) => summarise(r as PastRecord))],
    history: history.slice(start) as QuickRecord[],
  };
}

/** Every match the user played, oldest first: the summaries, then the whole records. */
export const allMatches = (s: { past: readonly PastRecord[]; history: readonly PastRecord[] }): readonly PastRecord[] => [...s.past, ...s.history];
