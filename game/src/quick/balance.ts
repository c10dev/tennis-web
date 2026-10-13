// The quick-match balance measures (ADR-016): length, no dominant card, reading pays, AI variety, skill, ladder pace.
import {
  advance, averagePlayer, createConfig, finish, isOver, liveStatus, ratedPlayer, startMatch, type Card, type MatchConfig, type MatchResult,
  type PlayerProfile, type PlayStyle, type PointEvent, type Surface,
} from '@tennis/engine';
import { createPlayer, defaultAllocation } from '../player/create.ts';
import { stream, streamSeed } from '../rng.ts';
import { aiCard, cardEntropy } from './ai.ts';
import { randomBot, type Bot } from './bots.ts';
import { finishQuick, newLadder, rankOf } from './ladder.ts';
import { matchOver, playPoint, startQuick, userRole } from './match.ts';
import { broadcastSeconds } from './pace.ts';

const STYLES: PlayStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];
const SURFACES: Surface[] = ['hard', 'clay', 'grass'];

export const fast4 = (a: PlayerProfile, b: PlayerProfile, i: number): MatchConfig =>
  createConfig([a, b], { surface: SURFACES[i % 3]!, rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' }, firstServer: i % 2 ? 'B' : 'A' });

/** A plays `bot`; B is the adaptive AI (or `opponent` if given). Returns the match and B's cards. */
export function cardMatch(config: MatchConfig, seed: number, bot: Bot, opponent?: Bot): { result: MatchResult; aiCards: Card[] } {
  const live = startMatch(config, seed);
  const seen: Record<'serve' | 'return', Card[]> = { serve: [], return: [] };
  const aiCards: Card[] = [];
  while (!isOver(live)) {
    const st = liveStatus(live);
    const role = st.server === 'A' ? 'serve' : 'return';
    const ctx = {
      style: config.players[1].style, role: role === 'serve' ? 'return' as const : 'serve' as const, history: seen[role], fatigue: st.fatigue.B,
      ...(aiCards.length ? { lastOwn: aiCards.at(-1)! } : {}),
    };
    const mine = bot({ ...ctx, rng: stream(seed, 'bot', st.pointsPlayed) });
    const theirs = (opponent ?? aiCard)({ ...ctx, rng: stream(seed, 'card', st.pointsPlayed) });
    advance(live, 'point', { cards: { A: mine, B: theirs } });
    seen[role].push(mine);
    aiCards.push(theirs);
  }
  return { result: finish(live), aiCards };
}

const styled = (style: PlayStyle) => ({ ...averagePlayer('AI'), style });

/** Win rate of `bot` (as an average player) against an average adaptive AI of every style. */
export function winRate(bot: Bot, n: number, seed: number, opponent?: Bot): { win: number; aiCards: Card[]; points: number[]; seconds: number[] } {
  let wins = 0;
  const aiCards: Card[] = [];
  const points: number[] = [];
  const seconds: number[] = [];
  for (let i = 0; i < n; i++) {
    const { result, aiCards: cards } = cardMatch(fast4(averagePlayer('Bot'), styled(STYLES[i % 4]!), i), streamSeed(seed, 'm', i), bot, opponent);
    if (result.winner === 'A') wins++;
    aiCards.push(...cards);
    const pts = result.events.filter((e): e is PointEvent => e.type === 'point');
    points.push(pts.length);
    seconds.push(broadcastSeconds(pts));
  }
  return { win: wins / n, aiCards, points, seconds };
}

/** Win rates of players rated 11–15 everywhere (random cards) against an average adaptive AI. */
export function skillLadder(n: number, seed: number): number[] {
  return [11, 12, 13, 14, 15].map((r, k) => {
    let wins = 0;
    for (let i = 0; i < n; i++) {
      if (cardMatch(fast4(ratedPlayer('R', r), styled(STYLES[i % 4]!), i), streamSeed(seed, 'skill', k, i), randomBot).result.winner === 'A') wins++;
    }
    return wins / n;
  });
}

/** Places climbed in `matches` quick matches by a user bot, averaged over `runs` ladders. */
export function ladderPace(bot: Bot, runs: number, matches: number, seed: number): number {
  let climbed = 0;
  for (let r = 0; r < runs; r++) {
    const s0 = streamSeed(seed, 'ladder', r);
    let s = newLadder(s0, createPlayer({ name: 'Bot', style: 'all_court', allocation: defaultAllocation('all_court') }, s0));
    const start = rankOf(s);
    for (let m = 0; m < matches; m++) {
      const qm = startQuick(s);
      while (!matchOver(qm)) {
        const st = liveStatus(qm.live);
        const role = userRole(qm);
        const ctx = {
          style: qm.recipe.config.players[1].style, role: role === 'serve' ? 'return' as const : 'serve' as const, history: qm.userCards[role],
          fatigue: st.fatigue.B, ...(qm.recipe.cards.length ? { lastOwn: qm.recipe.cards.at(-1)!.B } : {}),
        };
        playPoint(qm, bot({ ...ctx, rng: stream(s0, 'user', m, st.pointsPlayed) }));
      }
      s = finishQuick(s, qm);
    }
    climbed += start - rankOf(s);
  }
  return climbed / runs;
}

export const median = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
export { cardEntropy };
