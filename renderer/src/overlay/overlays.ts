// Broadcast graphics as data (GDD §8.2): serve speed, rally count, captions, introduction, replay tag, Hawk-Eye
// call and stats panels. Pure; overlayDom.ts draws them.
import { computeStats, type MatchStats, type PlayerId, type PointEvent, type ScoreState } from '@tennis/engine';
import type { BroadcastFrame } from '../broadcast/frame.ts';
import type { Programme } from '../broadcast/types.ts';
import type { PointSegment, Timeline } from '../playback/timeline.ts';
import { BROADCAST, OVERLAY } from '../tuning/index.ts';

export interface OverlayModel {
  serveSpeed: { kmh: number; label: string } | null;
  rally: number | null;
  lowerThird: { title: string; detail?: string } | null;
  intro: { name: string; style: string }[] | null;
  replay: boolean;
  hawkeye: { call: 'IN' | 'OUT'; cm: number } | null;
  stats: { title: string; stats: MatchStats } | null;
}

export function overlayAt(programme: Programme, frame: BroadcastFrame): OverlayModel {
  const tl = programme.timeline;
  const seg = tl.segments[frame.pointIndex]!;
  const isLive = frame.clip === 'live';
  const tau = frame.matchT - seg.zero;
  const model: OverlayModel = {
    serveSpeed: isLive ? serveSpeed(seg.point, tau) : null,
    rally: isLive && frame.matchT < seg.end ? rallyCount(seg.point, tau) : null,
    lowerThird: isLive ? caption(tl, seg, frame.matchT) : null,
    intro: frame.clip === 'intro' ? programme.timeline.styles.map((style, i) => ({ name: tl.names[i]!, style: OVERLAY.styleLabels[style] })) : null,
    replay: frame.clip === 'replay' || frame.clip === 'hawkeye',
    hawkeye: frame.hawkeye ? { call: frame.hawkeye.call, cm: Math.round(Math.abs(frame.hawkeye.marginM) * 1000) / 10 } : null,
    stats: isLive ? statsPanel(tl, frame.pointIndex, frame.matchT) : null,
  };
  if (frame.clip === 'result' && tl.winner && tl.finalScore) {
    model.stats = { title: 'MATCH STATS', stats: matchStats(tl) };
    model.lowerThird = { title: 'GAME, SET AND MATCH', detail: `${tl.names[tl.winner === 'A' ? 0 : 1]} ${setScores(tl.finalScore, tl.winner)}` };
  }
  return model;
}

function serveSpeed(point: PointEvent, tau: number): OverlayModel['serveSpeed'] {
  const serves = point.shots.filter((s) => s.shot === 'serve');
  for (let k = serves.length - 1; k >= 0; k--) {
    const s = serves[k]!;
    if (tau >= s.t && tau <= s.t + OVERLAY.serveSpeedSec) return { kmh: Math.round(s.speedKmh), label: k === 0 ? '1st serve' : '2nd serve' };
  }
  return null;
}

function rallyCount(point: PointEvent, tau: number): number | null {
  const n = point.shots.filter((s) => s.outcome !== 'fault' && s.outcome !== 'double_fault' && s.t <= tau).length;
  return n >= OVERLAY.rallyFrom ? n : null;
}

function caption(tl: Timeline, seg: PointSegment, T: number): OverlayModel['lowerThird'] {
  if (T < seg.start || T > seg.zero + OVERLAY.lowerThirdAfterSec) return null;
  const { tags, scoreBefore, server } = seg.point;
  const name = (id: PlayerId) => tl.names[id === 'A' ? 0 : 1]!;
  if (tags.includes('match_point')) return { title: 'MATCH POINT', detail: name(setLeader(scoreBefore)) };
  if (tags.includes('set_point')) return { title: 'SET POINT', detail: name(setLeader(scoreBefore)) };
  if (tags.includes('break_point')) return { title: 'BREAK POINT', detail: name(server === 'A' ? 'B' : 'A') };
  if (tags.includes('tiebreak')) return { title: 'TIEBREAK' };
  return null;
}

/** Who is one point from the set: the player ahead in games, or in points in a tiebreak or at 5-5 and beyond. */
function setLeader(score: ScoreState): PlayerId {
  const [ga, gb] = score.games;
  if (!score.tiebreak && ga !== gb) return ga > gb ? 'A' : 'B';
  return score.points[0] >= score.points[1] ? 'A' : 'B';
}

const statsCache = new WeakMap<Timeline, Map<string, MatchStats>>();

function cached(tl: Timeline, key: string, make: () => MatchStats): MatchStats {
  let map = statsCache.get(tl);
  if (!map) statsCache.set(tl, (map = new Map()));
  if (!map.has(key)) map.set(key, make());
  return map.get(key)!;
}

const matchStats = (tl: Timeline) => cached(tl, 'match', () => computeStats(tl.segments.map((s) => s.point)));

/** After a set (or the match), once the reaction shot is over, until the next point starts. */
function statsPanel(tl: Timeline, index: number, T: number): OverlayModel['stats'] {
  const seg = tl.segments[index]!;
  if (seg.gap !== 'set_end' && seg.gap !== 'match_end') return null;
  if (T < seg.landed + BROADCAST.reactionSec || T >= seg.next) return null;
  if (seg.gap === 'match_end') return { title: 'MATCH STATS', stats: matchStats(tl) };
  const set = seg.point.scoreBefore.sets.length;
  const stats = cached(tl, `set${set}`, () => computeStats(tl.segments.filter((s) => s.point.scoreBefore.sets.length === set).map((s) => s.point)));
  return { title: `SET ${set + 1} STATS`, stats };
}

function setScores(score: ScoreState, winner: PlayerId): string {
  return score.sets.map(([a, b]) => (winner === 'A' ? `${a}-${b}` : `${b}-${a}`)).join(' ');
}
