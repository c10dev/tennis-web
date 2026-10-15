// Tells (ADR-017): a visible sign before a decision, drawn after the AI's card is fixed. It points at the real card
// `tellAccuracy` of the time, otherwise at one of the other two. The game draws which of the card's texts to show
// (an index, ADR-022); the screens put it in words in their language.
import type { Card, Rng } from '@tennis/engine';
import { pick } from '../rng.ts';
import { en } from '../text/en.ts';
import type { Tell } from './types.ts';

/** The English tells; every language has the same number per card. */
export const TELL_TEXTS: Record<Card, readonly string[]> = en.tells;

const OTHERS: Record<Card, readonly Card[]> = { attack: ['defend', 'counter'], defend: ['attack', 'counter'], counter: ['attack', 'defend'] };

export function drawTell(card: Card, accuracy: number, rng: Rng): Tell {
  const shown = rng.next() < accuracy ? card : pick(rng, OTHERS[card]);
  return { card: shown, index: Math.floor(rng.next() * TELL_TEXTS[shown].length) };
}
