// The point the result screen replays (ADR-017): the user's choice that decided the match, named.
import { matchup, replayMatch, type Card, type PointEvent } from '@tennis/engine';
import type { QuickRecord } from './ladder.ts';
import { en } from '../text/en.ts';
import type { Messages } from '../text/types.ts';
import type { DecisionRecord, DecisiveMoment } from './types.ts';

/** The decisive moment, or the final point when no card was played (then the cards are null). */
export interface Highlight extends Omit<DecisiveMoment, 'user' | 'ai'> {
  user: Card | null;
  ai: Card | null;
}

const scoreOf = ([a, b]: readonly [number, number]) => `${a}-${b}`;

const lineFor = (d: DecisionRecord, t: Messages) =>
  t.decisive({ score: scoreOf(d.score), user: d.user, ai: d.ai, matchup: matchup(d.user, d.ai), won: d.winner === 'A' });

/**
 * Among the user's decisions, the one that most decided the match: in a win the last decision the user won (the last
 * won matchup among those first), in a loss the last one lost (the last lost matchup first); the last decision if
 * none went the match's way. Null only when the user made no decision.
 */
export function decisiveMoment(r: { won: boolean; decisions?: readonly DecisionRecord[] }, t: Messages = en): DecisiveMoment | null {
  const all = r.decisions ?? [];
  if (!all.length) return null;
  const side = r.won ? 'A' : 'B';
  const sign = r.won ? 1 : -1;
  const went = all.filter((d) => d.winner === side);
  const pick = went.filter((d) => matchup(d.user, d.ai) === sign).at(-1) ?? went.at(-1) ?? all.at(-1)!;
  return { point: pick.point, score: scoreOf(pick.score), user: pick.user, ai: pick.ai, won: pick.winner === 'A', line: lineFor(pick, t) };
}

/** What the result screen replays: the decisive moment, or the match's final point. */
export function highlightOf(r: QuickRecord, t: Messages = en): Highlight {
  const moment = decisiveMoment(r, t);
  if (moment) return moment;
  const last = replayMatch(r.recipe).events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;
  return {
    point: last.index, score: scoreOf(last.scoreBefore.points), user: null, ai: null, won: last.winner === 'A',
    line: t.noCards(r.won),
  };
}
