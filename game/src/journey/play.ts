// One event of a swing (ADR-032): a seeded draw played round by round. The user's matches run the full engine (big
// ones keep their recipe for text commentary); every other match runs the fast model.
import { createConfig, simulateMatch, type MatchRecipe, type PlayerProfile } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { stream, streamSeed } from '../rng.ts';
import { champion, playRound, roundsWon, startBracket, type Bracket } from '../tournament/bracket.ts';
import { makeDraw } from '../tournament/draw.ts';
import { JTIERS, pointsFor, type JEvent } from './calendar.ts';
import { fastLevel, fastMatch } from './fast-match.ts';
import { CONDITION_J } from './tuning.ts';
import type { EventResult, JPlayer, MatchLine } from './types.ts';

export interface EventContext {
  seed: number;
  /** Key of this swing, e.g. "3/1" (year/swing), so every event's streams are its own. */
  key: string;
  user: JPlayer | null;
  morale: number;
  /** User's starting fatigue for the engine (0–1). */
  userFatigue: number;
  /** Places of everyone ranked, for the match lines. */
  rankOf: (id: string) => number | null;
}

export interface Played {
  /** Ranking points by player id. */
  earned: Map<string, number>;
  /** The user's event, when they played it. */
  result: EventResult | null;
}

/** Plays `ev` with `entrants` best first (the draw seeds the top quarter). */
export function playEvent(ctx: EventContext, ev: JEvent, entrants: readonly JPlayer[]): Played {
  const spec = JTIERS[ev.tier];
  const byId = new Map(entrants.map((p) => [p.id, p]));
  const rng = stream(ctx.seed, 'event', ctx.key, ev.id);
  let bracket: Bracket = startBracket(makeDraw(entrants.map((p) => p.id), spec.draw, rng));
  const rounds = Math.log2(spec.draw);
  const lines: MatchLine[] = [];
  const userId = ctx.user?.id;
  for (let round = 1; round <= rounds; round++) {
    let pair = 0;
    bracket = playRound(bracket, (a, b) => {
      const i = pair++;
      if (a !== userId && b !== userId) {
        const [pa, pb] = [byId.get(a)!, byId.get(b)!];
        const level = (p: JPlayer) => fastLevel(overall(p), p.attributes.surfaceAffinity[ev.surface], 0);
        return fastMatch(level(pa), level(pb), ev.surface, spec.bestOf, rng).winner === 'A' ? a : b;
      }
      const opp = byId.get(a === userId ? b : a)!;
      const line = userMatch(ctx, ev, round, rounds, i, opp);
      lines.push(line);
      return line.won ? userId! : opp.id;
    });
  }
  const earned = new Map<string, number>();
  for (const p of entrants) earned.set(p.id, pointsFor(ev.tier, roundsWon(bracket, p.id)));
  if (!userId || !byId.has(userId)) return { earned, result: null };
  const won = roundsWon(bracket, userId);
  const points = earned.get(userId)!;
  const result: EventResult = {
    id: ev.id, name: ev.name, tier: ev.tier, surface: ev.surface, roundsWon: won, rounds,
    champion: champion(bracket) === userId, points, prize: points * spec.prizePerPoint, matches: lines,
  };
  return { earned, result };
}

function userMatch(ctx: EventContext, ev: JEvent, round: number, rounds: number, pair: number, opp: JPlayer): MatchLine {
  const user = ctx.user!;
  const spec = JTIERS[ev.tier];
  const seed = streamSeed(ctx.seed, 'match', ctx.key, ev.id, round, pair);
  const config = createConfig([profile(user, ctx.morale), profile(opp, 50)], {
    surface: ev.surface,
    rules: { bestOf: spec.bestOf, noAd: false, finalSet: 'tiebreak7' },
    firstServer: seed % 2 === 0 ? 'A' : 'B',
    condition: { fatigue: [Math.min(1, ctx.userFatigue * CONDITION_J.toMatch), 0] },
  });
  const result = simulateMatch(config, seed);
  const end = result.events.at(-1)!;
  const sets = end.type === 'match_end' ? end.score.sets : [];
  const recipe: MatchRecipe = { config, seed, tacticChanges: [] };
  const big = (ev.tier === 'major' && round >= rounds - 1) || ((ev.tier === 'jrMajor' || ev.tier === 'finals') && round === rounds);
  return {
    round, opponent: opp.id, opponentName: opp.name, opponentRank: ctx.rankOf(opp.id), won: result.winner === 'A',
    score: sets.map(([x, y]) => `${x}-${y}`).join(' '), ...(big ? { recipe } : {}),
  };
}

/** The engine's view of a player; morale moves composure and concentration a little (±2 at the extremes). */
function profile(p: JPlayer, morale: number): PlayerProfile {
  const lift = Math.round((morale - 50) / CONDITION_J.moralePerPoint);
  const clamp = (v: number) => Math.min(20, Math.max(1, v + lift));
  const attributes = { ...p.attributes, composure: clamp(p.attributes.composure), concentration: clamp(p.attributes.concentration) };
  return { name: p.name, style: p.style, attributes };
}
