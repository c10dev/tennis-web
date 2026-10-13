// The three quick-match cards and what beats what (ADR-015): attack > defend > counter > attack.
import type { Card } from '@tennis/engine';

export const CARDS: readonly Card[] = ['attack', 'defend', 'counter'];
/** The card that beats each card. */
export const BEATEN_BY: Record<Card, Card> = { attack: 'counter', defend: 'attack', counter: 'defend' };
