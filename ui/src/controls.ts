// Transport bar: play/pause, previous/next point, seek bar, speeds, time and point readout, keyboard shortcuts.
import { PLAYBACK, type ClockAction, type ClockState, type Frame, type Timeline } from '@tennis/renderer';

export interface Controls {
  setTimeline(timeline: Timeline): void;
  update(clock: ClockState, frame: Frame): void;
}

const clockText = (sec: number) => {
  const s = Math.floor(sec);
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return (hms[0] ? `${hms[0]}:${String(hms[1]).padStart(2, '0')}` : String(hms[1])) + `:${String(hms[2]).padStart(2, '0')}`;
};

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

export function createControls(root: HTMLElement, dispatch: (action: ClockAction) => void): Controls {
  const play = button('▶', 'Play / pause (Space)', () => dispatch({ type: 'toggle' }));
  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'seek';
  seek.min = '0';
  seek.step = '0.1';
  let dragging = false;
  seek.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  seek.addEventListener('input', () => dispatch({ type: 'seek', t: Number(seek.value) }));
  const time = document.createElement('span');
  time.className = 'time';
  const point = document.createElement('span');
  point.className = 'point';
  const speeds = PLAYBACK.speeds.map((speed) => {
    const b = button(`${speed}×`, `Speed ${speed}×`, () => dispatch({ type: 'setSpeed', speed }));
    b.className = 'speed';
    b.dataset.speed = String(speed);
    return b;
  });
  root.append(
    button('⏮', 'Previous point (←)', () => dispatch({ type: 'prevPoint' })), play,
    button('⏭', 'Next point (→)', () => dispatch({ type: 'nextPoint' })), seek, time, point, ...speeds,
  );
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    const action: ClockAction | null = e.code === 'Space' ? { type: 'toggle' }
      : e.code === 'ArrowLeft' ? { type: 'prevPoint' } : e.code === 'ArrowRight' ? { type: 'nextPoint' } : null;
    if (!action) return;
    e.preventDefault();
    dispatch(action);
  });

  let total = 0;
  let points = 0;
  return {
    setTimeline(timeline) {
      total = timeline.totalSec;
      points = timeline.segments.length;
      seek.max = String(total);
    },
    update(clock, frame) {
      play.textContent = clock.playing ? '❚❚' : '▶';
      if (!dragging) seek.value = String(clock.t);
      time.textContent = `${clockText(clock.t)} / ${clockText(total)}`;
      point.textContent = `Point ${frame.pointIndex + 1}/${points}`;
      for (const b of speeds) b.classList.toggle('active', Number(b.dataset.speed) === clock.speed);
    },
  };
}
