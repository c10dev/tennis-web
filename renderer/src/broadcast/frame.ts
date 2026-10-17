// What the broadcast shows at programme second t: the match frame at the clip's match time, plus camera and clip.
import { clamp } from '../math.ts';
import { matchFrameAt, type Frame } from '../playback/frame.ts';
import { lineCall, type LineCall } from './hawkeye.ts';
import { clipAt } from './programme.ts';
import type { CameraShot, ClipKind, Programme } from './types.ts';

export interface BroadcastFrame extends Frame, CameraShot {
  clip: ClipKind;
  /** The match second on screen. */
  matchT: number;
  /** Seconds into the clip on screen: what moves while match time stands still (a hit-stop). */
  clipT: number;
  /** The line call shown on a Hawk-Eye clip; null otherwise. */
  hawkeye: LineCall | null;
}

export function broadcastFrameAt(programme: Programme, time: number): BroadcastFrame {
  const t = clamp(time, 0, programme.totalSec);
  const clip = clipAt(programme, t);
  const matchT = clip.matchFrom + (t - clip.start) * clip.rate;
  const frame = matchFrameAt(programme.timeline, matchT, clip.scoreTime ?? matchT);
  const ball = clip.kind === 'intro' ? null : frame.ball;
  const point = programme.timeline.segments[clip.pointIndex]!.point;
  const hawkeye = clip.kind === 'hawkeye' ? lineCall(point, point.shots.at(-1)!) : null;
  return { ...frame, ball, t, matchT, clipT: t - clip.start, hawkeye, clip: clip.kind, camera: clip.camera, ...(clip.focus ? { focus: clip.focus } : {}) };
}
