// What a quick match teaches (ADR-016/017): every card played adds progress to the ratings behind it, more for a
// win; a win also lifts one rating behind the decisive card to its next whole number on the 0–100 scale, and a loss
// moves it at half that pace (at most `lossStep`).
import type { Card } from '@tennis/engine';
import { QUICK, QUICK_REWARD, type Rated } from '../tuning.ts';
import type { CareerPlayer } from '../types.ts';
import { decisiveMoment } from './highlight.ts';
import type { DecisionRecord, GamePlan } from './types.ts';

type Reward = Partial<Record<Rated, number>>;

/** A rating (with its progress) as shown: a whole number, 5–100 for 1–20. */
export const displayRating = (value: number): number => Math.floor(value * QUICK_REWARD.displayScale + 1e-6);

export function cardReward(cards: readonly Card[], won: boolean): Reward {
  const out: Reward = {};
  const per = QUICK.xpPerCard * (won ? QUICK.winXp : 1);
  for (const card of cards) for (const k of QUICK.rewardStats[card]) out[k] = (out[k] ?? 0) + per;
  return out;
}

/** The match's training: card progress, plus a step towards the next whole number on the nearest rating behind the
 *  decisive card: all the way on a win, at most `lossStep` on a loss. */
export function matchReward(me: CareerPlayer, m: { won: boolean; decisions: readonly DecisionRecord[]; plan: GamePlan }): Reward {
  const out = cardReward(m.decisions.map((d) => d.user), m.won);
  if (!m.won && m.decisions.length === 0) return out;
  const moment = decisiveMoment(m);
  const cards: readonly Card[] = moment ? [moment.user] : QUICK_REWARD.planCards[m.plan];
  const value = (k: Rated) => me.attributes[k] + (me.progress[k] ?? 0) + (out[k] ?? 0);
  const step = (k: Rated) => (displayRating(value(k)) + 1) / QUICK_REWARD.displayScale - value(k);
  const open = cards.flatMap((c) => QUICK.rewardStats[c]).filter((k) => me.attributes[k] < 20);
  const nearest = open.reduce<Rated | null>((best, k) => (best === null || step(k) < step(best) ? k : best), null);
  if (nearest) out[nearest] = (out[nearest] ?? 0) + (m.won ? step(nearest) : Math.min(step(nearest), QUICK_REWARD.lossStep));
  return out;
}
