// The broadcast player: canvas, score bug, graphics, sound and transport for one programme. Used by the replay
// page and the career match screen; dispose() removes it and its listeners.
import {
  broadcastFrameAt, buildProgramme, buildTimeline, clockReducer, createClock, createOverlays, createScoreBug, createViewer, cuesBetween, overlayAt,
  programmeTimeFor, type BroadcastFrame, type ClockAction, type ClockState, type Programme, type ReplayInput, type Timeline, type Viewer,
  type ViewMode,
} from '@tennis/renderer';
import { createControls } from './controls.ts';
import { createSound } from './sound.ts';

export interface Broadcast {
  /** Plays a match (or a match so far). keepTime keeps the clock where it is: for a match that grew by a set. */
  load(input: ReplayInput, opts?: { keepTime?: boolean }): Timeline;
  readonly programme: Programme | null;
  readonly clock: ClockState;
  dispatch(action: ClockAction): void;
  dispose(): void;
}

export interface BroadcastOptions {
  mode: ViewMode;
  /** After every drawn frame. */
  onFrame?(frame: BroadcastFrame, clock: ClockState, programme: Programme): void;
}

const div = (id: string) => Object.assign(document.createElement('div'), { id });

export function mountBroadcast(root: HTMLElement, options: BroadcastOptions): Broadcast {
  document.body.classList.add('broadcast-page');
  const canvas = Object.assign(document.createElement('canvas'), { id: 'view' });
  const [score, graphics, soundRoot, controlsRoot] = ['score', 'graphics', 'sound', 'controls'].map(div) as [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement];
  root.append(canvas, score, graphics, soundRoot, controlsRoot);
  const scoreBug = createScoreBug();
  score.append(scoreBug.element);
  const overlays = createOverlays();
  graphics.append(overlays.element);
  const sound = createSound(soundRoot);

  let mode = options.mode;
  let programme: Programme | null = null;
  let viewer: Viewer | null = null;
  let surface: string | null = null;
  let clock = createClock();
  const dispatch = (action: ClockAction) => {
    if (programme) clock = clockReducer(programme, clock, action);
  };
  const controls = createControls(controlsRoot, dispatch, (next) => {
    mode = next;
    if (!programme) return;
    // Keep the place: the new programme starts at (or just after) the match moment on screen now.
    const matchT = broadcastFrameAt(programme, clock.t).matchT;
    programme = buildProgramme(programme.timeline, mode);
    clock = { ...clock, t: programmeTimeFor(programme, matchT) };
    controls.setProgramme(programme);
  });
  const resize = () => viewer?.resize(canvas.clientWidth, canvas.clientHeight);
  window.addEventListener('resize', resize);

  let last = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (programme && viewer) {
      const before = clock.t;
      clock = clockReducer(programme, clock, { type: 'tick', dt });
      if (sound.mixer && clock.playing) for (const cue of cuesBetween(programme, before, clock.t, clock.speed)) sound.mixer.play(cue);
      const frame = broadcastFrameAt(programme, clock.t);
      viewer.render(frame, dt);
      // Read by the e2e tests and handy when debugging the director.
      Object.assign(document.body.dataset, { camera: frame.camera, clip: frame.clip, point: String(frame.pointIndex), t: frame.t.toFixed(2) });
      scoreBug.update(frame.scoreBug);
      overlays.update(overlayAt(programme, frame), programme.timeline.names);
      controls.update(clock, frame);
      options.onFrame?.(frame, clock, programme);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    load(input, opts = {}) {
      const timeline = buildTimeline(input);
      if (!viewer || surface !== timeline.surface || !opts.keepTime) {
        viewer?.dispose();
        viewer = createViewer(canvas, timeline);
        surface = timeline.surface;
        resize();
      }
      programme = buildProgramme(timeline, mode);
      clock = opts.keepTime ? clockReducer(programme, clock, { type: 'seek', t: clock.t }) : createClock();
      controls.setProgramme(programme);
      return timeline;
    },
    get programme() {
      return programme;
    },
    get clock() {
      return clock;
    },
    dispatch,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      sound.mixer?.dispose();
      viewer?.dispose();
      root.replaceChildren();
      document.body.classList.remove('broadcast-page');
    },
  };
}
