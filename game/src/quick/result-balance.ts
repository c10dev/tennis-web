// The result screen's balance measures (ADR-017): over whole ladders, how often a won match shows a rating rise on
// the 0–100 scale and how often the decisive moment is found.
import { createPlayer, defaultAllocation } from '../player/create.ts';
import { streamSeed } from '../rng.ts';
import { playMatch } from './balance.ts';
import type { Bot } from './bots.ts';
import { decisiveMoment } from './highlight.ts';
import { finishQuick, newLadder, type QuickRecord } from './ladder.ts';
import { startQuick } from './match.ts';
import { displayRating } from './rewards.ts';

export interface ResultStats {
  matches: number;
  wins: number;
  /** Won matches where a shown (0–100) rating rose. */
  visibleWins: number;
  withDecision: number;
  decisiveFound: number;
  overtakes: number;
  /** Shown rating points gained, all ratings and matches. */
  shownGain: number;
}

export const visibleGain = (r: QuickRecord): number => r.progress.reduce((sum, p) => sum + displayRating(p.after) - displayRating(p.before), 0);

/** Plays `runs` ladders of `matches` matches with `bot` (the same ladders as `ladderPace`) and counts the result measures. */
export function resultStats(bot: Bot, runs: number, matches: number, seed: number): ResultStats {
  const out: ResultStats = { matches: 0, wins: 0, visibleWins: 0, withDecision: 0, decisiveFound: 0, overtakes: 0, shownGain: 0 };
  for (let r = 0; r < runs; r++) {
    const s0 = streamSeed(seed, 'ladder', r);
    let s = newLadder(s0, createPlayer({ name: 'Bot', style: 'all_court', allocation: defaultAllocation('all_court') }, s0));
    for (let m = 0; m < matches; m++) {
      s = finishQuick(s, playMatch(startQuick(s), bot, streamSeed(s0, 'user', m)));
      const rec = s.history.at(-1)!;
      const gain = visibleGain(rec);
      out.matches++;
      out.shownGain += gain;
      out.overtakes += rec.overtakes?.length ?? 0;
      if (rec.won) out.wins++;
      if (rec.won && gain > 0) out.visibleWins++;
      if (rec.decisions?.length) {
        out.withDecision++;
        if (decisiveMoment(rec)) out.decisiveFound++;
      }
    }
  }
  return out;
}
