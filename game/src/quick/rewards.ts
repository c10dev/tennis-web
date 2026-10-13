// What a quick match teaches (ADR-016): every card played adds progress to the ratings behind it, more for a win.
import type { Card } from '@tennis/engine';
import { QUICK, type Rated } from '../tuning.ts';

export function cardReward(cards: readonly Card[], won: boolean): Partial<Record<Rated, number>> {
  const out: Partial<Record<Rated, number>> = {};
  const per = QUICK.xpPerCard * (won ? QUICK.winXp : 1);
  for (const card of cards) for (const k of QUICK.rewardStats[card]) out[k] = (out[k] ?? 0) + per;
  return out;
}
