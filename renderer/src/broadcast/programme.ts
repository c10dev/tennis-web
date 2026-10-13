// Builds the broadcast programme: the clips a viewing mode shows, cut by the director's cameras (ADR-009).
import type { Timeline } from '../playback/timeline.ts';
import { BROADCAST } from '../tuning/index.ts';
import { cameraTrack, type TrackShot } from './director.ts';
import { selectPoints } from './modes.ts';
import type { Clip, Programme, ViewMode } from './types.ts';

/** Clips shown after point `index` once play reaches match second `at` (replays, Hawk-Eye); see replay.ts. */
export interface Insert {
  at: number;
  clips: Omit<Clip, 'start'>[];
}
export type Inserts = (timeline: Timeline, index: number) => Insert | null;

const none: Inserts = () => null;

export function buildProgramme(timeline: Timeline, mode: ViewMode, inserts: Inserts = none): Programme {
  const clips: Clip[] = [];
  const pointStarts: number[] = [];
  let t = 0;
  const push = (c: Omit<Clip, 'start'>) => {
    clips.push({ ...c, start: t });
    t += c.duration;
  };
  const last = timeline.segments.length - 1;
  if (mode === 'result') {
    push({ kind: 'result', duration: BROADCAST.resultSec, matchFrom: timeline.totalSec, rate: 0, camera: 'side', pointIndex: last });
    return { mode, clips, totalSec: t, pointStarts: [0], timeline };
  }
  push({ kind: 'intro', duration: BROADCAST.introSec, matchFrom: 0, rate: 0, camera: 'side', pointIndex: 0 });
  const track = cameraTrack(timeline);
  const live = (from: number, to: number, pointIndex: number) => {
    for (const shot of shotsBetween(track, from, to)) {
      const { camera, focus } = shot;
      push({ kind: 'live', duration: shot.to - shot.from, matchFrom: shot.from, rate: 1, pointIndex, camera, ...(focus ? { focus } : {}) });
    }
  };
  for (const i of selectPoints(timeline, mode)) {
    const seg = timeline.segments[i]!;
    pointStarts.push(t);
    const extra = inserts(timeline, i);
    if (!extra) {
      live(seg.start, seg.next, i);
      continue;
    }
    live(seg.start, extra.at, i);
    extra.clips.forEach(push);
    live(extra.at, seg.next, i);
  }
  return { mode, clips, totalSec: t, pointStarts, timeline };
}

function shotsBetween(track: TrackShot[], from: number, to: number): TrackShot[] {
  return track
    .filter((s) => s.to > from && s.from < to)
    .map((s) => ({ ...s, from: Math.max(from, s.from), to: Math.min(to, s.to) }));
}

/** The clip playing at programme second t (clamped). */
export function clipAt(programme: Programme, t: number): Clip {
  const c = programme.clips;
  let lo = 0;
  let hi = c.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c[mid]!.start <= t) lo = mid;
    else hi = mid - 1;
  }
  return c[lo]!;
}

/** Programme second showing match second T live, or the next live moment after it; 0 if none. */
export function programmeTimeFor(programme: Programme, T: number): number {
  const live = programme.clips.filter((c) => c.kind === 'live');
  const inside = live.find((c) => T >= c.matchFrom && T < c.matchFrom + c.duration);
  if (inside) return inside.start + (T - inside.matchFrom);
  return live.find((c) => c.matchFrom >= T)?.start ?? 0;
}
