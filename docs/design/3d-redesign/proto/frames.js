// Style frames for docs/3d-redesign.md. `?frame=<id>` renders one still at the phone stage size (412×503, the
// Pixel 7's 60dvh stage) with today's overlays masked in, so every option is judged on what the player sees.
import * as THREE from 'three';
import { figure, STYLES } from './figure.js';
import { ball, band, impactStar, smear, speedLines, trail } from './fx.js';
import { PALETTE as P, view } from './look.js';
import { arena, court, COURT, lights } from './scene.js';

const STAGE = { w: 412, h: 503 };
const KIT_A = { shirt: P.kitA, trim: 0x1d2333, hat: 'cap', hair: P.hair, skin: P.skin };
const KIT_B = { shirt: P.kitB, trim: P.accentB, hat: 'band', hair: P.hairB, skin: P.skinB };
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const ME = { x: 1.7, z: 12.2 };
const THEM = { x: -1.4, z: -12.1 };

/** Places a posed figure facing `yaw` (0 = towards +z, π = towards the far end); returns world points. */
function place(scene, style, pose, kit, x, z, yaw) {
  const f = figure(style, pose, kit);
  f.group.position.set(x, 0, z);
  f.group.rotation.y = yaw;
  scene.add(f.group);
  f.group.updateMatrixWorld(true);
  const w = (p) => p.clone().applyMatrix4(f.group.matrixWorld);
  return { ...f, racketWorld: w(f.racketCentre), gripWorld: w(f.grip) };
}

/** A 2.5D option: the figure pre-rendered flat (as a sprite sheet cell would be) and stood up as a billboard. */
function sprite(renderer, scene, style, pose, kit, x, z, viewYaw) {
  const cell = new THREE.Scene();
  cell.add(new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 2.6));
  const f = figure(style, pose, kit);
  f.group.rotation.y = viewYaw;
  f.group.children.filter((c) => c.geometry?.type === 'CircleGeometry').forEach((c) => (c.visible = false));
  cell.add(f.group);
  const size = 2.6;
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size, 0, -10, 10);
  cam.position.set(0, 0, 5);
  const target = new THREE.WebGLRenderTarget(256, 256);
  const saved = view.px;
  view.px = 3;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(cell, cam);
  renderer.setRenderTarget(null);
  view.px = saved;
  target.texture.magFilter = THREE.NearestFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: target.texture, transparent: true, alphaTest: 0.5 }));
  s.center.set(0.5, 0);
  s.scale.set(size, size, 1);
  s.position.set(x, 0, z);
  scene.add(s);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, 0.01, z);
  scene.add(shadow);
}

function camera(pos, target, fov, aspect) {
  const c = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
  c.position.copy(pos);
  c.lookAt(target);
  return c;
}

/** The rally moment every camera and arena frame shares: my forehand is coming, the opponent recovers. */
function rally(ctx, { style = 'pop', arenaName = 'club', asSprite = false } = {}) {
  const { scene } = ctx;
  arena(scene, arenaName);
  scene.add(court());
  if (asSprite) {
    sprite(ctx.renderer, scene, style, 'backswing', KIT_A, ME.x, ME.z, Math.PI);
    sprite(ctx.renderer, scene, style, 'recover', KIT_B, THEM.x, THEM.z, 0);
  } else {
    place(scene, style, 'backswing', KIT_A, ME.x, ME.z, Math.PI + 0.15);
    place(scene, style, 'recover', KIT_B, THEM.x, THEM.z, 0.1);
  }
  const at = v(1.3, 1.35, 5.2);
  scene.add(ball(at), trail([v(-1.0, 1.0, -11.2), v(-0.3, 2.7, -4.5), v(0.6, 2.2, 1.0), at]));
}

const CHASE = { pos: v(0.8, 6.2, 19.6), target: v(0.3, 0, 1.4), fov: 48 };
const chase = (aspect) => camera(CHASE.pos, CHASE.target, CHASE.fov, aspect);

