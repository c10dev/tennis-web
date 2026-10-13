// A match laid out on one replay clock: each point gets a segment (toss lead, the point, a pause after it).
import type { MatchResult, PlayerId, PointEvent, ScoreState, Surface } from '@tennis/engine';
import { SUPPORTED_SCHEMA_VERSION } from '../version.ts';
import { PLAYBACK } from '../tuning/index.ts';

export type GapKind = 'point' | 'changeover' | 'set_end' | 'match_end';

export interface PointSegment {
  point: PointEvent;
  /** Replay second the segment starts: the first serve's toss. */
  start: number;
  /** Replay second of point time 0 (first serve contact); point time τ = t − zero. */
  zero: number;
  /** Replay second the point's data ends (zero + durationSec). */
  end: number;
  /** Replay second the next segment starts (end + the pause). */
  next: number;
  gap: GapKind;
  /** The point finished a game, and that game was a break of serve. */
  endsGame: boolean;
  isBreak: boolean;
}

export interface Timeline {
  segments: PointSegment[];
  totalSec: number;
  /** Replay second each point starts (what the clock's point jumps use). */
  pointStarts: number[];
  names: [string, string];
  surface: Surface;
  noAd: boolean;
  winner: PlayerId;
  finalScore: ScoreState;
}

const GAP_SEC: Record<GapKind, number> = {
  point: PLAYBACK.pointGapSec,
  changeover: PLAYBACK.changeoverSec,
  set_end: PLAYBACK.setEndSec,
  match_end: PLAYBACK.matchEndHoldSec,
};

export function buildTimeline(result: MatchResult): Timeline {
  if (result.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`Replay has schema version ${String(result.schemaVersion)}; this renderer expects ${SUPPORTED_SCHEMA_VERSION}.`);
  }
  const segments: PointSegment[] = [];
  let finalScore: ScoreState | null = null;
  let t = 0;
  result.events.forEach((e, i) => {
    if (e.type === 'match_end') finalScore = e.score;
    if (e.type !== 'point') return;
    const { gap, endsGame, isBreak } = after(result, i);
    const zero = t + PLAYBACK.tossLeadSec;
    const end = zero + e.durationSec;
    const next = end + GAP_SEC[gap];
    segments.push({ point: e, start: t, zero, end, next, gap, endsGame, isBreak });
    t = next;
  });
  if (segments.length === 0 || finalScore === null) throw new Error('Replay has no points or no match_end event.');
  const config = result.config;
  return {
    segments, totalSec: t, pointStarts: segments.map((s) => s.start), names: [config.players[0].name, config.players[1].name], surface: config.surface,
    noAd: config.rules.noAd, winner: result.winner, finalScore,
  };
}

/** What the point at `index` finished (a game, a changeover, a set, the match), which sets the pause after it. */
function after(result: MatchResult, index: number): { gap: GapKind; endsGame: boolean; isBreak: boolean } {
  const kinds = new Set<string>();
  let isBreak = false;
  for (let j = index + 1; j < result.events.length && result.events[j]!.type !== 'point'; j++) {
    const e = result.events[j]!;
    kinds.add(e.type);
    if (e.type === 'game_end') isBreak = e.isBreak;
  }
  const gap: GapKind = kinds.has('match_end') ? 'match_end' : kinds.has('set_end') ? 'set_end' : kinds.has('changeover') ? 'changeover' : 'point';
  return { gap, endsGame: kinds.has('game_end'), isBreak };
}

/** Index of the segment playing at replay time t (clamped to the match). */
export function segmentAt(timeline: Timeline, t: number): number {
  const s = timeline.segments;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid]!.start <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The score bug's score: before the point while it is played, after it during the pause, final at the end. */
export function scoreAt(timeline: Timeline, t: number): ScoreState {
  const i = segmentAt(timeline, t);
  const seg = timeline.segments[i]!;
  if (t < seg.end) return seg.point.scoreBefore;
  return i === timeline.segments.length - 1 ? timeline.finalScore : seg.point.scoreAfter;
}
