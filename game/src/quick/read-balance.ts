// Opponent-read measures for the balance report (ADR-017): the same matches as `winRate`, with what the bot saw at
// each decision, so the report can say how often habits applied, were played, and how often the bot won the matchup.
// Rematches (ADR-025) give every match a one-meeting rival record, won by the user or by the rival.
import { averagePlayer, type Card } from '@tennis/engine';
import { CARDS } from './cards.ts';
import { streamSeed } from '../rng.ts';
import { BEATEN_BY } from './ai.ts';
import { botMatch, STYLES, tiebreakConfig } from './balance.ts';
import type { Bot } from './bots.ts';
import { habitCard, HABITS } from './persona.ts';
import type { Habit, RivalRecord } from './types.ts';

export interface HabitCount {
  decisions: number;
  applies: number;
  played: number;
}

export interface ReadStats {
  win: number;
  decisions: number;
  /** Share of decisions where the bot's card beat the AI's, and where the AI's beat the bot's. */
  beat: number;
  beaten: number;
  /** Decisions where the AI's habit applied, and how often it then played the habit card. */
  habitApplies: number;
  habitShare: number;
  byHabit: Record<Habit, HabitCount>;
}

/** Match `i`'s rival record at a rematch after one meeting won by `lead`; its last big-point card cycles. */
export const rematch = (lead: 'user' | 'rival') => (i: number): RivalRecord =>
  ({ met: 1, wins: lead === 'user' ? 1 : 0, losses: lead === 'user' ? 0 : 1, seen: [CARDS[i % 3]!] });

/** `bot` (an average player) against an average AI of every style and persona, as `winRate` plays it; `rival` gives
 *  match `i` a rival record (a rematch), none by default. */
export function readStats(bot: Bot, n: number, seed: number, rival: (i: number) => RivalRecord | null = () => null): ReadStats {
  const byHabit = Object.fromEntries(HABITS.map((h) => [h, { decisions: 0, applies: 0, played: 0 }])) as Record<Habit, HabitCount>;
  let [wins, decisions, beat, beaten] = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const seen: { habit: Habit; card: Card | null }[] = [];
    const watching: Bot = (view) => {
      seen.push({ habit: view.ai.persona.habit, card: habitCard(view.ai) });
      return bot(view);
    };
    const { result, decisions: ds } = botMatch(tiebreakConfig(averagePlayer('Bot'), { ...averagePlayer('AI'), style: STYLES[i % 4]! }, i), streamSeed(seed, 'm', i), watching, { rival: rival(i) });
    if (result.winner === 'A') wins++;
    ds.forEach((d, k) => {
      const c = byHabit[seen[k]!.habit];
      c.decisions++;
      if (seen[k]!.card) {
        c.applies++;
        if (d.ai === seen[k]!.card) c.played++;
      }
      if (BEATEN_BY[d.ai] === d.user) beat++;
      if (BEATEN_BY[d.user] === d.ai) beaten++;
    });
    decisions += ds.length;
  }
  const counts = Object.values(byHabit);
  const applies = counts.reduce((a, c) => a + c.applies, 0);
  return {
    win: wins / n, decisions, beat: beat / decisions, beaten: beaten / decisions,
    habitApplies: applies / decisions, habitShare: counts.reduce((a, c) => a + c.played, 0) / applies, byHabit,
  };
}
