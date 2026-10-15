// Display strings shared by the screens.
import type { Surface } from '@tennis/engine';
import { en } from '../text/en.ts';

/** Round 1 is the first round of a draw of `size`. */
export function roundName(size: number, round: number): string {
  const left = size / 2 ** (round - 1);
  return left === 2 ? 'Final' : left === 4 ? 'Semifinal' : left === 8 ? 'Quarterfinal' : `Round of ${left}`;
}

/** What `roundsWon` means in a draw of `size`. */
export function resultLabel(size: number, roundsWon: number): string {
  const rounds = Math.log2(size);
  if (roundsWon >= rounds) return 'Champion';
  if (roundsWon === rounds - 1) return 'Runner-up';
  return `Lost in ${roundName(size, roundsWon + 1).toLowerCase()}`;
}

export const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${tail}`;
}

export const SURFACE_LABEL: Record<Surface, string> = en.surface;

export function fatigueLabel(f: number): string {
  return f < 0.2 ? 'Fresh' : f < 0.45 ? 'Fit' : f < 0.7 ? 'Tired' : 'Exhausted';
}

export const STYLE_LABEL = en.style;

export const RATING_LABEL: Record<string, string> = en.rating;
