// The draw this week, round by round, the user's next match, and finished tournaments' cards.
import { TIERS } from '../calendar/tiers.ts';
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { pendingUserMatch } from '../season/round.ts';
import { currentRanking, playerById, type MatchRecord, type SeasonState } from '../season/state.ts';
import { champion, nextPairs } from '../tournament/bracket.ts';
import { resultLabel, roundName, STYLE_LABEL, SURFACE_LABEL } from './format.ts';

export interface MatchRow {
  a: string;
  b: string;
  winner: 'a' | 'b' | null;
  score: string;
  isUser: boolean;
  replayable: boolean;
}

export function tournamentView(s: SeasonState) {
  const t = s.tournament;
  if (!t) return null;
  const name = (id: string) => playerById(s, id).name;
  const size = TIERS[t.tournament.tier].draw;
  const row = (m: MatchRecord): MatchRow => ({
    a: name(m.a), b: name(m.b), winner: m.winner === m.a ? 'a' : 'b', score: m.score, isUser: m.a === USER_ID || m.b === USER_ID, replayable: !!m.recipe,
  });
  const played = t.bracket.rounds.length - 1;
  const rounds = Array.from({ length: played }, (_, i) => ({ name: roundName(size, i + 1), matches: t.matches.filter((m) => m.round === i + 1).map(row) }));
  if (!t.done) {
    rounds.push({
      name: roundName(size, played + 1),
      matches: nextPairs(t.bracket).map(([a, b]) => ({ a: name(a), b: name(b), winner: null, score: '', isUser: a === USER_ID || b === USER_ID, replayable: false })),
    });
  }
  const pending = pendingUserMatch(s);
  const opp = pending ? playerById(s, pending.opponent) : null;
  const winner = champion(t.bracket);
  return {
    name: t.tournament.name, tier: TIERS[t.tournament.tier].label, surface: SURFACE_LABEL[t.tournament.surface], size, rounds,
    pending: pending && opp ? {
      round: roundName(size, pending.round), opponent: opp.name, opponentRank: currentRanking(s).indexOf(opp.id) + 1,
      opponentLevel: Math.round(overall(opp) * 10) / 10, opponentStyle: STYLE_LABEL[opp.style], bestOf: pending.config.rules.bestOf,
    } : null,
    canPlayRound: !t.done && !pending,
    done: t.done,
    champion: winner ? name(winner) : null,
    userIn: t.bracket.rounds[0]!.includes(USER_ID),
  };
}

export function historyView(s: SeasonState, index: number) {
  const h = s.history[index]!;
  const size = TIERS[h.tier].draw;
  const name = (id: string) => playerById(s, id).name;
  return {
    name: h.name, tier: TIERS[h.tier].label, surface: SURFACE_LABEL[h.surface], week: h.week, champion: name(h.champion),
    userResult: USER_ID in h.roundsWon ? resultLabel(size, h.roundsWon[USER_ID]!) : null,
    userMatches: h.userMatches.map((m, i) => ({
      index: i, round: roundName(size, m.round), opponent: name(m.a === USER_ID ? m.b : m.a), won: m.winner === USER_ID, score: m.score, replayable: !!m.recipe,
    })),
  };
}
