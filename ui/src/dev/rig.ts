// Rig viewer (dev only, ADR-024 slice): one player of a simulated match up close, for tuning stroke keys.
//   /rig.html?seed=42&surface=hard&point=15&shot=2&dt=-0.3,-0.1,0,0.2&view=front
// Draws one frame per `dt` (seconds from that shot's contact) side by side, from `view`: front, side, back or chase.
import { exhibitionConfig, simulateMatch, type Surface } from '@tennis/engine';
import { buildTimeline, createStage, loadPlayerModel, matchFrameAt } from '@tennis/renderer';
import { PerspectiveCamera, WebGLRenderer } from 'three';

const q = new URLSearchParams(location.search);
const surface = (q.get('surface') ?? 'hard') as Surface;
const timeline = buildTimeline(simulateMatch(exhibitionConfig(surface), Number(q.get('seed') ?? 42)));
const seg = timeline.segments[Number(q.get('point') ?? 0)]!;
const shot = seg.point.shots[Number(q.get('shot') ?? 0)]!;
const dts = (q.get('dt') ?? '-0.3,-0.15,0,0.15,0.3').split(',').map(Number);
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
  stage.applyFrame(frame);
  const p = frame.players[shot.hitter];
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
