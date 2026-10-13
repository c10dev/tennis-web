// The quick-match ladder (ADR-016): 64 players by points, the next opponent just above, points for every win,
// AI matches in the background so the ladder never stands still.
import { createConfig, finish, fingerprint, simulateMatch, type MatchRecipe, type MatchResult, type PointEvent, type Surface } from '@tennis/engine';
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { adjust } from '../player/week.ts';
import { rankingOrder } from '../ranking.ts';
import { pick, stream, streamSeed } from '../rng.ts';
import { QUICK, TIEBREAK_RULES, type Rated } from '../tuning.ts';
import { profileOf } from '../player/profile.ts';
import type { CareerPlayer, World } from '../types.ts';
import { generateWorld } from '../world/generate.ts';
import type { QuickMatch } from './match.ts';
import { cardReward } from './rewards.ts';
import { overtakesBetween } from './standing.ts';
import type { DecisionRecord, Overtake } from './types.ts';

export interface QuickRecord {
  matchNo: number;
  opponent: string;
  opponentRank: number;
  won: boolean;
  score: string;
  pointsDelta: number;
  rankBefore: number;
  rankAfter: number;
  fingerprint: string;
  recipe: MatchRecipe;
  /** Ratings that moved: value + progress before and after. */
  progress: { key: Rated; before: number; after: number }[];
  /** The points the user chose a card on (ADR-017); absent in M5 records. */
  decisions?: DecisionRecord[];
  /** Players the user passed this match, the first passed first; absent in M5 records. */
  overtakes?: Overtake[];
}

export interface QuickState {
  seed: number;
  matchNo: number;
  world: World;
  points: Record<string, number>;
  history: QuickRecord[];
}

export function newLadder(seed: number, user: CareerPlayer): QuickState {
  const world = generateWorld(seed, user);
  const order = rankingOrder(world.players.map((p) => ({ id: p.id, points: 0, level: overall(p) })));
  const points = Object.fromEntries(order.map((id, i) => [id, Math.round(QUICK.startTop * Math.exp(-i / QUICK.startScale))]));
  return { seed, matchNo: 0, world, points, history: [] };
}

const levelOf = (s: QuickState) => new Map(s.world.players.map((p) => [p.id, overall(p)]));

export function ladderOrder(s: QuickState): string[] {
  const level = levelOf(s);
  return rankingOrder(Object.entries(s.points).map(([id, points]) => ({ id, points, level: level.get(id)! })));
}

export const rankOf = (s: QuickState, id = USER_ID): number => ladderOrder(s).indexOf(id) + 1;

/** One of the (up to) three players just above the user; below if the user is first. Not the last opponent if avoidable. */
export function nextOpponent(s: QuickState): string {
  const order = ladderOrder(s);
  const r = order.indexOf(USER_ID);
  const pool = r === 0 ? order.slice(1, 4) : order.slice(Math.max(0, r - 3), r);
  const last = s.history.at(-1)?.opponent;
  const fresh = pool.filter((id) => id !== last);
  return pick(stream(s.seed, 'opponent', s.matchNo), fresh.length ? fresh : pool);
}

/** Points the user needs to pass the player just above (0 at the top). */
export function pointsToNext(s: QuickState): number {
  const order = ladderOrder(s);
  const r = order.indexOf(USER_ID);
  return r === 0 ? 0 : s.points[order[r - 1]!]! - s.points[USER_ID]! + 1;
}

const delta = (won: boolean, rank: number, opponentRank: number) => (won ? QUICK.win + QUICK.perRankAbove * Math.max(0, rank - opponentRank) : -QUICK.loss);

export function finishQuick(s: QuickState, m: QuickMatch): QuickState {
  const result = finish(m.live);
  const won = result.winner === 'A';
  const rankBefore = rankOf(s);
  const opponentRank = rankOf(s, m.opponent);
  const pointsDelta = delta(won, rankBefore, opponentRank);
  const points: Record<string, number> = { ...s.points, [USER_ID]: Math.max(0, s.points[USER_ID]! + pointsDelta) };
  const oppDelta = delta(!won, opponentRank, rankBefore);
  points[m.opponent] = Math.max(0, points[m.opponent]! + oppDelta);

  const players = s.world.players.map((p) => (p.id === USER_ID ? { ...p, attributes: { ...p.attributes }, progress: { ...p.progress } } : p));
  const me = players.find((p) => p.id === USER_ID)!;
  const cards = m.decisions.map((d) => d.user);
  const progress = Object.entries(cardReward(cards, won)).map(([k, d]) => {
    const key = k as Rated;
    const before = me.attributes[key] + (me.progress[key] ?? 0);
    adjust(me, key, d!);
    return { key, before, after: me.attributes[key] + (me.progress[key] ?? 0) };
  });

  const next: QuickState = { ...s, world: { ...s.world, players }, points };
  background(next, s.matchNo);
  const score = finalScore(result);
  const record: QuickRecord = {
    matchNo: s.matchNo, opponent: m.opponent, opponentRank, won, score, pointsDelta, rankBefore, rankAfter: rankOf(next),
    fingerprint: fingerprint(result), recipe: JSON.parse(JSON.stringify(m.recipe)) as MatchRecipe, progress,
    decisions: m.decisions.map((d) => ({ ...d, score: [...d.score] })), overtakes: overtakesBetween(ladderOrder(s), ladderOrder(next), next),
  };
  return { ...next, matchNo: s.matchNo + 1, history: [...s.history, record] };
}

/** "7-5" for a one-tiebreak match (the user first), set scores for anything else. */
export function finalScore(result: MatchResult): string {
  const end = result.events.at(-1)!;
  if (end.type !== 'match_end') return '';
  if (result.config.rules.setFormat !== 'tiebreak') return end.score.sets.map(([a, b]) => `${a}-${b}`).join(' ');
  const last = result.events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;
  const [a, b] = last.scoreBefore.points;
  return last.winner === 'A' ? `${a + 1}-${b}` : `${a}-${b + 1}`;
}

/** AI neighbours on the ladder play each other (one tiebreak, no cards), mutating `s.points`. */
function background(s: QuickState, matchNo: number): void {
  const rng = stream(s.seed, 'background', matchNo);
  const byId = new Map(s.world.players.map((p) => [p.id, p]));
  for (let i = 0; i < QUICK.background; i++) {
    const order = ladderOrder(s).filter((id) => id !== USER_ID);
    const k = Math.floor(rng.next() * (order.length - 1));
    const [a, b] = [order[k]!, order[k + 1]!];
    const config = createConfig([profileOf(byId.get(a)!), profileOf(byId.get(b)!)], {
      surface: QUICK.surfaces[(matchNo + i) % QUICK.surfaces.length] as Surface,
      rules: { ...TIEBREAK_RULES },
    });
    const won = simulateMatch(config, streamSeed(s.seed, 'background-match', matchNo, i)).winner === 'A';
    const [ra, rb] = [k + 1, k + 2];
    s.points[a] = Math.max(0, s.points[a]! + delta(won, ra, rb));
    s.points[b] = Math.max(0, s.points[b]! + delta(!won, rb, ra));
  }
}
