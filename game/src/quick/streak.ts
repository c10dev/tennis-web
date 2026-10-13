// Win streaks (proposal P3, option A): counted from the ladder history, shown on the result and the ladder home, never
// paid out, so the ladder's balance is untouched. The history is append-only, so the best run needs no new save field.
import { QUICK_STREAK } from '../tuning.ts';

export const STREAK_MILESTONES: readonly number[] = QUICK_STREAK.milestones;

export interface WinStreak {
  /** Wins in a row at the end of the history. */
  current: number;
  best: number;
  /** The milestone the last match reached (3, 5, 10), or null. */
  milestone: number | null;
}

export function winStreak(history: readonly { won: boolean }[]): WinStreak {
  let current = 0;
  let best = 0;
  for (const r of history) {
    current = r.won ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return { current, best, milestone: STREAK_MILESTONES.includes(current) ? current : null };
}
