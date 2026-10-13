// What the broadcast shows at programme second t: the match frame at the clip's match time, plus camera and clip.
import { clamp } from '../math.ts';
import { matchFrameAt, type Frame } from '../playback/frame.ts';
import { clipAt } from './programme.ts';
import type { CameraShot, ClipKind, Programme } from './types.ts';

export interface BroadcastFrame extends Frame, CameraShot {
  clip: ClipKind;
  /** The match second on screen. */
  matchT: number;
}

export function broadcastFrameAt(programme: Programme, time: number): BroadcastFrame {
  const t = clamp(time, 0, programme.totalSec);
  const clip = clipAt(programme, t);
  const matchT = clip.matchFrom + (t - clip.start) * clip.rate;
  const frame = matchFrameAt(programme.timeline, matchT, clip.scoreTime ?? matchT);
  const ball = clip.kind === 'intro' ? null : frame.ball;
  return { ...frame, ball, t, matchT, clip: clip.kind, camera: clip.camera, ...(clip.focus ? { focus: clip.focus } : {}) };
}
