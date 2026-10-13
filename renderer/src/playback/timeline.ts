// A match laid out on one replay clock: each point gets a segment (toss lead, the point, a pause after it).
import type { MatchConfig, MatchEvent, MatchResult, PlayerId, PlayStyle, PointEvent, ScoreState, Surface } from '@tennis/engine';
import { SUPPORTED_SCHEMA_VERSIONS } from '../version.ts';
import { PLAYBACK } from '../tuning/index.ts';

export type GapKind = 'point' | 'changeover' | 'set_end' | 'match_end';

export interface PointSegment {
  point: PointEvent;
  /** Replay second the segment starts: the first serve's toss. */
  start: number;
  /** Replay second of point time 0 (first serve contact); point time τ = t − zero. */
  zero: number;
  /** Replay second the point's last ball lands (or hits the net): where reactions, replays and applause key off. */
  landed: number;
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
  styles: [PlayStyle, PlayStyle];
  surface: Surface;
  noAd: boolean;
  /** False while the match is still being played (no match_end yet): then there is no winner or final score. */
  complete: boolean;
  winner: PlayerId | null;
  finalScore: ScoreState | null;
}

/** A finished MatchResult, or a match in progress: its events so far. */
export type ReplayInput = Pick<MatchResult, 'schemaVersion' | 'config'> & { events: MatchEvent[]; config: MatchConfig };

const GAP_SEC: Record<GapKind, number> = {
  point: PLAYBACK.pointGapSec,
  changeover: PLAYBACK.changeoverSec,
  set_end: PLAYBACK.setEndSec,
  match_end: PLAYBACK.matchEndHoldSec,
};

export function buildTimeline(result: ReplayInput): Timeline {
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(result.schemaVersion)) {
    throw new Error(`Replay has schema version ${String(result.schemaVersion)}; this renderer expects ${SUPPORTED_SCHEMA_VERSIONS.join(' or ')}.`);
  }
  const segments: PointSegment[] = [];
  let finalScore: ScoreState | null = null;
  let winner: PlayerId | null = null;
  let t = 0;
  result.events.forEach((e, i) => {
    if (e.type === 'match_end') ({ score: finalScore, winner } = e);
    if (e.type !== 'point') return;
    const { gap, endsGame, isBreak } = after(result, i);
    const zero = t + PLAYBACK.tossLeadSec;
    const end = zero + e.durationSec;
    const next = end + GAP_SEC[gap];
    const last = e.shots.at(-1)!;
    segments.push({ point: e, start: t, zero, landed: zero + last.t + last.flightSec, end, next, gap, endsGame, isBreak });
    t = next;
  });
  if (segments.length === 0) throw new Error('Replay has no points.');
  const config = result.config;
  return {
    segments, totalSec: t, pointStarts: segments.map((s) => s.start), names: [config.players[0].name, config.players[1].name],
    styles: [config.players[0].style, config.players[1].style], surface: config.surface,
    noAd: config.rules.noAd, complete: finalScore !== null, winner, finalScore,
  };
}

/** What the point at `index` finished (a game, a changeover, a set, the match), which sets the pause after it. */
function after(result: ReplayInput, index: number): { gap: GapKind; endsGame: boolean; isBreak: boolean } {
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
  return i === timeline.segments.length - 1 && timeline.finalScore ? timeline.finalScore : seg.point.scoreAfter;
}
