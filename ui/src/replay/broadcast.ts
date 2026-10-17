// The broadcast player: canvas, score bug, graphics, sound and transport for one programme. Used by the replay
// page, the career match screen and the quick match (with the shared audio session); dispose() removes it and its
// listeners.
import {
  broadcastFrameAt, buildProgramme, buildTimeline, clockReducer, createClock, createOverlays, createScoreBug, createViewer, cuesBetween, initialTier, overlayAt,
  programmeTimeFor, type BroadcastFrame, type ClockAction, type ClockState, type Programme, type ReplayInput, type Timeline, type Viewer,
  type DirectorStyle, type HoldShot, type Mixer, type PlayerModel, type QualityTier, type ViewMode,
} from '@tennis/renderer';
import { spanStep, type PlaySpan, type SpanState } from './clip.ts';
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
  /** Plays these contiguous match-second spans as one stretch, each speed change ramped over `rampSec` (the hybrid
   *  edit, ADR-030); resolves at the last one's end. */
  playSpans(spans: readonly PlaySpan[], rampSec?: number): Promise<void>;
  /** Resolves once the loaded match's shaders are compiled; await it before the first clip (TD-037). */
  ready(): Promise<void>;
  /** Hold a shot over the picture until cleared (the quick match's decision hold, ADR-024 S2). */
  hold(shot: HoldShot | null): void;
  dispose(): void;
}

export interface BroadcastOptions {
  mode: ViewMode;
  /** Transport controls (play, seek, speeds, modes); off for quick matches. */
  controls?: boolean;
  /** Programme without the introduction and replays (quick matches). */
  bare?: boolean;
  /** A sound shared with the screen (the quick match's audio session, ADR-029, ADR-022); without it the broadcast makes its own panel. */
  sound?: { readonly mixer: Mixer | null };
  /** After every drawn frame. */
  onFrame?(frame: BroadcastFrame, clock: ClockState, programme: Programme): void;
  /** Skinned players and the game camera (ADR-024 slice); the mannequin and the TV director without them. */
  model?: PlayerModel | null;
  style?: DirectorStyle;
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
  if (!options.sound) root.append(soundRoot);
  if (options.controls !== false) root.append(controlsRoot);
  const style = options.style ?? 'broadcast';
  let held: HoldShot | null = null;
  const build = (timeline: Timeline) => (options.bare ? buildProgramme(timeline, mode, () => null, { intro: false, style }) : buildProgramme(timeline, mode, undefined, { style }));
  /** The stretch playing (programme seconds). Its first frame draws its start, so a slow first frame (shader compile,
   *  scene build) cannot skip the opening (TD-037). */
  let stretch: { spans: PlaySpan[]; at: SpanState; rampSec: number; done: () => void; first: boolean } | null = null;
  const scoreBug = createScoreBug();
  score.append(scoreBug.element);
  const overlays = createOverlays();
  graphics.append(overlays.element);
  const own = options.sound ? null : createSound(soundRoot);
  const sound = options.sound ?? own!;

  let mode = options.mode;
  let programme: Programme | null = null;
  let viewer: Viewer | null = null;
  let warming: Promise<void> = Promise.resolve();
  /** False while a new viewer compiles its shaders: drawing then would compile them on the main thread anyway. */
  let warmed = true;
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
    if (programme && viewer && warmed) {
      resize();
      const before = clock.t;
      if (stretch) {
        if (!stretch.first) stretch.at = spanStep(stretch.spans, stretch.at, dt, stretch.rampSec);
        stretch.first = false;
        clock = { ...clock, t: stretch.at.t };
        const span = stretch.spans[Math.min(stretch.at.i, stretch.spans.length - 1)]!;
        // Read by the quick match's ▶▶ chip (presentation spec E3) and the e2e tests.
        document.body.dataset.ff = span.gap && stretch.at.i < stretch.spans.length ? '1' : '';
        if (sound.mixer) for (const cue of cuesBetween(programme, before, clock.t, span.speed)) sound.mixer.play(cue);
        if (stretch.at.i >= stretch.spans.length) {
          const { done } = stretch;
          stretch = null;
          done();
        }
      } else {
        clock = clockReducer(programme, clock, { type: 'tick', dt });
        const m = sound.mixer;
        if (m && clock.playing) for (const cue of cuesBetween(programme, before, clock.t, clock.speed)) m.play(cue);
      }
      const frame = broadcastFrameAt(programme, clock.t);
      viewer.render(frame, dt);
      // Read by the e2e tests and handy when debugging the director.
      const { calls, triangles } = viewer.stats();
      Object.assign(document.body.dataset, { camera: frame.camera, clip: frame.clip, point: String(frame.pointIndex), t: frame.t.toFixed(2), calls: String(calls), triangles: String(triangles) });
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
        const created = createViewer(canvas, timeline, startTier(), stepDown, { model: options.model ?? null });
        viewer = created;
        created.hold(held);
        warmed = false;
        // A failed parallel compile only means the first frame compiles them itself, as before.
        warming = created.warm().catch(() => {}).then(() => {
          if (viewer === created) warmed = true;
        });
        surface = timeline.surface;
        size = '';
        resize();
      } else viewer.setTimeline(timeline);
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
      return this.playSpans([{ from, to, speed }]);
    },
    playSpans(given, rampSec = 0) {
      if (!programme || !given.length) return Promise.resolve();
      const p = programme;
      const spans = given.map((s) => ({ ...s, from: programmeTimeFor(p, s.from), to: Math.max(programmeTimeFor(p, s.from), programmeTimeFor(p, s.to)) }));
      return new Promise<void>((done) => {
        stretch?.done();
        clock = { ...clock, playing: false, t: spans[0]!.from };
        stretch = { spans, at: { i: 0, t: spans[0]!.from, since: 0 }, rampSec, done, first: true };
        // Read by the e2e tests: the first frame of the stretch must show this time.
        document.body.dataset.clipFrom = clock.t.toFixed(2);
      });
    },
    ready: () => warming,
    hold(shot) {
      held = shot;
      viewer?.hold(shot);
    },
    dispose() {
      stretch?.done();
      stretch = null;
      document.body.dataset.ff = '';
      cancelAnimationFrame(raf);
      controls?.dispose();
      own?.dispose();
      viewer?.dispose();
      root.replaceChildren();
      document.body.classList.remove('broadcast-page');
    },
  };
}
