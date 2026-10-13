// Scoring as a pure state machine: applyPoint never mutates its input (GDD §6).
import type { MatchEvent, MatchRules, PlayerId, ScoreState } from '../types.ts';
import {
  gameWon, index, isFinalSet, other, setsToWin, setWon, tiebreakAt, tiebreakAtSixAll, tiebreakServer, tiebreakTarget, tiebreakWinBy, tiebreakWon,
} from './rules.ts';

export type ScoringEvent = Extract<MatchEvent, { type: 'game_end' | 'set_end' | 'changeover' }>;

export interface ScoringState {
  readonly rules: MatchRules;
  readonly score: ScoreState;
  /** Who served the first point of the current tiebreak; null outside a tiebreak. */
  readonly tiebreakFirstServer: PlayerId | null;
  readonly winner: PlayerId | null;
}

export function initialScoring(rules: MatchRules, firstServer: PlayerId): ScoringState {
  return {
    rules,
    score: { sets: [], games: [0, 0], points: [0, 0], tiebreak: false, server: firstServer },
    tiebreakFirstServer: null,
    winner: null,
  };
}

export function cloneScore(s: ScoreState): ScoreState {
  return { sets: s.sets.map(([a, b]) => [a, b]), games: [...s.games], points: [...s.points], tiebreak: s.tiebreak, server: s.server };
}

type Pending = { type: 'game_end'; winner: PlayerId; isBreak: boolean } | { type: 'set_end'; winner: PlayerId } | { type: 'changeover' };

/**
 * Awards one point. Events come in order game_end, set_end, changeover, each carrying the score after the point.
 * A changeover means the players change ends: after odd games of a set, after a set with an odd number of games,
 * and every six points of a tiebreak.
 */
export function applyPoint(state: ScoringState, pointWinner: PlayerId): { state: ScoringState; events: ScoringEvent[] } {
  if (state.winner !== null) throw new Error('The match is over');
  const { rules } = state;
  const s = cloneScore(state.score);
  const i = index(pointWinner);
  const finalSet = isFinalSet(rules, s.sets.length);
  const pending: Pending[] = [];
  let tbFirst = state.tiebreakFirstServer;
  let winner: PlayerId | null = null;
  s.points[i] += 1;

  const gameOver = s.tiebreak
    ? tiebreakWon(s.points, i, tiebreakTarget(rules, finalSet), tiebreakWinBy(rules))
    : gameWon(s.points, i, rules.noAd);

  if (!gameOver) {
    if (s.tiebreak) {
      const played = s.points[0] + s.points[1];
      s.server = tiebreakServer(tbFirst!, played);
      if (played % 6 === 0) pending.push({ type: 'changeover' });
    }
  } else {
    const wasTiebreak = s.tiebreak;
    const nextServer = wasTiebreak ? other(tbFirst!) : other(s.server);
    pending.push({ type: 'game_end', winner: pointWinner, isBreak: !wasTiebreak && pointWinner !== s.server });
    s.games[i] += 1;
    s.points = [0, 0];
    s.tiebreak = false;
    tbFirst = null;
    if (setWon(s.games, i, wasTiebreak, rules)) {
      const setGames = s.games[0] + s.games[1];
      s.sets.push([s.games[0], s.games[1]]);
      s.games = [0, 0];
      pending.push({ type: 'set_end', winner: pointWinner });
      if (s.sets.filter((g) => g[i]! > g[1 - i]!).length === setsToWin(rules)) winner = pointWinner;
      else if (setGames % 2 === 1) pending.push({ type: 'changeover' });
    } else {
      const at = tiebreakAt(rules);
      if (s.games[0] === at && s.games[1] === at && tiebreakAtSixAll(rules, finalSet)) {
        s.tiebreak = true;
        tbFirst = nextServer;
      }
      if ((s.games[0] + s.games[1]) % 2 === 1) pending.push({ type: 'changeover' });
    }
    s.server = nextServer;
  }

  const events = pending.map((e) => ({ ...e, score: cloneScore(s) }));
  return { state: { rules, score: s, tiebreakFirstServer: tbFirst, winner }, events };
}
