// Dev replay page: simulate ?seed=&surface= with the engine, or load replay JSON, and play it with the renderer.
import { exhibitionConfig, fingerprint, simulateMatch, type MatchResult, type Surface } from '@tennis/engine';
import {
  broadcastFrameAt, buildProgramme, buildTimeline, clockReducer, createClock, createOverlays, createScoreBug, createViewer, cuesBetween, overlayAt,
  programmeTimeFor, type ClockAction, type ClockState, type Programme, type Viewer, type ViewMode,
} from '@tennis/renderer';
import { createControls } from './controls.ts';
import { createPanel } from './panel.ts';
import { createSound } from './sound.ts';
import './style.css';

interface Session { result: MatchResult; programme: Programme; viewer: Viewer; clock: ClockState }

const el = (id: string) => document.getElementById(id)!;
const canvas = el('view') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const surface: Surface = (['hard', 'clay', 'grass'] as const).find((s) => s === params.get('surface')) ?? 'hard';
const seed = Number.parseInt(params.get('seed') ?? '42', 10) >>> 0;
const MODES: ViewMode[] = ['full', 'key', 'highlights', 'result'];
let mode: ViewMode = MODES.find((m) => m === params.get('mode')) ?? 'full';

let session: Session | null = null;
const scoreBug = createScoreBug();
el('score').append(scoreBug.element);
const overlays = createOverlays();
el('graphics').append(overlays.element);
const dispatch = (action: ClockAction) => {
  if (session) session.clock = clockReducer(session.programme, session.clock, action);
};
const controls = createControls(el('controls'), dispatch, (next) => {
  mode = next;
  if (!session) return;
  // Keep the place: the new programme starts at (or just after) the match moment on screen now.
  const matchT = broadcastFrameAt(session.programme, session.clock.t).matchT;
  session.programme = buildProgramme(session.programme.timeline, mode);
  session.clock = { ...session.clock, t: programmeTimeFor(session.programme, matchT) };
  controls.setProgramme(session.programme);
});
const sound = createSound(el('sound'));
const panel = createPanel(el('panel'), { seed, surface }, (json, name) => start(json as MatchResult, name), () => session?.result ?? null);

function start(result: MatchResult, source: string): void {
  let timeline;
  try {
    timeline = buildTimeline(result);
  } catch (err) {
    panel.error((err as Error).message);
    return;
  }
  session?.viewer.dispose();
  const viewer = createViewer(canvas, timeline);
  viewer.resize(canvas.clientWidth, canvas.clientHeight);
  const programme = buildProgramme(timeline, mode);
  session = { result, programme, viewer, clock: createClock() };
  controls.setProgramme(programme);
  const [a, b] = timeline.names;
  panel.show({ title: `${a} vs ${b} · ${timeline.surface} · ${source}`, fingerprint: fingerprint(result) });
}

window.addEventListener('resize', () => session?.viewer.resize(canvas.clientWidth, canvas.clientHeight));

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  if (session) {
    const before = session.clock.t;
    session.clock = clockReducer(session.programme, session.clock, { type: 'tick', dt });
    if (sound.mixer && session.clock.playing) {
      for (const cue of cuesBetween(session.programme, before, session.clock.t, session.clock.speed)) sound.mixer.play(cue);
    }
    const frame = broadcastFrameAt(session.programme, session.clock.t);
    session.viewer.render(frame, dt);
    // Read by the e2e tests and handy when debugging the director.
    Object.assign(document.body.dataset, { camera: frame.camera, clip: frame.clip, point: String(frame.pointIndex), t: frame.t.toFixed(2) });
    scoreBug.update(frame.scoreBug);
    overlays.update(overlayAt(session.programme, frame), session.programme.timeline.names);
    controls.update(session.clock, frame);
  }
  requestAnimationFrame(loop);
}

start(simulateMatch(exhibitionConfig(surface), seed), `seed ${seed}`);
requestAnimationFrame(loop);
