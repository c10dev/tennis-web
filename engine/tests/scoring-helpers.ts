import { applyPoint, initialScoring, type ScoringEvent, type ScoringState } from '../src/scoring/match.ts';
import type { MatchRules, PlayerId } from '../src/types.ts';

export const BO3: MatchRules = { bestOf: 3, noAd: false, finalSet: 'tiebreak7' };

export function start(rules: Partial<MatchRules> = {}, first: PlayerId = 'A'): ScoringState {
  return initialScoring({ ...BO3, ...rules }, first);
}

/** Plays points from a string such as "AABAB"; returns the final state and every event in order. */
export function play(state: ScoringState, points: string): { state: ScoringState; events: ScoringEvent[] } {
  const events: ScoringEvent[] = [];
  let s = state;
  for (const ch of points) {
    const r = applyPoint(s, ch as PlayerId);
    events.push(...r.events);
    s = r.state;
  }
  return { state: s, events };
}

/** Plays whole games: each character wins one game to love. */
export function games(state: ScoringState, winners: string): { state: ScoringState; events: ScoringEvent[] } {
  return play(state, [...winners].map((w) => w.repeat(4)).join(''));
}

export const types = (events: ScoringEvent[]) => events.map((e) => e.type);
