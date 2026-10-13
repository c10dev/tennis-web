// Shared helpers for quick-match tests.
import type { Card } from '@tennis/engine';
import { createPlayer, defaultAllocation } from '../src/player/create.ts';
import { finishQuick, newLadder, type QuickState } from '../src/quick/ladder.ts';
import { autoPlay, decide, matchOver, startQuick, type QuickMatch } from '../src/quick/match.ts';

export const freshLadder = (seed = 3) => newLadder(seed, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, seed));

/** Runs a quick match to its first decision point (or its end). */
export function toDecision(s: QuickState): QuickMatch {
  const m = startQuick(s);
  autoPlay(m);
  return m;
}

/** Plays the next ladder match with `pick` choosing at every decision point. */
export function playLadderMatch(s: QuickState, pick: (i: number) => Card = (i) => (['attack', 'counter', 'defend'] as Card[])[i % 3]!) {
  const m = startQuick(s);
  let i = 0;
  for (autoPlay(m); !matchOver(m); autoPlay(m)) decide(m, pick(i++));
  return { m, next: finishQuick(s, m) };
}

/** The first ladder match from `s` onward that stops for at least one decision. */
export function ladderWithDecision(s: QuickState): QuickState {
  for (let t = s; ; t = playLadderMatch(t).next) {
    const m = toDecision(t);
    if (!matchOver(m)) return t;
  }
}
