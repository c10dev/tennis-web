// Replay clock as a pure reducer: play/pause, speed, seek and point jumps (GDD §8.3). The UI only dispatches.
import { clamp } from '../math.ts';
import { PLAYBACK } from '../tuning/index.ts';

/** Anything the clock can play: a match timeline or a broadcast programme. */
export interface Seekable {
  totalSec: number;
  /** Ascending seconds at which each point starts. */
  pointStarts: readonly number[];
}

export interface ClockState {
  t: number;
  playing: boolean;
  speed: number;
}

export type ClockAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'seek'; t: number }
  | { type: 'tick'; dt: number }
  | { type: 'nextPoint' }
  | { type: 'prevPoint' };

export function createClock(): ClockState {
  return { t: 0, playing: false, speed: 1 };
}

export function clockReducer(timeline: Seekable, state: ClockState, action: ClockAction): ClockState {
  switch (action.type) {
    case 'play':
      return state.t >= timeline.totalSec ? { ...state, t: 0, playing: true } : { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false };
    case 'toggle':
      return clockReducer(timeline, state, { type: state.playing ? 'pause' : 'play' });
    case 'setSpeed':
      return (PLAYBACK.speeds as readonly number[]).includes(action.speed) ? { ...state, speed: action.speed } : state;
    case 'seek':
      return { ...state, t: clamp(action.t, 0, timeline.totalSec) };
    case 'tick': {
      if (!state.playing) return state;
      const t = state.t + clamp(action.dt, 0, PLAYBACK.maxTickSec) * state.speed;
      return t >= timeline.totalSec ? { ...state, t: timeline.totalSec, playing: false } : { ...state, t };
    }
    case 'nextPoint':
      return { ...state, t: timeline.pointStarts.find((s) => s > state.t) ?? timeline.totalSec };
    case 'prevPoint': {
      const starts = timeline.pointStarts;
      const i = starts.findLastIndex((s) => s <= state.t);
      if (i < 0) return { ...state, t: 0 };
      const target = state.t - starts[i]! > PLAYBACK.prevPointGraceSec || i === 0 ? starts[i]! : starts[i - 1]!;
      return { ...state, t: target };
    }
  }
}
