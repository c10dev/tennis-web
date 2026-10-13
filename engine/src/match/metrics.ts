// Counts for batch reports (GDD §10 M1 tuning table). Pure: the CLI sums them and prints rates.
import { deriveSeed } from '../rng/mulberry32.ts';
import type { MatchConfig, MatchResult, PlayerId } from '../types.ts';
import { simulateMatch } from './simulateMatch.ts';

export interface Metrics {
  matches: number;
  winsA: number;
  serviceGames: number;
  holds: number;
  servicePoints: number;
  firstServesIn: number;
  firstServePointsWon: number;
  secondServePoints: number;
  secondServePointsWon: number;
  aces: number;
  doubleFaults: number;
  rallyTotal: number;
  shortRallies: number;
  sets: number;
  tiebreakSets: number;
}

export const emptyMetrics = (): Metrics => ({
  matches: 0, winsA: 0, serviceGames: 0, holds: 0, servicePoints: 0, firstServesIn: 0, firstServePointsWon: 0,
  secondServePoints: 0, secondServePointsWon: 0, aces: 0, doubleFaults: 0, rallyTotal: 0, shortRallies: 0, sets: 0, tiebreakSets: 0,
});

/** Counts for one match; with `server`, only that player's service points and games. Tiebreak games are not service games. */
export function matchMetrics(result: MatchResult, server?: PlayerId): Metrics {
  const m = emptyMetrics();
  m.matches = 1;
  m.winsA = result.winner === 'A' ? 1 : 0;
  let lastServer: PlayerId = result.config.firstServer;
  let inTiebreak = false;
  for (const e of result.events) {
    if (e.type === 'point') {
      lastServer = e.server;
      inTiebreak = e.scoreBefore.tiebreak;
      if (server !== undefined && e.server !== server) continue;
      const won = e.winner === e.server;
      m.servicePoints += 1;
      if (e.serveNumber === 1) {
        m.firstServesIn += 1;
        if (won) m.firstServePointsWon += 1;
      } else {
        m.secondServePoints += 1;
        if (won) m.secondServePointsWon += 1;
      }
      if (e.endedBy === 'ace') m.aces += 1;
      if (e.endedBy === 'double_fault') m.doubleFaults += 1;
      m.rallyTotal += e.rallyLength;
      if (e.rallyLength <= 4) m.shortRallies += 1;
    } else if (e.type === 'game_end' && !inTiebreak && (server === undefined || lastServer === server)) {
      m.serviceGames += 1;
      if (!e.isBreak) m.holds += 1;
    } else if (e.type === 'match_end') {
      m.sets = e.score.sets.length;
      m.tiebreakSets = e.score.sets.filter(([a, b]) => a + b === 13).length;
    }
  }
  return m;
}

export function addMetrics(a: Metrics, b: Metrics): Metrics {
  const out = { ...a };
  for (const key of Object.keys(out) as (keyof Metrics)[]) out[key] += b[key];
  return out;
}

export interface Summary {
  matches: number;
  winPctA: number;
  holdPct: number;
  acesPerServiceGame: number;
  doubleFaultsPerServiceGame: number;
  firstServeInPct: number;
  firstServePointsWonPct: number;
  secondServePointsWonPct: number;
  avgRally: number;
  shortRallyPct: number;
  tiebreakSetPct: number;
}

const rate = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function summarize(m: Metrics): Summary {
  return {
    matches: m.matches,
    winPctA: rate(m.winsA, m.matches),
    holdPct: rate(m.holds, m.serviceGames),
    acesPerServiceGame: rate(m.aces, m.serviceGames),
    doubleFaultsPerServiceGame: rate(m.doubleFaults, m.serviceGames),
    firstServeInPct: rate(m.firstServesIn, m.servicePoints),
    firstServePointsWonPct: rate(m.firstServePointsWon, m.firstServesIn),
    secondServePointsWonPct: rate(m.secondServePointsWon, m.secondServePoints),
    avgRally: rate(m.rallyTotal, m.servicePoints),
    shortRallyPct: rate(m.shortRallies, m.servicePoints),
    tiebreakSetPct: rate(m.tiebreakSets, m.sets),
  };
}

/**
 * Plays `count` matches with seeds `deriveSeed(baseSeed, i)`, alternating the first server so neither player gets the
 * edge of serving first. Returns the summed metrics for the whole match and for A's service only.
 */
export function runBatch(config: MatchConfig, count: number, baseSeed: number): { all: Metrics; a: Metrics } {
  let all = emptyMetrics();
  let a = emptyMetrics();
  for (let i = 0; i < count; i++) {
    const r = simulateMatch({ ...config, firstServer: i % 2 === 0 ? 'A' : 'B' }, deriveSeed(baseSeed, i));
    all = addMetrics(all, matchMetrics(r));
    a = addMetrics(a, matchMetrics(r, 'A'));
  }
  return { all, a };
}
