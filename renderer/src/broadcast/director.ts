// The camera director (GDD §8.1): a rule per moment, decided from event tags alone, laid over the whole match.
// Main Cam is the default; later rules win where they overlap: Side Cam while players change ends, Reaction Cam
// after aces, winners and big points, Serve Cam before big points and the first point of each game.
import type { PointSegment, Timeline } from '../playback/timeline.ts';
import { BROADCAST } from '../tuning/index.ts';
import { BIG_POINTS } from './modes.ts';
import type { CameraShot } from './types.ts';

export interface TrackShot extends CameraShot {
  /** Match seconds. */
  from: number;
  to: number;
}


export type DirectorStyle = 'broadcast' | 'game';

/**
 * A point that decided something worth a close-up in the game style (ADR-024): an ace or winner on a break, set or
 * match point, a converted break point, or the last point of a set or the match.
 */
export function isDecisive(s: PointSegment): boolean {
  const p = s.point;
  const big = p.tags.some((t) => BIG_POINTS.has(t));
  return ((p.endedBy === 'ace' || p.endedBy === 'winner') && big) || (p.tags.includes('break_point') && p.winner !== p.server)
    || s.gap === 'set_end' || s.gap === 'match_end';
}

/** The game director: the chase camera through live play, the side camera at changeovers, a close-up on the winner
 * of a decisive point. */
function gameTrack(timeline: Timeline, lay: (shot: TrackShot) => void): void {
  for (const s of timeline.segments) {
    if (s.gap === 'changeover' || s.gap === 'set_end') lay({ from: s.end, to: s.next, camera: 'side' });
  }
  for (const s of timeline.segments) {
    if (isDecisive(s)) lay({ from: s.landed, to: Math.min(s.landed + BROADCAST.reactionSec, s.next), camera: 'closeup', focus: s.point.winner });
  }
}

export function cameraTrack(timeline: Timeline, { style = 'broadcast' }: { style?: DirectorStyle } = {}): TrackShot[] {
  let track: TrackShot[] = [{ from: 0, to: timeline.totalSec, camera: style === 'game' ? 'chase' : 'main' }];
  const lay = (shot: TrackShot) => {
    const from = Math.max(0, shot.from);
    const to = Math.min(timeline.totalSec, shot.to);
    if (to > from) track = overlay(track, { ...shot, from, to });
  };
  if (style === 'game') {
    gameTrack(timeline, lay);
    return merge(track);
  }
  for (const s of timeline.segments) {
    if (s.gap === 'changeover' || s.gap === 'set_end') lay({ from: s.end, to: s.next, camera: 'side' });
  }
  for (const s of timeline.segments) {
    const p = s.point;
    if (!(p.endedBy === 'ace' || p.endedBy === 'winner' || p.tags.some((t) => BIG_POINTS.has(t)))) continue;
    lay({ from: s.landed, to: Math.min(s.landed + BROADCAST.reactionSec, s.next), camera: 'reaction', focus: p.winner });
  }
  for (const s of timeline.segments) {
    const p = s.point;
    const opener = p.scoreBefore.points[0] === 0 && p.scoreBefore.points[1] === 0;
    if (!(opener || p.tags.some((t) => BIG_POINTS.has(t)))) continue;
    lay({ from: s.start - BROADCAST.serveCamLeadSec, to: s.zero + BROADCAST.serveCamTailSec, camera: 'serve', focus: p.server });
  }
  return merge(track);
}

/** Put `shot` over the track, trimming whatever it covers. */
function overlay(track: TrackShot[], shot: TrackShot): TrackShot[] {
  const out: TrackShot[] = [];
  for (const s of track) {
    if (s.to <= shot.from || s.from >= shot.to) out.push(s);
    else {
      if (s.from < shot.from) out.push({ ...s, to: shot.from });
      if (s.to > shot.to) out.push({ ...s, from: shot.to });
    }
  }
  out.push(shot);
  return out.sort((a, b) => a.from - b.from);
}

function merge(track: TrackShot[]): TrackShot[] {
  const out: TrackShot[] = [];
  for (const s of track) {
    const prev = out.at(-1);
    if (prev && prev.camera === s.camera && prev.focus === s.focus) prev.to = s.to;
    else out.push({ ...s });
  }
  return out;
}

/** The shot covering match second T (binary search). */
export function cameraAt(track: TrackShot[], T: number): CameraShot {
  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid]!.from <= T) lo = mid;
    else hi = mid - 1;
  }
  const s = track[lo]!;
  return s.focus ? { camera: s.camera, focus: s.focus } : { camera: s.camera };
}

/** The shot on screen: the frame's own, or the one a UI holds over it (the decision hold, ADR-024 S2). */
export function heldShot(frame: CameraShot, hold: CameraShot | null): CameraShot {
  const shot = hold ?? frame;
  return shot.focus ? { camera: shot.camera, focus: shot.focus } : { camera: shot.camera };
}

