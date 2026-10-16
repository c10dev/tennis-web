// Rig viewer (dev only, ADR-024 slice): one player of a simulated match up close, for tuning stroke keys.
//   /rig.html?seed=42&surface=hard&point=15&shot=2&dt=-0.3,-0.1,0,0.2&view=front
// Draws one frame per `dt` (seconds from that shot's contact) side by side, from `view`: front, side, back or chase.
// `clip=hitstop|slowmo` draws the frames as the impact moment's (racket smear, trail colour, ADR-024 TD-063).
// `hold=none,defend:1,counter:2` draws the decision hold's stances instead (TD-061): B waiting for the point after
// `point`, with that tell (card:index, or none), `ht` seconds into the hold.
import { exhibitionConfig, simulateMatch, type Card, type Surface } from '@tennis/engine';
import type { ClipKind } from '@tennis/renderer';
import { buildTimeline, createStage, heldPlayers, loadPlayerModel, matchFrameAt } from '@tennis/renderer';
import { PerspectiveCamera, WebGLRenderer } from 'three';

const q = new URLSearchParams(location.search);
const surface = (q.get('surface') ?? 'hard') as Surface;
const result = simulateMatch(exhibitionConfig(surface), Number(q.get('seed') ?? 42));
const pointAt = Number(q.get('point') ?? 0);
const timeline = buildTimeline(result);
const seg = timeline.segments[pointAt]!;
// The match as it stood after `point`, for the hold (the next point not played yet).
const cut = result.events.findIndex((e) => e.type === 'point' && e.index > seg.point.index);
const before = buildTimeline({ ...result, events: cut < 0 ? result.events : result.events.slice(0, cut) });
const shot = seg.point.shots[Number(q.get('shot') ?? 0)]!;
const holds = q.get('hold')?.split(',').map((h) => (h === 'none' ? null : { player: 'B' as const, card: h.split(':')[0] as Card, index: Number(h.split(':')[1]) }));
const dts = holds ? holds.map(() => 0) : (q.get('dt') ?? '-0.3,-0.15,0,0.15,0.3').split(',').map(Number);
const view = q.get('view') ?? 'front';
const size = Number(q.get('size') ?? 360);
const mannequin = q.get('rig') === 'mannequin';
const model = mannequin ? null : await loadPlayerModel(`${import.meta.env.BASE_URL}models/player.glb`);
const stage = createStage(timeline, { model });
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(size * dts.length, size);
renderer.setScissorTest(true);
document.body.append(renderer.domElement);
const camera = new PerspectiveCamera(34, 1, 0.1, 400);
dts.forEach((dt, i) => {
  const frame = matchFrameAt(timeline, seg.zero + shot.t + dt);
  if (holds) frame.players = heldPlayers(before, holds[i]!, Number(q.get('ht') ?? 0.4));
  if (holds) frame.ball = null;
  const clip = q.get('clip') as ClipKind | null;
  stage.applyFrame(clip ? { ...frame, clip, matchT: frame.t, clipT: 0, camera: 'impact' } : frame);
  const p = frame.players[holds ? 'B' : shot.hitter];
  // Three coordinates: court (x, y) → (x, ·, −y); the player faces `facing`.
  const fx = p.facing.x;
  const fz = -p.facing.y;
  const around = { front: [fx, fz], back: [-fx, -fz], side: [fz, -fx], chase: [-fx * 0.6, -fz * 0.6] }[view] ?? [fx, fz];
  const height = view === 'chase' ? 4.5 : 1.3;
  camera.position.set(p.pos.x + around[0]! * 5.5, height, -p.pos.y + around[1]! * 5.5);
  camera.lookAt(p.pos.x, 1.0, -p.pos.y);
  renderer.setViewport(i * size, 0, size, size);
  renderer.setScissor(i * size, 0, size, size);
  renderer.render(stage.scene, camera);
});
document.body.dataset.ready = '1';
