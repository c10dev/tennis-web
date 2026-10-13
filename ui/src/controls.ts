// Transport bar: play/pause, previous/next point, seek bar, speeds, time and point readout, keyboard shortcuts.
import { PLAYBACK, type ClockAction, type ClockState, type Frame, type Programme, type ViewMode } from '@tennis/renderer';

export interface Controls {
  setProgramme(programme: Programme): void;
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

const MODES: [ViewMode, string][] = [['full', 'Full'], ['key', 'Key points'], ['highlights', 'Highlights'], ['result', 'Result']];

export function createControls(root: HTMLElement, dispatch: (action: ClockAction) => void, onMode: (mode: ViewMode) => void): Controls {
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
  const modes = MODES.map(([mode, label]) => {
    const b = button(label, `Viewing mode: ${label}`, () => onMode(mode));
    b.className = 'mode';
    b.dataset.mode = mode;
    return b;
  });
  const modeGroup = document.createElement('div');
  modeGroup.className = 'modes';
  modeGroup.append(...modes);
  root.append(
    button('⏮', 'Previous point (←)', () => dispatch({ type: 'prevPoint' })), play,
    button('⏭', 'Next point (→)', () => dispatch({ type: 'nextPoint' })), seek, time, point, ...speeds, modeGroup,
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
  let current: ViewMode = 'full';
  return {
    setProgramme(programme) {
      total = programme.totalSec;
      points = programme.timeline.segments.length;
      current = programme.mode;
      for (const b of modes) b.classList.toggle('active', b.dataset.mode === current);
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
