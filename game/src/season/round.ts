// Tournament rounds: the user's match waits for the UI; every other match is simulated straight away.
import { createConfig, replayMatch, simulateMatch, type MatchConfig, type MatchRecipe, type MatchResult, type PlayerProfile, type Tactic } from '@tennis/engine';
import { TIERS } from '../calendar/tiers.ts';
import { USER_ID } from '../player/create.ts';
import { matchFatigue } from '../player/week.ts';
import { streamSeed } from '../rng.ts';
import { CONDITION } from '../tuning.ts';
import type { CareerPlayer } from '../types.ts';
import { champion, nextPairs, playRound as advanceBracket } from '../tournament/bracket.ts';
import { aiTactic } from './ai.ts';
import { playerById, type MatchRecord, type SeasonState } from './state.ts';

export interface PendingMatch {
  round: number;
  opponent: string;
  config: MatchConfig;
  seed: number;
}

const profile = (p: CareerPlayer): PlayerProfile => ({ name: p.name, style: p.style, attributes: p.attributes });

/** Config and seed for a match between a and b this round (a is player A). */
function setup(s: SeasonState, a: string, b: string, pairIndex: number): { config: MatchConfig; seed: number } {
  const t = s.tournament!;
  const round = t.bracket.rounds.length;
  const [pa, pb] = [playerById(s, a), playerById(s, b)];
  const tired = (p: CareerPlayer) => matchFatigue({ ...p, fatigue: Math.min(1, p.fatigue + (t.setsPlayed[p.id] ?? 0) * CONDITION.perSet) });
  const seed = streamSeed(s.seed, 'match', s.week, round, pairIndex);
  const config = createConfig([profile(pa), profile(pb)], {
    surface: t.tournament.surface,
    rules: { bestOf: TIERS[t.tournament.tier].bestOf, noAd: false, finalSet: 'tiebreak7' },
    tactics: [aiTactic(pa), aiTactic(pb)],
    firstServer: streamSeed(s.seed, 'toss', s.week, round, pairIndex) % 2 === 0 ? 'A' : 'B',
    condition: { fatigue: [tired(pa), tired(pb)] },
  });
  return { config, seed };
}

/** Pairs this round, the user always as player A of their own match. */
function pairs(s: SeasonState): [string, string][] {
  return nextPairs(s.tournament!.bracket).map(([x, y]) => (y === USER_ID ? [y, x] : [x, y]));
}

export function pendingUserMatch(s: SeasonState): PendingMatch | null {
  const t = s.tournament;
  if (!t || t.done) return null;
  const all = pairs(s);
  const i = all.findIndex(([a]) => a === USER_ID);
  if (i < 0) return null;
  return { round: t.bracket.rounds.length, opponent: all[i]![1], ...setup(s, USER_ID, all[i]![1], i) };
}

/** The user's match as a recipe with no changes between sets (a quick result), optionally with their own tactic. */
export function quickRecipe(m: PendingMatch, tactic?: Tactic): MatchRecipe {
  const config = tactic ? { ...m.config, tactics: [tactic, m.config.tactics[1]] as [Tactic, Tactic] } : m.config;
  return { config, seed: m.seed, tacticChanges: [] };
}

export function playRound(s: SeasonState, userRecipe?: MatchRecipe): SeasonState {
  const t = s.tournament;
  if (!t || t.done) throw new Error('No round to play');
  const round = t.bracket.rounds.length;
  const winners = new Map<string, string>();
  const matches: MatchRecord[] = [];
  const setsPlayed = { ...t.setsPlayed };
  pairs(s).forEach(([a, b], i) => {
    const { config, seed } = setup(s, a, b, i);
    let result: MatchResult;
    let recipe: MatchRecipe | undefined;
    if (a === USER_ID) {
      if (!userRecipe) throw new Error("The user's match needs a result before the round can be played");
      if (userRecipe.seed !== seed || userRecipe.config.players[1].name !== config.players[1].name) throw new Error('That result is for another match');
      recipe = userRecipe;
      result = replayMatch(userRecipe);
    } else {
      result = simulateMatch(config, seed);
    }
    const end = result.events.at(-1)!;
    const sets = end.type === 'match_end' ? end.score.sets : [];
    const winner = result.winner === 'A' ? a : b;
    winners.set(`${a}|${b}`, winner);
    for (const id of [a, b]) setsPlayed[id] = (setsPlayed[id] ?? 0) + sets.length;
    matches.push({ round, a, b, winner, score: sets.map(([x, y]) => `${x}-${y}`).join(' '), sets: sets.length, ...(recipe ? { recipe } : {}) });
  });
  const bracket = advanceBracket(t.bracket, (x, y) => winners.get(`${x}|${y}`) ?? winners.get(`${y}|${x}`)!);
  return { ...s, tournament: { ...t, bracket, matches: [...t.matches, ...matches], setsPlayed, done: champion(bracket) !== null } };
}

/** Plays rounds until the tournament is over or the user's next match is due (nothing to do in a quiet week). */
export function playOut(s: SeasonState): SeasonState {
  let next = s;
  while (next.tournament && !next.tournament.done && !pendingUserMatch(next)) next = playRound(next);
  return next;
}
