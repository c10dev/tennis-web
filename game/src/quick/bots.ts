// Card-playing bots for the balance report (ADR-017). A bot sees what a user would at a decision point (the AI's
// situation and the tell) plus, for the ceiling bots, the AI's real odds.
import type { Card, Rng } from '@tennis/engine';
import { BEATEN_BY, CARDS, decisionOdds } from './ai.ts';
import type { DecisionContext, Tell } from './types.ts';

export interface BotView {
  /** The AI's side of the decision (its own random stream left out). */
  ai: Omit<DecisionContext, 'rng'>;
  tell: Tell | null;
  rng: Rng;
}

export type Bot = (view: BotView) => Card;

export const fixedBot = (card: Card): Bot => () => card;

export const randomBot: Bot = ({ rng }) => CARDS[Math.floor(rng.next() * 3)]!;

/** Knows the AI's odds and plays the card that beats its most likely card: knowing the habit perfectly. */
export const exploitBot: Bot = ({ ai }) => {
  const odds = decisionOdds(ai);
  return BEATEN_BY[CARDS[odds.indexOf(Math.max(...odds))]!];
};

/** Believes the tell when there is one, otherwise plays any card. */
export const tellBot: Bot = (view) => (view.tell ? BEATEN_BY[view.tell.card] : randomBot(view));

/** Reads the AI half of the time, otherwise plays any card: the average user of the ladder targets. */
export const readerBot: Bot = (view) => (view.rng.next() < 0.5 ? exploitBot(view) : randomBot(view));
