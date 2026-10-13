// A match played in steps (ADR-010): start it, advance a set or to the end, change tactics between sets, finish.
// Same seed, config and tactic changes give the same events whatever the steps were.
import { normalizeAttributes } from '../player/attributes.ts';
import { addFatigue, pressureIndex, recover, runtime, type PlayerRuntime } from '../player/condition.ts';
import type { Side } from '../point/court.ts';
import { simulatePoint } from '../point/simulatePoint.ts';
import { createRng, type Rng } from '../rng/mulberry32.ts';
import { pointTags } from '../scoring/context.ts';
import { applyPoint, cloneScore, initialScoring, type ScoringState } from '../scoring/match.ts';
import { isFinalSet } from '../scoring/rules.ts';
import { FATIGUE } from '../tuning.ts';
import {
  SCHEMA_VERSION, type MatchConfig, type MatchEvent, type MatchRecipe, type MatchResult, type PlayerId, type PointCards, type PointEvent, type Tactic,
} from '../types.ts';
import { computeStats } from './stats.ts';

export interface LiveMatch {
  readonly config: MatchConfig;
  readonly seed: number;
  /** Every event so far, match_start first. */
  readonly events: MatchEvent[];
  /** Internal state; not part of the public contract. */
  readonly state: LiveState;
}

interface LiveState {
  rng: Rng;
  base: Record<PlayerId, PlayerRuntime>;
  fatigue: Record<PlayerId, number>;
  scoring: ScoringState;
  sideOfA: Side;
  points: PointEvent[];
  /** Stopped at the end of a set with the match still on: tactics may change. */
  betweenSets: boolean;
}

const IDS = ['A', 'B'] as const;

export function startMatch(input: MatchConfig, seed: number): LiveMatch {
  const config = JSON.parse(JSON.stringify(input)) as MatchConfig;
  validate(config);
  const { surface, rules } = config;
  const [fa, fb] = config.condition?.fatigue ?? [0, 0];
  return {
    config,
    seed,
    events: [{ type: 'match_start', seed, surface, players: [config.players[0].name, config.players[1].name], bestOf: rules.bestOf }],
    state: {
      rng: createRng(seed),
      base: { A: runtime(config.players[0], config.tactics[0], 'A', surface), B: runtime(config.players[1], config.tactics[1], 'B', surface) },
      fatigue: { A: fa, B: fb },
      scoring: initialScoring(rules, config.firstServer),
      sideOfA: -1,
      points: [],
      betweenSets: false,
    },
  };
}

export const isOver = (live: LiveMatch): boolean => live.state.scoring.winner !== null;

/** Plays on to the end of the next point, the current set or the match; returns the new events. Cards apply to one point. */
export function advance(live: LiveMatch, until: 'point' | 'set' | 'match', options: { cards?: PointCards } = {}): MatchEvent[] {
  if (isOver(live)) throw new Error('The match is over');
  if (options.cards && until !== 'point') throw new Error('Cards are played for one point at a time');
  const s = live.state;
  const { surface, rules } = live.config;
  const from = live.events.length;
  s.betweenSets = false;
  while (s.scoring.winner === null) {
    const scoreBefore = cloneScore(s.scoring.score);
    const tags = pointTags(s.scoring);
    const players: Record<PlayerId, PlayerRuntime> = { A: { ...s.base.A, fatigue: s.fatigue.A }, B: { ...s.base.B, fatigue: s.fatigue.B } };
    const result = simulatePoint({
      server: scoreBefore.server,
      players,
      surface,
      pressure: pressureIndex(tags, isFinalSet(rules, scoreBefore.sets.length)),
      sideOfA: s.sideOfA,
      deuceCourt: (scoreBefore.points[0] + scoreBefore.points[1]) % 2 === 0,
      ...(options.cards ? { cards: options.cards } : {}),
    }, s.rng);
    const applied = applyPoint(s.scoring, result.winner);
    const point: PointEvent = {
      type: 'point', index: s.points.length, server: scoreBefore.server, winner: result.winner, serveNumber: result.serveNumber,
      rallyLength: result.rallyLength, endedBy: result.endedBy, shots: result.shots, scoreBefore,
      scoreAfter: cloneScore(applied.state.score), tags, durationSec: result.durationSec,
      ...(options.cards ? { cards: { ...options.cards } } : {}),
    };
    s.points.push(point);
    live.events.push(point, ...applied.events);
    for (const id of IDS) s.fatigue[id] = recover(addFatigue(s.fatigue[id], s.base[id].n.stamina, result.shotsHit[id], surface), FATIGUE.pointRecovery);
    let setOver = false;
    for (const e of applied.events) {
      if (e.type === 'changeover') s.sideOfA = -s.sideOfA as Side;
      if (e.type === 'set_end') {
        setOver = true;
        for (const id of IDS) s.fatigue[id] = recover(s.fatigue[id], FATIGUE.setRecovery);
      }
    }
    s.scoring = applied.state;
    if (setOver && until !== 'match' && s.scoring.winner === null) s.betweenSets = true;
    if (until === 'point' || (setOver && until === 'set')) break;
  }
  if (s.scoring.winner !== null) {
    live.events.push({ type: 'match_end', winner: s.scoring.winner, score: cloneScore(s.scoring.score), stats: computeStats(s.points) });
  }
  return live.events.slice(from);
}

/** A new tactic for `player` from the next set on; only while stopped between sets. */
export function setTactic(live: LiveMatch, player: PlayerId, tactic: Tactic): void {
  if (!live.state.betweenSets) throw new Error('Tactics can only change between sets');
  validateTactic(tactic);
  const copy = { ...tactic };
  live.state.base[player] = { ...live.state.base[player], tactic: copy };
  live.events.push({ type: 'tactic_change', player, tactic: { ...copy } });
}

export function finish(live: LiveMatch): MatchResult {
  const end = live.events.at(-1);
  if (end?.type !== 'match_end') throw new Error('The match is not over');
  return { schemaVersion: SCHEMA_VERSION, seed: live.seed, config: live.config, events: live.events, winner: end.winner, stats: end.stats };
}

/** Plays a recipe again: tactic changes when their set has finished, cards point by point. */
export function replayMatch(recipe: MatchRecipe): MatchResult {
  const live = startMatch(recipe.config, recipe.seed);
  let sets = 0;
  while (!isOver(live)) {
    for (const c of recipe.tacticChanges) if (c.afterSet === sets && sets > 0) setTactic(live, c.player, c.tactic);
    if (recipe.cards) {
      const cards = recipe.cards[live.state.points.length];
      advance(live, 'point', cards ? { cards } : {});
      if (live.state.betweenSets || isOver(live)) sets++;
    } else {
      advance(live, 'set');
      sets++;
    }
  }
  return finish(live);
}

function validateTactic(t: Tactic): void {
  for (const key of ['aggression', 'netApproach'] as const) {
    if (!(t[key] >= 0 && t[key] <= 1)) throw new RangeError(`Tactic ${key} must be in [0, 1], got ${t[key]}`);
  }
}

function validate(config: MatchConfig): void {
  for (const p of config.players) normalizeAttributes(p.attributes);
  config.tactics.forEach(validateTactic);
  for (const f of config.condition?.fatigue ?? []) {
    if (!(f >= 0 && f <= 1)) throw new RangeError(`Starting fatigue must be in [0, 1], got ${f}`);
  }
}
