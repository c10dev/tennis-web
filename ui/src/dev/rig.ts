// Rig viewer (dev only, ADR-024 slice): one player of a simulated match up close, for tuning stroke keys.
//   /rig.html?seed=42&surface=hard&point=15&shot=2&dt=-0.3,-0.1,0,0.2&view=front
//   /rig.html?point=3&shot=4&view=tv&dt=-0.3,0,0.3   /rig.html?point=3&view=tv&t=41.5,42.5
// Draws one frame per `dt` (seconds from that shot's contact) side by side, from `view`: front, side, back, chase, or
// `tv`: the whole stage through the Main camera at a phone's stage size (`w`×`h`, default TV_STAGE, ADR-031). `t` lists
// match seconds instead of `dt` (reactions, walks between points).
// `clip=hitstop|slowmo` draws the frames as the impact moment's (racket smear, trail colour, ADR-024 TD-063).
// `hold=none,defend:1,counter:2` draws the decision hold's stances instead (TD-061): B waiting for the point after
// `point`, with that tell (card:index, or none), `ht` seconds into the hold.
import { exhibitionConfig, simulateMatch, type Card, type Surface } from '@tennis/engine';
import type { ClipKind } from '@tennis/renderer';
import { buildTimeline, createStage, heldPlayers, loadPlayerModel, matchFrameAt, tvView } from '@tennis/renderer';
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
const view = q.get('view') ?? 'front';
const tv = view === 'tv';
const at = q.get('t')?.split(',').map(Number);
const times = holds ? holds.map(() => 0) : at ?? (q.get('dt') ?? '-0.3,-0.15,0,0.15,0.3').split(',').map((dt) => seg.zero + shot.t + Number(dt));
const size = Number(q.get('size') ?? 360);
const width = tv ? Number(q.get('w') ?? 412) : size;
const height = tv ? Number(q.get('h') ?? 503) : size;
const mannequin = q.get('rig') === 'mannequin';
const model = mannequin ? null : await loadPlayerModel(`${import.meta.env.BASE_URL}models/player.glb`);
const stage = createStage(timeline, { model });
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width * times.length, height);
renderer.setScissorTest(true);
document.body.append(renderer.domElement);
const camera = new PerspectiveCamera(34, width / height, 0.1, 400);
stage.setAspect(width / height);
times.forEach((t, i) => {
  const frame = matchFrameAt(timeline, t);
  if (holds) frame.players = heldPlayers(before, holds[i]!, Number(q.get('ht') ?? 0.4));
  if (holds) frame.ball = null;
  const clip = q.get('clip') as ClipKind | null;
  stage.applyFrame(clip ? { ...frame, clip, matchT: frame.t, clipT: 0, camera: 'impact' } : frame);
  renderer.setViewport(i * width, 0, width, height);
  renderer.setScissor(i * width, 0, width, height);
  if (tv) {
    const pose = tvView(frame.ball, width / height);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    renderer.render(stage.scene, camera);
    return;
  }
  const p = frame.players[holds ? 'B' : shot.hitter];
  // Three coordinates: court (x, y) → (x, ·, −y); the player faces `facing`.
  const fx = p.facing.x;
  const fz = -p.facing.y;
  const around = { front: [fx, fz], back: [-fx, -fz], side: [fz, -fx], chase: [-fx * 0.6, -fz * 0.6] }[view] ?? [fx, fz];
  const eye = view === 'chase' ? 4.5 : 1.3;
  camera.position.set(p.pos.x + around[0]! * 5.5, eye, -p.pos.y + around[1]! * 5.5);
  camera.lookAt(p.pos.x, 1.0, -p.pos.y);
  renderer.render(stage.scene, camera);
});
document.body.dataset.ready = '1';
