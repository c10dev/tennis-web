// Replay clock as a pure reducer: play/pause, speed, seek and point jumps (GDD §8.3). The UI only dispatches.
import { PLAYBACK } from '../tuning.ts';
import { segmentAt, type Timeline } from './timeline.ts';

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

export function clockReducer(timeline: Timeline, state: ClockState, action: ClockAction): ClockState {
  const clamp = (t: number) => Math.min(timeline.totalSec, Math.max(0, t));
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
      return { ...state, t: clamp(action.t) };
    case 'tick': {
      if (!state.playing) return state;
      const t = state.t + Math.min(PLAYBACK.maxTickSec, Math.max(0, action.dt)) * state.speed;
      return t >= timeline.totalSec ? { ...state, t: timeline.totalSec, playing: false } : { ...state, t };
    }
    case 'nextPoint': {
      const next = timeline.segments[segmentAt(timeline, state.t) + 1];
      return { ...state, t: next ? next.start : timeline.totalSec };
    }
    case 'prevPoint': {
      const i = segmentAt(timeline, state.t);
      const seg = timeline.segments[i]!;
      const target = state.t - seg.start > PLAYBACK.prevPointGraceSec || i === 0 ? seg : timeline.segments[i - 1]!;
      return { ...state, t: target.start };
    }
  }
}
