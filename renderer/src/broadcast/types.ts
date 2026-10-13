// The broadcast programme: what plays when, from which camera (ADR-009).
import type { PlayerId } from '@tennis/engine';
import type { Timeline } from '../playback/timeline.ts';

export type CameraId = 'main' | 'serve' | 'reaction' | 'side' | 'hawkeye';
export type ClipKind = 'live' | 'replay' | 'hawkeye' | 'intro' | 'result';
export type ViewMode = 'full' | 'key' | 'highlights' | 'result';

export interface CameraShot {
  camera: CameraId;
  /** The player the camera is on: the server for Serve Cam, the point winner for Reaction Cam. */
  focus?: PlayerId;
}

export interface Clip extends CameraShot {
  /** Programme seconds. */
  start: number;
  duration: number;
  kind: ClipKind;
  /** Match (timeline) second at the clip's start, and match seconds per programme second (0 holds a still). */
  matchFrom: number;
  rate: number;
  pointIndex: number;
  /** Match second whose score the score bug shows, when it is not the clip's own (replays keep the score after). */
  scoreTime?: number;
}

export interface Programme {
  mode: ViewMode;
  timeline: Timeline;
  clips: Clip[];
  totalSec: number;
  /** Programme second each shown point starts, for the clock's point jumps. */
  pointStarts: number[];
}
