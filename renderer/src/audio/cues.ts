// Sound cues on the programme clock (GDD §8.4), derived from the events alone; the mixer only plays them.
// Live clips get the ball, the umpire and the crowd; replays get the ball only, at their own pace.
import type { ShotType, Surface } from '@tennis/engine';
import type { Programme } from '../broadcast/types.ts';
import type { PointSegment, Timeline } from '../playback/timeline.ts';
import { AUDIO } from '../tuning/index.ts';
import { scoreCall } from './calls.ts';

export type CueBody =
  | { kind: 'hit'; shot: ShotType; speedKmh: number; replay: boolean }
  | { kind: 'bounce'; surface: Surface; replay: boolean }
  | { kind: 'net'; replay: boolean }
  | { kind: 'crowd'; intensity: number }
  | { kind: 'call'; text: string };

/** A sound at programme second `at`. */
export type Cue = CueBody & { at: number };

type Timed = { T: number; cue: CueBody };

export function crowdIntensity(s: PointSegment): number {
  const c = AUDIO.crowd;
  const p = s.point;
  const base = p.endedBy === 'ace' ? c.ace : p.endedBy === 'winner' ? c.winner : p.endedBy === 'double_fault' ? c.doubleFault : c.error;
  let tags = 0;
  for (const t of p.tags) tags += c[t];
  const rally = Math.min(c.rallyMax, p.rallyLength * c.perRallyShot);
  return Math.min(1, base + rally + tags + (s.endsGame ? c.gameWon : 0));
}

/** Everything audible in one point, in match seconds. */
function pointCues(tl: Timeline, s: PointSegment): Timed[] {
  const out: Timed[] = [];
  for (const shot of s.point.shots) {
    const contact = s.zero + shot.t;
    const land = contact + shot.flightSec;
    out.push({ T: contact, cue: { kind: 'hit', shot: shot.shot, speedKmh: shot.speedKmh, replay: false } });
    out.push(shot.bounce ? { T: land, cue: { kind: 'bounce', surface: tl.surface, replay: false } } : { T: land, cue: { kind: 'net', replay: false } });
    if (!shot.bounce) continue;
    const fault = shot.outcome === 'fault' || shot.outcome === 'double_fault';
    const out_ = shot.outcome === 'unforced_error' || shot.outcome === 'forced_error';
    if (fault || out_) out.push({ T: land + AUDIO.callDelaySec, cue: { kind: 'call', text: fault ? 'Fault' : 'Out' } });
  }
  const last = s.point.shots.at(-1)!;
  out.push({ T: s.zero + last.t + last.flightSec + AUDIO.crowdDelaySec, cue: { kind: 'crowd', intensity: crowdIntensity(s) } });
  const ctx = { server: s.point.server, winner: s.point.winner, endsGame: s.endsGame, gap: s.gap, noAd: tl.noAd };
  out.push({ T: s.end + AUDIO.scoreCallDelaySec, cue: { kind: 'call', text: scoreCall(s.point.scoreAfter, ctx, tl.names) } });
  return out;
}

const cache = new WeakMap<Programme, Cue[]>();

/** Every cue of the programme, sorted by programme time. */
export function allCues(p: Programme): Cue[] {
  const hit = cache.get(p);
  if (hit) return hit;
  const perPoint = new Map<number, Timed[]>();
  const cues: Cue[] = [];
  for (const clip of p.clips) {
    if (clip.kind !== 'live' && clip.kind !== 'replay') continue;
    const seg = p.timeline.segments[clip.pointIndex]!;
    if (!perPoint.has(clip.pointIndex)) perPoint.set(clip.pointIndex, pointCues(p.timeline, seg));
    const end = clip.matchFrom + clip.duration * clip.rate;
    for (const { T, cue } of perPoint.get(clip.pointIndex)!) {
      if (T < clip.matchFrom || T >= end) continue;
      const at = clip.start + (T - clip.matchFrom) / clip.rate;
      if (clip.kind === 'live') cues.push({ ...cue, at });
      else if ('replay' in cue) cues.push({ ...cue, replay: true, at });
    }
  }
  cues.sort((a, b) => a.at - b.at);
  cache.set(p, cues);
  return cues;
}

/** Cues in [t0, t1) of programme time while playing at `speed`; nothing for a seek or a jump back. */
export function cuesBetween(p: Programme, t0: number, t1: number, speed: number, maxGap: number = AUDIO.maxCueGapSec): Cue[] {
  if (t1 <= t0 || t1 - t0 > maxGap) return [];
  const voices = speed <= AUDIO.maxSpeedForVoices;
  const all = allCues(p);
  let lo = 0;
  let hi = all.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid]!.at < t0) lo = mid + 1;
    else hi = mid;
  }
  const out: Cue[] = [];
  for (let i = lo; i < all.length && all[i]!.at < t1; i++) {
    const c = all[i]!;
    if (voices || (c.kind !== 'call' && c.kind !== 'crowd')) out.push(c);
  }
  return out;
}
