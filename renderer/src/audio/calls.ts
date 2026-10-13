// What the chair umpire says after a point (GDD §8.4): the score, server first, or the game, set or match.
import type { PlayerId, ScoreState } from '@tennis/engine';
import type { GapKind } from '../playback/timeline.ts';

export interface CallContext {
  server: PlayerId;
  winner: PlayerId;
  endsGame: boolean;
  gap: GapKind;
  noAd: boolean;
}

const WORDS = ['love', 'fifteen', 'thirty', 'forty'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function scoreCall(after: ScoreState, ctx: CallContext, names: [string, string]): string {
  const name = (id: PlayerId) => names[id === 'A' ? 0 : 1];
  const winner = name(ctx.winner);
  if (ctx.gap === 'match_end') return `Game, set and match, ${winner}`;
  if (ctx.gap === 'set_end') return `Game and ${ORDINALS[after.sets.length - 1] ?? 'next'} set, ${winner}`;
  if (ctx.endsGame) return `Game, ${winner}`;
  const [a, b] = after.points;
  if (after.tiebreak) {
    if (a === b) return `${a} all`;
    return a > b ? `${a}-${b}, ${names[0]}` : `${b}-${a}, ${names[1]}`;
  }
  if (a >= 3 && b >= 3) {
    if (a === b) return ctx.noAd ? 'Deciding point' : 'Deuce';
    return `Advantage ${a > b ? names[0] : names[1]}`;
  }
  if (a === b) return `${cap(WORDS[a]!)} all`;
  const [first, second] = ctx.server === 'A' ? [a, b] : [b, a];
  return cap(`${WORDS[first]!} ${WORDS[second]!}`);
}