export const FRAMES = {
  'cam-broadcast': {
    title: 'K1 · Broadcast portrait (today)', note: 'Today’s pose: 22 m up, 23 m back, 27° across. New proxies, same framing.',
    build(ctx) {
      rally(ctx);
      const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(13.5)) / ctx.aspect));
      return camera(v(0.5, 22, COURT.halfLength + 23), v(1.2, 0, 5.5), vfov, ctx.aspect);
    },
  },
  'cam-chase': {
    title: 'K2 · Chase (recommended)', note: '6.2 m up, 7.7 m behind my baseline, 48° vertical. My player big, the far court whole.',
    build(ctx) { rally(ctx); return chase(ctx.aspect); },
  },
  'cam-low': {
    title: 'K3 · Low over the shoulder', note: '2.6 m up, 4.4 m behind, 50° vertical. Dramatic, but the far court flattens.',
    build(ctx) { rally(ctx); return camera(v(1.5, 2.6, 16.6), v(0.2, 1.0, -2.5), 50, ctx.aspect); },
  },
  'chase-sport': {
    title: 'C2 · Sport proportions in K2', note: '5.5 heads. Reads as an athlete; the face is lost at this distance.',
    build(ctx) { rally(ctx, { style: 'sport' }); return chase(ctx.aspect); },
  },
  'chase-sprite': {
    title: 'C3 · 2.5D sprite in K2', note: 'Pre-rendered flat cells on billboards: crisp, but turns and depth break.',
    build(ctx) { rally(ctx, { asSprite: true }); return chase(ctx.aspect); },
  },
  'arena-stadium': {
    title: 'A2 · Stadium bowl', note: 'Steep tiers, instanced crowd (one draw). Big-match feel, busier frame.',
    build(ctx) { rally(ctx, { arenaName: 'stadium' }); return chase(ctx.aspect); },
  },
  'arena-diorama': {
    title: 'A3 · Toy diorama', note: 'The court on a floating plinth, sky and clouds. Fewest draws, calmest frame.',
    build(ctx) { rally(ctx, { arenaName: 'diorama' }); return chase(ctx.aspect); },
  },
  'hold-shoulder': {
    title: 'M1 · Decision hold: over the shoulder', note: 'Held while the cards are up: me in the corner, the opponent centred.',
    build(ctx) {
      const { scene } = ctx;
      arena(scene, 'club');
      scene.add(court());
      place(scene, 'pop', 'ready', KIT_A, 0.6, 12.3, Math.PI);
      place(scene, 'pop', 'ready', KIT_B, -2.6, -12.4, 0.2);
      scene.add(ball(v(0.95, 1.0, 12.0), { radius: 0.09 }));
      return camera(v(-0.4, 2.6, 17.5), v(-0.6, 0.9, 0), 42, ctx.aspect);
    },
  },
  'hold-tell': {
    title: 'M2 · Decision hold: the tell', note: 'The opponent’s body shows the tell the panel names (deep, knees bent).',
    chips: [['TELL', 'deep stance', 'tl']],
    build(ctx) {
      const { scene } = ctx;
      arena(scene, 'club');
      scene.add(court());
      place(scene, 'pop', 'backswing', KIT_B, -2.0, -12.9, 0.5);
      place(scene, 'pop', 'ready', KIT_A, 0.6, 12.3, Math.PI);
      return camera(v(-0.2, 1.5, -6.6), v(-2.0, 0.95, -12.9), 34, ctx.aspect);
    },
  },
  impact: {
    title: 'M3 · Impact close-up, slow-mo', note: 'Big point only: hit-stop, squash, star, smear, speed lines.',
    chips: [['SLOW-MO', '0.25×', 'tl']], letterbox: true,
    build(ctx) {
      const { scene } = ctx;
      arena(scene, 'club');
      scene.add(court());
      const me = place(scene, 'pop', 'contact', KIT_A, ME.x, ME.z, Math.PI + 0.15);
      const cam = camera(v(-0.6, 1.3, 8.2), me.racketWorld.clone().add(v(-0.7, 0.1, 0.4)), 42, ctx.aspect);
      scene.add(ball(me.racketWorld.clone().add(v(0.05, 0, -0.12)), { squash: 0.35 }));
      scene.add(speedLines(me.racketWorld, cam, 0.5, 2.6));
      scene.add(impactStar(me.racketWorld.clone().add(v(0.08, 0.02, -0.15)), cam, 0.26));
      scene.add(smear(me.gripWorld.clone().setY(me.racketWorld.y - 0.05), 0.35, 0.95, -1.5, 0.15, 0.08));
      return cam;
    },
  },
  replay: {
    title: 'M4 · Replay: broadcast side camera', note: 'The TV cameras survive for replays only, raised clear of the chair.',
    chips: [['REPLAY', '½ speed', 'tl']], letterbox: true,
    build(ctx) {
      const { scene } = ctx;
      arena(scene, 'club');
      scene.add(court());
      const me = place(scene, 'pop', 'follow', KIT_A, ME.x, ME.z, Math.PI + 0.15);
      place(scene, 'pop', 'unitTurn', KIT_B, -2.4, -11.6, 0.4);
      const at = v(0.6, 1.7, 7.2);
      scene.add(ball(at), trail([me.racketWorld, v(1.3, 1.6, 10), at]));
      return camera(v(-13, 4.2, 9.0), v(1.0, 0.9, 9.0), 40, ctx.aspect);
    },
  },
  celebrate: {
    title: 'M5 · Reaction close-up', note: 'After a winner or a big point: a face that can react.',
    build(ctx) {
      const { scene } = ctx;
      arena(scene, 'club');
      scene.add(court());
      place(scene, 'pop', 'cheer', KIT_A, ME.x, ME.z, Math.PI + 0.75);
      place(scene, 'pop', 'slump', KIT_B, THEM.x, THEM.z, 0);
      return camera(v(0.2, 1.4, 8.3), v(1.75, 1.3, 12.2), 34, ctx.aspect);
    },
  },
  lineup: {
    size: [824, 503], title: 'Proportions against engine heights', note: 'Bands: rally contact 0.64–1.36 m (blue), net 0.914 m, serve contact 2.60–2.95 m (orange).',
    masks: false,
    build(ctx) { return lineup(ctx, 'ready'); },
  },
  'lineup-serve': {
    size: [824, 503], title: 'Serve contact reach', note: '', masks: false,
    build(ctx) { return lineup(ctx, 'serveContact'); },
  },
  'motion-forehand': {
    size: [1236, 503], title: 'Forehand key poses (C1 proxy)', note: 'Clip keys give the shape; the A1 IK pulls the racket onto shot.from in the window around contact.', masks: false,
    build(ctx) {
      return strip(ctx, [['ready', 'Ready', 'clip'], ['unitTurn', 'Unit turn', 'clip'], ['backswing', 'Backswing', 'clip'], ['contact', 'Impact', 'clip + IK'], ['follow', 'Follow-through', 'clip'], ['recover', 'Recovery step', 'clip + root']]);
    },
  },
  'motion-serve': {
    size: [1236, 503], title: 'Serve and reactions (C1 proxy)', note: 'Serve keys with the hop; reactions are clips picked by point outcome and tag.', masks: false,
    build(ctx) {
      ctx.yaw = -0.9;
      return strip(ctx, [['ready', 'Ready (hold)', 'clip'], ['trophy', 'Trophy', 'clip'], ['serveContact', 'Serve impact', 'clip + IK + hop'], ['follow', 'Finish', 'clip'], ['cheer', 'Winner', 'clip'], ['slump', 'Error', 'clip']]);
    },
  },
};

