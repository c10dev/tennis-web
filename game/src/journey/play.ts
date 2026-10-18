// One event of a swing (ADR-032/033): a seeded draw played round by round. Any match with a human in it runs the full
// engine (big ones, and every match between two humans, keep their recipe for text commentary); every other match
// runs the fast model.
import { createConfig, simulateMatch, type MatchRecipe, type PlayerProfile } from '@tennis/engine';
import { overall } from '../player/overall.ts';
import { stream, streamSeed } from '../rng.ts';
import { champion, playRound, roundsWon, startBracket, type Bracket } from '../tournament/bracket.ts';
import { makeDraw } from '../tournament/draw.ts';
import { JTIERS, pointsFor, type JEvent } from './calendar.ts';
import { fastLevel, fastMatch } from './fast-match.ts';
import { CONDITION_J } from './tuning.ts';
import type { EventResult, JPlayer, MatchLine } from './types.ts';

export interface HumanInPlay {
  morale: number;
  /** Fatigue at the start of the event (0–1). */
  fatigue: number;
}

export interface EventContext {
  seed: number;
  /** Key of this swing, e.g. "3/1" (year/swing), so every event's streams are its own. */
  key: string;
  /** Humans in this event, by player id. */
  humans: ReadonlyMap<string, HumanInPlay>;
  /** Places of everyone ranked, for the match lines. */
  rankOf: (id: string) => number | null;
}

export interface Played {
  /** Ranking points by player id. */
  earned: Map<string, number>;
  /** Each human's event, by player id. */
  results: Map<string, EventResult>;
}

/** Plays `ev` with `entrants` best first (the draw seeds the top quarter). */
export function playEvent(ctx: EventContext, ev: JEvent, entrants: readonly JPlayer[]): Played {
  const spec = JTIERS[ev.tier];
  const byId = new Map(entrants.map((p) => [p.id, p]));
  const rng = stream(ctx.seed, 'event', ctx.key, ev.id);
  let bracket: Bracket = startBracket(makeDraw(entrants.map((p) => p.id), spec.draw, rng));
  const rounds = Math.log2(spec.draw);
  const lines = new Map<string, MatchLine[]>([...ctx.humans.keys()].filter((id) => byId.has(id)).map((id) => [id, []]));
  for (let round = 1; round <= rounds; round++) {
    let pair = 0;
    bracket = playRound(bracket, (a, b) => {
      const i = pair++;
      if (!ctx.humans.has(a) && !ctx.humans.has(b)) {
        const level = (p: JPlayer) => fastLevel(overall(p), p.attributes.surfaceAffinity[ev.surface], 0);
        return fastMatch(level(byId.get(a)!), level(byId.get(b)!), ev.surface, spec.bestOf, rng).winner === 'A' ? a : b;
      }
      const [x, y] = ctx.humans.has(a) ? [a, b] : [b, a];
      const m = engineMatch(ctx, ev, round, rounds, i, byId.get(x)!, byId.get(y)!);
      lines.get(x)!.push(m.line);
      if (ctx.humans.has(y)) lines.get(y)!.push(flip(m.line, byId.get(x)!, ctx));
      return m.line.won ? x : y;
    });
  }
  const earned = new Map<string, number>();
  for (const p of entrants) earned.set(p.id, pointsFor(ev.tier, roundsWon(bracket, p.id)));
  const results = new Map<string, EventResult>();
  for (const [id, matches] of lines) {
    const points = earned.get(id)!;
    results.set(id, {
      id: ev.id, name: ev.name, tier: ev.tier, surface: ev.surface, roundsWon: roundsWon(bracket, id), rounds,
      champion: champion(bracket) === id, points, prize: points * spec.prizePerPoint, matches,
    });
  }
  return { earned, results };
}

/** A match with a human as player A (the other may be a human too). */
export function engineMatch(ctx: EventContext, ev: JEvent, round: number, rounds: number, pair: number, a: JPlayer, b: JPlayer): { line: MatchLine } {
  const spec = JTIERS[ev.tier];
  const seed = streamSeed(ctx.seed, 'match', ctx.key, ev.id, round, pair);
  const ha = ctx.humans.get(a.id)!;
  const hb = ctx.humans.get(b.id);
  const config = createConfig([profile(a, ha.morale), profile(b, hb?.morale ?? 50)], {
    surface: ev.surface,
    rules: { bestOf: spec.bestOf, noAd: false, finalSet: 'tiebreak7' },
    firstServer: seed % 2 === 0 ? 'A' : 'B',
    condition: { fatigue: [Math.min(1, ha.fatigue * CONDITION_J.toMatch), Math.min(1, (hb?.fatigue ?? 0) * CONDITION_J.toMatch)] },
  });
  const result = simulateMatch(config, seed);
  const end = result.events.at(-1)!;
  const sets = end.type === 'match_end' ? end.score.sets : [];
  const recipe: MatchRecipe = { config, seed, tacticChanges: [] };
  const big = !!hb || (ev.tier === 'major' && round >= rounds - 1) || ((ev.tier === 'jrMajor' || ev.tier === 'finals') && round === rounds);
  return {
    line: {
      round, opponent: b.id, opponentName: b.name, opponentRank: ctx.rankOf(b.id), won: result.winner === 'A',
      score: sets.map(([x, y]) => `${x}-${y}`).join(' '), ...(big ? { recipe } : {}),
    },
  };
}

/** The same match from the other human's side: opponent, result and score turned round (the recipe stays A-first). */
function flip(line: MatchLine, a: JPlayer, ctx: EventContext): MatchLine {
  const score = line.score.split(' ').filter(Boolean).map((set) => set.split('-').reverse().join('-')).join(' ');
  return { ...line, opponent: a.id, opponentName: a.name, opponentRank: ctx.rankOf(a.id), won: !line.won, score };
}

/** The engine's view of a player; morale moves composure and concentration a little (±2 at the extremes). */
function profile(p: JPlayer, morale: number): PlayerProfile {
  const lift = Math.round((morale - 50) / CONDITION_J.moralePerPoint);
  const clamp = (v: number) => Math.min(20, Math.max(1, v + lift));
  const attributes = { ...p.attributes, composure: clamp(p.attributes.composure), concentration: clamp(p.attributes.concentration) };
  return { name: p.name, style: p.style, attributes };
}
