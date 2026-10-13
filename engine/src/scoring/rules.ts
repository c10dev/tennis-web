// Pure rule predicates used by the scoring state machine (GDD §6).
import type { MatchRules, PlayerId } from '../types.ts';

export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');
export const index = (p: PlayerId): 0 | 1 => (p === 'A' ? 0 : 1);

/** Game won by `i` from raw points. With No-Ad the point at deuce (3-3) decides it. */
export function gameWon(points: readonly [number, number], i: 0 | 1, noAd: boolean): boolean {
  const own = points[i];
  const opp = points[1 - i]!;
  if (noAd) return own === 4;
  return own >= 4 && own - opp >= 2;
}

export function tiebreakWon(points: readonly [number, number], i: 0 | 1, target: number): boolean {
  return points[i] >= target && points[i] - points[1 - i]! >= 2;
}

/** Server of the tiebreak point with 0-based number n: first serves one point, then two each. */
export function tiebreakServer(first: PlayerId, n: number): PlayerId {
  return Math.floor((n + 1) / 2) % 2 === 1 ? other(first) : first;
}

export function isFinalSet(rules: MatchRules, completedSets: number): boolean {
  return completedSets === rules.bestOf - 1;
}

export function tiebreakAtSixAll(rules: MatchRules, finalSet: boolean): boolean {
  return !(finalSet && rules.finalSet === 'advantage');
}

export function tiebreakTarget(rules: MatchRules, finalSet: boolean): number {
  return finalSet && rules.finalSet === 'tiebreak10' ? 10 : 7;
}

/** Set won by `i` after a game: 6+ games two clear, or the tiebreak game that made it 7-6. */
export function setWon(games: readonly [number, number], i: 0 | 1, wasTiebreak: boolean): boolean {
  return wasTiebreak || (games[i] >= 6 && games[i] - games[1 - i]! >= 2);
}

export function setsToWin(rules: MatchRules): number {
  return (rules.bestOf + 1) / 2;
}
