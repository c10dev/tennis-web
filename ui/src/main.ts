// Dev replay page: simulate ?seed=&surface= with the engine, or load replay JSON, and play it with the renderer.
import { exhibitionConfig, fingerprint, simulateMatch, type MatchResult, type Surface } from '@tennis/engine';
import {
  buildTimeline, clockReducer, createClock, createScoreBug, createViewer, matchFrameAt, type ClockAction, type ClockState, type Timeline,
  type Viewer,
} from '@tennis/renderer';
import { createControls } from './controls.ts';
import { createPanel } from './panel.ts';
import './style.css';

interface Session { result: MatchResult; timeline: Timeline; viewer: Viewer; clock: ClockState }

const el = (id: string) => document.getElementById(id)!;
const canvas = el('view') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const surface: Surface = (['hard', 'clay', 'grass'] as const).find((s) => s === params.get('surface')) ?? 'hard';
const seed = Number.parseInt(params.get('seed') ?? '42', 10) >>> 0;

let session: Session | null = null;
const scoreBug = createScoreBug();
el('score').append(scoreBug.element);
const dispatch = (action: ClockAction) => {
  if (session) session.clock = clockReducer(session.timeline, session.clock, action);
};
const controls = createControls(el('controls'), dispatch);
const panel = createPanel(el('panel'), { seed, surface }, (json, name) => start(json as MatchResult, name), () => session?.result ?? null);

function start(result: MatchResult, source: string): void {
  let timeline: Timeline;
  try {
    timeline = buildTimeline(result);
  } catch (err) {
    panel.error((err as Error).message);
    return;
  }
  session?.viewer.dispose();
  const viewer = createViewer(canvas, timeline);
  viewer.resize(canvas.clientWidth, canvas.clientHeight);
  session = { result, timeline, viewer, clock: createClock() };
  controls.setTimeline(timeline);
  const [a, b] = timeline.names;
  panel.show({ title: `${a} vs ${b} · ${timeline.surface} · ${source}`, fingerprint: fingerprint(result) });
}

window.addEventListener('resize', () => session?.viewer.resize(canvas.clientWidth, canvas.clientHeight));

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  if (session) {
    session.clock = clockReducer(session.timeline, session.clock, { type: 'tick', dt });
    const frame = matchFrameAt(session.timeline, session.clock.t);
    session.viewer.render(frame, dt);
    scoreBug.update(frame.scoreBug);
    controls.update(session.clock, frame);
  }
  requestAnimationFrame(loop);
}

start(simulateMatch(exhibitionConfig(surface), seed), `seed ${seed}`);
requestAnimationFrame(loop);
