// Builds the broadcast programme: the clips a viewing mode shows, cut by the director's cameras (ADR-009).
import type { Timeline } from '../playback/timeline.ts';
import { BROADCAST } from '../tuning/index.ts';
import { cameraTrack, isDecisive, type DirectorStyle, type TrackShot } from './director.ts';
import { selectPoints } from './modes.ts';
import { replayInserts } from './replay.ts';
import type { Clip, Programme, ViewMode } from './types.ts';

/** Clips shown after point `index` once play reaches match second `at` (replays, Hawk-Eye); see replay.ts. */
export interface Insert {
  at: number;
  clips: Omit<Clip, 'start'>[];
}
export type Inserts = (timeline: Timeline, index: number) => Insert | null;

export function buildProgramme(timeline: Timeline, mode: ViewMode, inserts: Inserts = replayInserts, options: { intro?: boolean; style?: DirectorStyle } = {}): Programme {
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
  if (options.intro !== false) push({ kind: 'intro', duration: BROADCAST.introSec, matchFrom: 0, rate: 0, camera: 'side', pointIndex: 0 });
  const track = cameraTrack(timeline, { style: options.style ?? 'broadcast' });
  const plain = (from: number, to: number, pointIndex: number) => {
    for (const shot of shotsBetween(track, from, to)) {
      const { camera, focus } = shot;
      push({ kind: 'live', duration: shot.to - shot.from, matchFrom: shot.from, rate: 1, pointIndex, camera, ...(focus ? { focus } : {}) });
    }
  };
  let impact: ReturnType<typeof impactMoment> = null;
  // Live play, with the impact moment spliced in where it falls.
  const live = (from: number, to: number, pointIndex: number) => {
    if (!impact || impact.contact < from || impact.contact >= to) return plain(from, to, pointIndex);
    const I = BROADCAST.impact;
    const { contact, focus } = impact;
    plain(from, contact - I.leadSec, pointIndex);
    const shot = { camera: 'impact' as const, focus, pointIndex };
    push({ kind: 'slowmo', duration: I.leadSec / I.rate, matchFrom: contact - I.leadSec, rate: I.rate, ...shot });
    push({ kind: 'hitstop', duration: I.hitstopSec, matchFrom: contact, rate: 0, ...shot });
    push({ kind: 'slowmo', duration: I.tailSec / I.rate, matchFrom: contact, rate: I.rate, ...shot });
    plain(contact + I.tailSec, to, pointIndex);
  };
  let previous = false;
  for (const i of selectPoints(timeline, mode)) {
    const seg = timeline.segments[i]!;
    impact = options.style === 'game' && !previous ? impactMoment(seg) : null;
    previous = impact !== null;
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

/** Programme second showing match second T live, or the next live moment after it; past the last live moment, its
 *  end (a quick match plays the walk after its last point to there, ADR-030); 0 if nothing is live. */
export function programmeTimeFor(programme: Programme, T: number): number {
  const live = programme.clips.filter((c) => c.kind === 'live');
  const inside = live.find((c) => T >= c.matchFrom && T < c.matchFrom + c.duration);
  if (inside) return inside.start + (T - inside.matchFrom);
  const last = live.at(-1);
  return live.find((c) => c.matchFrom >= T)?.start ?? (last ? last.start + last.duration : 0);
}

/** The deciding contact of a decisive point won by an ace or a winner (ADR-024 S3), and its hitter. */
function impactMoment(seg: Timeline['segments'][number]): { contact: number; focus: 'A' | 'B' } | null {
  const p = seg.point;
  if (!isDecisive(seg) || (p.endedBy !== 'ace' && p.endedBy !== 'winner')) return null;
  const last = p.shots.at(-1)!;
  return { contact: seg.zero + last.t, focus: last.hitter };
}

