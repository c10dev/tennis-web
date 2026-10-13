// Card-playing bots for the balance report (ADR-017). A bot sees what a user would at a decision point (the AI's
// situation, its habit from the scouting line, and the tell) plus, for the ceiling bot, the AI's real odds.
import type { Card, Rng } from '@tennis/engine';
import { BEATEN_BY, CARDS, decisionOdds } from './ai.ts';
import { QUICK_AI } from '../tuning.ts';
import { habitCard } from './persona.ts';
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

/** Knows the AI's odds and plays the card that beats its most likely card: the ceiling of reading the AI. */
export const exploitBot: Bot = ({ ai }) => {
  const odds = decisionOdds(ai);
  return BEATEN_BY[CARDS[odds.indexOf(Math.max(...odds))]!];
};

/** Knows the opponent's habit (the scouting line names it): answers the habit card when the habit applies, otherwise
 *  plays any card. Uses nothing a user could not know. */
export const habitBot: Bot = (view) => {
  const card = habitCard(view.ai);
  return card ? BEATEN_BY[card] : randomBot(view);
};

/** Knows the habit and the style (both on the scouting line): outside the habit, answers the style's favourite card. */
export const scoutBot: Bot = ({ ai }) => {
  const mix: readonly number[] = QUICK_AI.base[ai.style][ai.role];
  return BEATEN_BY[habitCard(ai) ?? CARDS[mix.indexOf(Math.max(...mix))]!];
};

/** Believes the tell when there is one, otherwise plays any card. */
export const tellBot: Bot = (view) => (view.tell ? BEATEN_BY[view.tell.card] : randomBot(view));

/** Reads the AI half of the time, otherwise plays any card: the average user of the ladder targets. */
export const readerBot: Bot = (view) => (view.rng.next() < 0.5 ? exploitBot(view) : randomBot(view));
