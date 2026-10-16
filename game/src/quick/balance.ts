// The quick-match balance harness (ADR-017): bots play one-tiebreak matches against the AI, deciding only at the
// decision points, exactly as the UI does (autoPlay, then decide).
import {
  averagePlayer, createConfig, finish, liveStatus, ratedPlayer, type Card, type MatchConfig, type MatchResult, type PlayerProfile,
  type PlayStyle, type PointEvent, type Surface,
} from '@tennis/engine';
import { createPlayer, defaultAllocation } from '../player/create.ts';
import { stream, streamSeed } from '../rng.ts';
import { TIEBREAK_RULES } from '../tuning.ts';
import { BEATEN_BY, CARDS, cardEntropy } from './ai.ts';
import { fixedBot, randomBot, type Bot, type BotView } from './bots.ts';
import { finishQuick, newLadder, rankOf } from './ladder.ts';
import { autoPlay, createQuickMatch, decide, decisionContext, matchOver, startQuick, type QuickMatch } from './match.ts';
import { broadcastSeconds } from './pace.ts';
import { personaOf } from './persona.ts';
import { opponentTactic, planTactic } from './plan.ts';
import type { DecisionRecord, GamePlan, Persona } from './types.ts';

export const STYLES: PlayStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];
const SURFACES: Surface[] = ['hard', 'clay', 'grass'];

export const tiebreakConfig = (a: PlayerProfile, b: PlayerProfile, i: number, plan: GamePlan = 'balanced'): MatchConfig =>
  createConfig([a, b], { surface: SURFACES[i % 3]!, rules: { ...TIEBREAK_RULES }, tactics: [planTactic(plan), opponentTactic(b.style, plan)], firstServer: i % 2 ? 'B' : 'A' });

/** What `bot` sees at the pending decision of `m`. */
export function botView(m: QuickMatch, rngSeed: number): BotView {
  return { ai: decisionContext(m), tell: m.pending!.tell, rng: stream(rngSeed, 'bot', liveStatus(m.live).pointsPlayed) };
}

/** Plays a whole match: `bot` decides for A at every decision point; `opponent` (if given) replaces the AI's card. */
export function playMatch(m: QuickMatch, bot: Bot, botSeed: number, opponent?: Bot): QuickMatch {
  for (;;) {
    autoPlay(m);
    if (matchOver(m)) return m;
    const view = botView(m, botSeed);
    if (opponent) m.pending = { card: opponent({ ...view, rng: stream(botSeed, 'opponent', liveStatus(m.live).pointsPlayed) }), tell: null };
    decide(m, bot(view));
  }
}

export function botMatch(config: MatchConfig, seed: number, bot: Bot, opts: { persona?: Persona; opponent?: Bot } = {}): { result: MatchResult; decisions: DecisionRecord[] } {
  const m = createQuickMatch({ config, seed, matchNo: 0, opponent: 'ai', plan: 'balanced', persona: opts.persona ?? personaOf(seed, 'ai'), rival: null });
  playMatch(m, bot, seed, opts.opponent);
  return { result: finish(m.live), decisions: m.decisions };
}

const styled = (style: PlayStyle) => ({ ...averagePlayer('AI'), style });

export interface WinRate {
  win: number;
  aiCards: Card[];
  points: number[];
  decisions: number[];
  seconds: number[];
}

/** Win rate of `bot` (an average player) against an average AI of every style and persona. */
export function winRate(bot: Bot, n: number, seed: number, opponent?: Bot): WinRate {
  const out: WinRate = { win: 0, aiCards: [], points: [], decisions: [], seconds: [] };
  for (let i = 0; i < n; i++) {
    const { result, decisions } = botMatch(tiebreakConfig(averagePlayer('Bot'), styled(STYLES[i % 4]!), i), streamSeed(seed, 'm', i), bot, opponent ? { opponent } : {});
    if (result.winner === 'A') out.win++;
    out.aiCards.push(...decisions.map((d) => d.ai));
    const pts = result.events.filter((e): e is PointEvent => e.type === 'point');
    out.points.push(pts.length);
    out.decisions.push(decisions.length);
    out.seconds.push(broadcastSeconds(pts));
  }
  out.win /= n;
  return out;
}

/** Win rates of players rated 11–15 everywhere (random cards) against an average AI. */
export function skillLadder(n: number, seed: number): number[] {
  return [11, 12, 13, 14, 15].map((r, k) => {
    let wins = 0;
    for (let i = 0; i < n; i++) {
      if (botMatch(tiebreakConfig(ratedPlayer('R', r), styled(STYLES[i % 4]!), i), streamSeed(seed, 'skill', k, i), randomBot).result.winner === 'A') wins++;
    }
    return wins / n;
  });
}

/** User point-win share at the decision points of `n` matches between average players, each playing one card. */
function decisionWin(mine: Card, theirs: Card, n: number, seed: number): number {
  let won = 0;
  let played = 0;
  for (let i = 0; i < n; i++) {
    // The same seeds for every pair of cards, so the pairs differ only by the cards.
    const { decisions } = botMatch(tiebreakConfig(averagePlayer('Bot'), averagePlayer('AI'), i), streamSeed(seed, 'edge', i), fixedBot(mine), { opponent: fixedBot(theirs) });
    won += decisions.filter((d) => d.winner === 'A').length;
    played += decisions.length;
  }
  return won / played;
}

/** What a won matchup at a decision point is worth (ADR-017): the user's point-win share with the card that beats
 *  the opponent's, minus with the same card as the opponent; average players, both roles, the three pairs each. */
export function matchupEdge(n: number, seed: number): number {
  const mean = (f: (c: Card) => number) => CARDS.reduce((a, c) => a + f(c), 0) / CARDS.length;
  return mean((c) => decisionWin(BEATEN_BY[c], c, n, seed)) - mean((c) => decisionWin(c, c, n, seed));
}

/** Places climbed in `matches` quick matches by a user bot, averaged over `runs` ladders. */
export function ladderPace(bot: Bot, runs: number, matches: number, seed: number): number {
  let climbed = 0;
  for (let r = 0; r < runs; r++) {
    const s0 = streamSeed(seed, 'ladder', r);
    let s = newLadder(s0, createPlayer({ name: 'Bot', style: 'all_court', allocation: defaultAllocation('all_court') }, s0));
    const start = rankOf(s);
    for (let m = 0; m < matches; m++) s = finishQuick(s, playMatch(startQuick(s), bot, streamSeed(s0, 'user', m)));
    climbed += start - rankOf(s);
  }
  return climbed / runs;
}

/** The value at quantile `q` (0–1) of `xs`, nearest rank from below. */
export const percentile = (xs: readonly number[], q: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))]!;
export const median = (xs: readonly number[]): number => percentile(xs, 0.5);
export const share = (xs: readonly number[], ok: (x: number) => boolean): number => xs.filter(ok).length / xs.length;
export { cardEntropy };
