// The broadcast player: canvas, score bug, graphics, sound and transport for one programme. Used by the replay
// page, the career match screen and the quick match (with the shared audio session); dispose() removes it and its
// listeners.
import {
  broadcastFrameAt, buildProgramme, buildTimeline, clockReducer, createClock, createOverlays, createScoreBug, createViewer, cuesBetween, initialTier, overlayAt,
  programmeTimeFor, type BroadcastFrame, type ClockAction, type ClockState, type Programme, type ReplayInput, type Timeline, type Viewer,
  type Mixer, type QualityTier, type ViewMode,
} from '@tennis/renderer';
import { createControls } from './controls.ts';
import { createSound } from './sound.ts';

export interface Broadcast {
  /** Plays a match (or a match so far). keepTime keeps the clock where it is: for a match that grew by a set. */
  load(input: ReplayInput, opts?: { keepTime?: boolean }): Timeline;
  readonly programme: Programme | null;
  readonly clock: ClockState;
  dispatch(action: ClockAction): void;
  /** Plays match seconds [from, to] at `speed`, then stops; resolves when done (quick matches). */
  playWindow(from: number, to: number, speed: number): Promise<void>;
  dispose(): void;
}

export interface BroadcastOptions {
  mode: ViewMode;
  /** Transport controls (play, seek, speeds, modes); off for quick matches. */
  controls?: boolean;
  /** Programme without the introduction and replays (quick matches). */
  bare?: boolean;
  /** After every drawn frame. */
  onFrame?(frame: BroadcastFrame, clock: ClockState, programme: Programme): void;
  /** A shared mixer (the quick match's audio session, ADR-022) instead of this player's own sound panel. */
  audio?(): Mixer | null;
}

const div = (id: string) => Object.assign(document.createElement('div'), { id });

/**
 * The render quality for this page's life (M7, ADR-022): `?quality=low|high` forces it (tests, debugging); otherwise
 * low on a device with few cores, high elsewhere, and it only ever steps down. Shown as `body.dataset.quality`.
 */
let tier: QualityTier | null = null;
function startTier(): QualityTier {
  const forced = new URLSearchParams(location.search).get('quality');
  tier ??= forced === 'low' || forced === 'high' ? forced : initialTier(navigator.hardwareConcurrency);
  document.body.dataset.quality = tier;
  return tier;
}
const stepDown = (next: QualityTier) => {
  tier = next;
  document.body.dataset.quality = next;
};

export function mountBroadcast(root: HTMLElement, options: BroadcastOptions): Broadcast {
  document.body.classList.add('broadcast-page');
  const canvas = Object.assign(document.createElement('canvas'), { id: 'view' });
  const [score, graphics, soundRoot, controlsRoot] = ['score', 'graphics', 'sound', 'controls'].map(div) as [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement];
  root.append(canvas, score, graphics);
  if (!options.audio) root.append(soundRoot);
  if (options.controls !== false) root.append(controlsRoot);
  const build = (timeline: Timeline) => (options.bare ? buildProgramme(timeline, mode, () => null, { intro: false }) : buildProgramme(timeline, mode));
  let clipWindow: { end: number; speed: number; done: () => void } | null = null;
  const scoreBug = createScoreBug();
  score.append(scoreBug.element);
  const overlays = createOverlays();
  graphics.append(overlays.element);
  const sound = options.audio ? null : createSound(soundRoot);
  const mixer = () => (options.audio ? options.audio() : sound!.mixer);

  let mode = options.mode;
  let programme: Programme | null = null;
  let viewer: Viewer | null = null;
  let surface: string | null = null;
  let clock = createClock();
  const dispatch = (action: ClockAction) => {
    if (programme) clock = clockReducer(programme, clock, action);
  };
  const controls = options.controls === false ? null : createControls(controlsRoot, dispatch, (next) => {
    mode = next;
    if (!programme) return;
    // Keep the place: the new programme starts at (or just after) the match moment on screen now.
    const matchT = broadcastFrameAt(programme, clock.t).matchT;
    programme = build(programme.timeline);
    clock = { ...clock, t: programmeTimeFor(programme, matchT) };
    controls?.setProgramme(programme);
  });
  // The canvas may be mounted before it is in the document (size 0): every frame checks its size instead.
  let size = '';
  const resize = () => {
    const next = `${canvas.clientWidth}x${canvas.clientHeight}`;
    if (next === size || !viewer || canvas.clientWidth === 0) return;
    size = next;
    viewer.resize(canvas.clientWidth, canvas.clientHeight);
  };

  let last = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (programme && viewer) {
      resize();
      const before = clock.t;
      if (clipWindow) {
        clock = { ...clock, t: Math.min(clipWindow.end, clock.t + Math.min(dt, 0.25) * clipWindow.speed) };
        const m = mixer();
        if (m) for (const cue of cuesBetween(programme, before, clock.t, clipWindow.speed)) m.play(cue);
        if (clock.t >= clipWindow.end) {
          const { done } = clipWindow;
          clipWindow = null;
          done();
        }
      } else {
        clock = clockReducer(programme, clock, { type: 'tick', dt });
        const m = mixer();
        if (m && clock.playing) for (const cue of cuesBetween(programme, before, clock.t, clock.speed)) m.play(cue);
      }
      const frame = broadcastFrameAt(programme, clock.t);
      viewer.render(frame, dt);
      // Read by the e2e tests and handy when debugging the director.
      Object.assign(document.body.dataset, { camera: frame.camera, clip: frame.clip, point: String(frame.pointIndex), t: frame.t.toFixed(2) });
      scoreBug.update(frame.scoreBug);
      overlays.update(overlayAt(programme, frame), programme.timeline.names);
      controls?.update(clock, frame);
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
        viewer = createViewer(canvas, timeline, startTier(), stepDown);
        surface = timeline.surface;
        size = '';
        resize();
      }
      programme = build(timeline);
      clock = opts.keepTime ? clockReducer(programme, clock, { type: 'seek', t: clock.t }) : createClock();
      controls?.setProgramme(programme);
      return timeline;
    },
    get programme() {
      return programme;
    },
    get clock() {
      return clock;
    },
    dispatch,
    playWindow(from, to, speed) {
      if (!programme) return Promise.resolve();
      const p = programme;
      return new Promise<void>((done) => {
        clipWindow?.done();
        clock = { ...clock, playing: false, t: programmeTimeFor(p, from) };
        clipWindow = { end: Math.max(clock.t, programmeTimeFor(p, to)), speed, done };
      });
    },
    dispose() {
      clipWindow?.done();
      clipWindow = null;
      cancelAnimationFrame(raf);
      controls?.dispose();
      sound?.dispose();
      viewer?.dispose();
      root.replaceChildren();
      document.body.classList.remove('broadcast-page');
    },
  };
}
