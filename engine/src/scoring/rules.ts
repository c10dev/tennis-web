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

/** Tiebreak won at `target` points, two clear, or one clear when `winBy` is 1 (Fast4's deciding point at 4-4). */
export function tiebreakWon(points: readonly [number, number], i: 0 | 1, target: number, winBy = 2): boolean {
  return points[i] >= target && points[i] - points[1 - i]! >= winBy;
}

const fast4 = (rules: MatchRules) => rules.setFormat === 'fast4';
/** Sets that are a tiebreak and nothing else (ADR-017). */
export const tiebreakSets = (rules: MatchRules): boolean => rules.setFormat === 'tiebreak';

/** Games that win a set, and the games-all score that brings a tiebreak. */
export const setGames = (rules: MatchRules): number => (fast4(rules) ? 4 : 6);
export const tiebreakAt = (rules: MatchRules): number => (fast4(rules) ? 3 : 6);
export const tiebreakWinBy = (rules: MatchRules): number => (fast4(rules) ? 1 : 2);

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
  if (fast4(rules)) return 5;
  return finalSet && rules.finalSet === 'tiebreak10' ? 10 : 7;
}

/** Set won by `i` after a game: enough games two clear, or the tiebreak game. */
export function setWon(games: readonly [number, number], i: 0 | 1, wasTiebreak: boolean, rules: MatchRules): boolean {
  return wasTiebreak || (games[i] >= setGames(rules) && games[i] - games[1 - i]! >= 2);
}

export function setsToWin(rules: MatchRules): number {
  return (rules.bestOf + 1) / 2;
}
