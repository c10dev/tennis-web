// simulateMatch(config, seed) → MatchResult: the engine's entry point (GDD §3).
import { normalizeAttributes } from '../player/attributes.ts';
import { addFatigue, pressureIndex, recover, runtime, type PlayerRuntime } from '../player/condition.ts';
import type { Side } from '../point/court.ts';
import { simulatePoint } from '../point/simulatePoint.ts';
import { createRng } from '../rng/mulberry32.ts';
import { pointTags } from '../scoring/context.ts';
import { applyPoint, cloneScore, initialScoring } from '../scoring/match.ts';
import { isFinalSet } from '../scoring/rules.ts';
import { FATIGUE } from '../tuning.ts';
import {
  SCHEMA_VERSION, type MatchConfig, type MatchEvent, type MatchResult, type PlayerId, type PlayerProfile, type PointEvent, type Tactic,
} from '../types.ts';
import { computeStats } from './stats.ts';

export const DEFAULT_TACTIC: Tactic = { aggression: 0.5, netApproach: 0, targetBackhand: false, serveTarget: 'mix' };

export function createConfig(players: [PlayerProfile, PlayerProfile], options: Partial<Omit<MatchConfig, 'players'>> = {}): MatchConfig {
  return {
    players,
    surface: 'hard',
    rules: { bestOf: 3, noAd: false, finalSet: 'tiebreak7' },
    tactics: [{ ...DEFAULT_TACTIC }, { ...DEFAULT_TACTIC }],
    firstServer: 'A',
    ...options,
  };
}

export function simulateMatch(input: MatchConfig, seed: number): MatchResult {
  const config = JSON.parse(JSON.stringify(input)) as MatchConfig;
  validate(config);
  const rng = createRng(seed);
  const { surface, rules } = config;
  const base = {
    A: runtime(config.players[0], config.tactics[0], 'A', surface),
    B: runtime(config.players[1], config.tactics[1], 'B', surface),
  };
  const fatigue: Record<PlayerId, number> = { A: 0, B: 0 };
  let scoring = initialScoring(rules, config.firstServer);
  let sideOfA: Side = -1;
  const points: PointEvent[] = [];
  const events: MatchEvent[] = [
    { type: 'match_start', seed, surface, players: [config.players[0].name, config.players[1].name], bestOf: rules.bestOf },
  ];

  while (scoring.winner === null) {
    const scoreBefore = cloneScore(scoring.score);
    const tags = pointTags(scoring);
    const players: Record<PlayerId, PlayerRuntime> = { A: { ...base.A, fatigue: fatigue.A }, B: { ...base.B, fatigue: fatigue.B } };
    const result = simulatePoint({
      server: scoreBefore.server,
      players,
      surface,
      pressure: pressureIndex(tags, isFinalSet(rules, scoreBefore.sets.length)),
      sideOfA,
      deuceCourt: (scoreBefore.points[0] + scoreBefore.points[1]) % 2 === 0,
    }, rng);
    const applied = applyPoint(scoring, result.winner);
    const point: PointEvent = {
      type: 'point', index: points.length, server: scoreBefore.server, winner: result.winner, serveNumber: result.serveNumber,
      rallyLength: result.rallyLength, endedBy: result.endedBy, shots: result.shots, scoreBefore,
      scoreAfter: cloneScore(applied.state.score), tags, durationSec: result.durationSec,
    };
    points.push(point);
    events.push(point, ...applied.events);
    for (const id of ['A', 'B'] as const) {
      fatigue[id] = recover(addFatigue(fatigue[id], base[id].n.stamina, result.shotsHit[id], surface), FATIGUE.pointRecovery);
    }
    for (const e of applied.events) {
      if (e.type === 'changeover') sideOfA = -sideOfA as Side;
      if (e.type === 'set_end') for (const id of ['A', 'B'] as const) fatigue[id] = recover(fatigue[id], FATIGUE.setRecovery);
    }
    scoring = applied.state;
  }

  const stats = computeStats(points);
  const winner = scoring.winner;
  events.push({ type: 'match_end', winner, score: cloneScore(scoring.score), stats });
  return { schemaVersion: SCHEMA_VERSION, seed, config, events, winner, stats };
}

function validate(config: MatchConfig): void {
  for (const p of config.players) normalizeAttributes(p.attributes);
  for (const t of config.tactics) {
    for (const key of ['aggression', 'netApproach'] as const) {
      if (!(t[key] >= 0 && t[key] <= 1)) throw new RangeError(`Tactic ${key} must be in [0, 1], got ${t[key]}`);
    }
  }
}
