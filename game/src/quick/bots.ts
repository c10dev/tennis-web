// Card-playing bots for the balance report (ADR-016). Each sees what the AI sees (its context), so the exploit bot
// is the ceiling of reading the AI perfectly, and the reader bot an average user who reads it half the time.
import type { Card, Rng } from '@tennis/engine';
import { BEATEN_BY, CARDS, cardOdds, type CardContext } from './ai.ts';

export type Bot = (aiContext: CardContext & { rng: Rng }) => Card;

export const fixedBot = (card: Card): Bot => () => card;

export const randomBot: Bot = ({ rng }) => CARDS[Math.floor(rng.next() * 3)]!;

/** Plays the card that beats the AI's most likely card. */
export const exploitBot: Bot = (ctx) => {
  const odds = cardOdds(ctx);
  return BEATEN_BY[CARDS[odds.indexOf(Math.max(...odds))]!];
};

/** Reads the AI half of the time, otherwise plays any card. */
export const readerBot: Bot = (ctx) => (ctx.rng.next() < 0.5 ? exploitBot(ctx) : randomBot(ctx));
