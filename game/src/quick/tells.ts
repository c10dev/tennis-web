// Tells (ADR-017): a visible sign before a decision, drawn after the AI's card is fixed. It points at the real card
// `tellAccuracy` of the time, otherwise at one of the other two; the text always describes the card it points at.
import type { Card, Rng } from '@tennis/engine';
import { pick } from '../rng.ts';
import type { Tell } from './types.ts';

export const TELL_TEXTS: Record<Card, readonly string[]> = {
  attack: ['bounces on the toes, looking to step in', 'creeps up inside the baseline', 'grips the racket hard, eyes on the lines', 'bounces the ball fast, impatient'],
  defend: ['drifts back behind the baseline', 'settles deep, knees bent', 'takes a long breath and slows down', 'towels off, in no hurry'],
  counter: ['stays light, shuffling side to side', 'watches your feet closely', 'holds the racket out in front, compact', 'half-steps in, then back again'],
};

const OTHERS: Record<Card, readonly Card[]> = { attack: ['defend', 'counter'], defend: ['attack', 'counter'], counter: ['attack', 'defend'] };

export function drawTell(card: Card, accuracy: number, rng: Rng): Tell {
  const shown = rng.next() < accuracy ? card : pick(rng, OTHERS[card]);
  return { card: shown, text: pick(rng, TELL_TEXTS[shown]) };
}