function plainStudio(scene) {
  scene.background = new THREE.Color(0xeef0f4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ color: 0xdfe3ea }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
}

function lineup(ctx, pose) {
  const { scene } = ctx;
  plainStudio(scene);
  const xs = [-1.7, 1.7];
  const out = [];
  ['pop', 'sport'].forEach((style, i) => {
    const f = place(scene, style, pose, i ? KIT_B : KIT_A, xs[i], 0, -0.35);
    out.push([style, f]);
  });
  scene.add(band(0.64, 1.36, -4, 4, 0x1f6fd6), band(2.6, 2.95, -4, 4, 0xff7a45, 0.25), band(0.904, 0.924, -4, 4, 0x15171e, 0.7));
  ctx.labels = out.map(([style, f], i) => ({
    x: xs[i], y: -0.15, text: `${style === 'pop' ? 'C1 Pop' : 'C2 Sport'} · ${STYLES[style].heads} heads · ${f.headTop.toFixed(2)} m`
      + (pose === 'serveContact' ? ` · racket top ${f.racketTop.toFixed(2)} m` : ''),
  }));
  if (pose === 'serveContact') ctx.note = 'Racket-head top at serve contact with each style’s hop (C1 0.32 m, C2 0.12 m) against the 2.60–2.95 m band.';
  return camera(v(0, 1.45, 10.5), v(0, 1.45, 0), 21, ctx.aspect);
}

function strip(ctx, poses) {
  const { scene } = ctx;
  plainStudio(scene);
  const gap = 1.62;
  ctx.labels = [];
  // Impacts reach out to the player's right (screen left): leave room before them.
  const xs = [];
  poses.forEach(([pose], i) => xs.push((xs[i - 1] ?? 0) + (i ? gap : 0) + (/ontact/.test(pose) ? 0.6 : 0)));
  const mid = (xs[0] + xs.at(-1)) / 2;
  poses.forEach(([pose, name, source], i) => {
    const x = xs[i] - mid;
    const f = place(scene, 'pop', pose, KIT_A, x, 0, ctx.yaw ?? -0.55);
    if (pose === 'contact' || pose === 'serveContact') {
      scene.add(ball(f.racketWorld.clone().add(v(0, 0, 0.12)), { radius: 0.09 }));
      scene.add(impactStar(f.racketWorld.clone().add(v(0, 0, 0.15)), { position: v(0, 1.4, 20) }, 0.3));
    }
    ctx.labels.push({ x, y: -0.12, text: name, sub: source });
  });
  const half = (4.05 * ctx.aspect) / 2;
  const cam = new THREE.OrthographicCamera(-half, half, 3.15, -0.9, -50, 50);
  cam.position.set(0, 0, 20);
  cam.lookAt(0, 0, 0);
  return cam;
}

export { STAGE };
export function render(id, canvas, renderer) {
  const def = FRAMES[id];
  const [w, h] = def.size ?? [STAGE.w, STAGE.h];
  view.height = h;
  const scene = new THREE.Scene();
  lights(scene);
  const ctx = { scene, renderer, aspect: w / h, note: def.note };
  renderer.setSize(w, h);
  const cam = def.build(ctx);
  renderer.setClearColor(0xffffff, 1);
  renderer.render(scene, cam);
  return { def, ctx, cam, w, h };
}
