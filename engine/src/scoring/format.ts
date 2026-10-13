import type { ScoreState } from '../types.ts';

const CALLS = ['0', '15', '30', '40'];

/** Points as a tennis call from A's side: "30-15", "40-40", "AD-40"; tiebreak points as numbers. */
export function formatPoints(score: ScoreState): string {
  const [a, b] = score.points;
  if (score.tiebreak) return `${a}-${b}`;
  if (a >= 3 && b >= 3) {
    if (a === b) return '40-40';
    return a > b ? 'AD-40' : '40-AD';
  }
  return `${CALLS[a]}-${CALLS[b]}`;
}

/** Finished sets, current games and points from A's side: "6-4 3-2 30-15". */
export function formatScore(score: ScoreState): string {
  const parts = score.sets.map(([a, b]) => `${a}-${b}`);
  parts.push(`${score.games[0]}-${score.games[1]}`, formatPoints(score));
  return parts.join(' ');
}
