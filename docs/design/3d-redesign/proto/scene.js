// Style-frame prototype: the court in real metres (as the engine and renderer have it) and three arena moods.
// Three coordinates: x across (−x is the umpire's side), y up, z = −court y (the near half is +z).
import * as THREE from 'three';
import { flat, inked, PALETTE as P, rng, toon } from './look.js';

export const COURT = { halfLength: 11.885, singlesHalf: 4.115, doublesHalf: 5.485, serviceLine: 6.4, net: 0.914, post: 1.07 };

function line(x0, z0, x1, z1, w) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), flat(P.lines));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
  m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
  return m;
}

export function court(colours = { court: P.court, surround: P.surround }) {
  const g = new THREE.Group();
  const C = COURT;
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(26, 42), toon(colours.surround));
  surround.rotation.x = -Math.PI / 2;
  const play = new THREE.Mesh(new THREE.PlaneGeometry(2 * C.doublesHalf + 0.1, 2 * C.halfLength + 0.1), toon(colours.court));
  play.rotation.x = -Math.PI / 2;
  play.position.y = 0.006;
  g.add(surround, play);
  for (const s of [-1, 1]) {
    g.add(line(-C.doublesHalf, s * C.halfLength, C.doublesHalf, s * C.halfLength, 0.09));
    g.add(line(s * C.doublesHalf, -C.halfLength, s * C.doublesHalf, C.halfLength, 0.05));
    g.add(line(s * C.singlesHalf, -C.halfLength, s * C.singlesHalf, C.halfLength, 0.05));
    g.add(line(-C.singlesHalf, s * C.serviceLine, C.singlesHalf, s * C.serviceLine, 0.05));
    g.add(line(0, s * C.halfLength, 0, s * (C.halfLength - 0.12), 0.05));
  }
  g.add(line(0, -C.serviceLine, 0, C.serviceLine, 0.05));
  // Net: a dark mesh panel, a white tape that can carry an outline, two posts.
  const span = 2 * (C.doublesHalf + 0.914);
  const netShape = new THREE.Shape();
  netShape.moveTo(-span / 2, 0);
  netShape.lineTo(span / 2, 0);
  netShape.lineTo(span / 2, C.post);
  netShape.quadraticCurveTo(0, C.net - 0.08, -span / 2, C.post);
  const net = new THREE.Mesh(new THREE.ShapeGeometry(netShape), new THREE.MeshBasicMaterial({ color: P.net, transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-span / 2, C.post, 0), new THREE.Vector3(0, C.net - 0.08, 0), new THREE.Vector3(span / 2, C.post, 0));
  const tape = inked(new THREE.TubeGeometry(curve, 24, 0.035, 6), toon(0xffffff));
  g.add(net, tape);
  for (const s of [-1, 1]) {
    const post = inked(new THREE.CylinderGeometry(0.06, 0.06, C.post, 10), toon(P.post));
    post.position.set(s * span / 2, C.post / 2, 0);
    g.add(post);
  }
  return g;
}

export function sky(top = 0x4f9de0, horizon = 0xd3e8f2) {
  const geo = new THREE.SphereGeometry(200, 24, 12);
  const colours = [];
  const pos = geo.attributes.position;
  const a = new THREE.Color(horizon);
  const b = new THREE.Color(top);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 120, 0, 1);
    const c = a.clone().lerp(b, Math.pow(t, 0.6));
    colours.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  m.name = 'sky';
  return m;
}

export function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xe4f1ff, 0x8a7556, 1.0));
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.0);
  sun.position.set(-20, 40, 15);
  scene.add(sun);
}

function umpireChair() {
  const g = new THREE.Group();
  const frame = toon(0x2f3a52);
  const legs = inked(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8), frame);
  legs.position.y = 0.95;
  const seat = inked(new THREE.CapsuleGeometry(0.35, 0.2, 4, 10), toon(0x1f6fd6));
  seat.rotation.z = Math.PI / 2;
  seat.position.y = 2.0;
  const umbrella = inked(new THREE.ConeGeometry(0.9, 0.35, 12, 1, true), toon(0xf4f3ee));
  umbrella.position.y = 3.05;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), frame);
  pole.position.y = 2.5;
  g.add(legs, seat, pole, umbrella);
  g.position.x = -7.0;
  return g;
}

function bench(x, z, colour) {
  const g = new THREE.Group();
  const seat = inked(new THREE.CapsuleGeometry(0.22, 1.4, 4, 10), toon(colour));
  seat.rotation.z = Math.PI / 2;
  seat.position.y = 0.45;
  const bag = inked(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), toon(0x15306b));
  bag.rotation.z = Math.PI / 2;
  bag.position.set(0.3, 0.78, 0);
  g.add(seat, bag);
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;
  return g;
}

/** A sunny club court: low hedges, rounded trees, a small stand on the far side, umbrellas. */
function club(g) {
  const r = rng(7);
  const hedge = toon(0x3f8a4a);
  for (const [x, z, len, rot] of [[-13, 0, 40, Math.PI / 2], [13, 0, 40, Math.PI / 2], [0, -21, 26, 0]]) {
    const h = inked(new THREE.CapsuleGeometry(0.7, len, 4, 12), hedge);
    h.rotation.z = Math.PI / 2;
    h.rotation.y = rot;
    h.position.set(x, 0.7, z);
    g.add(h);
  }
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -26 + r() * 40;
    const x = side * (15 + r() * 8);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 6), toon(0x7a5235));
    trunk.position.y = 1.1;
    const crown = inked(new THREE.SphereGeometry(1.6 + r() * 1.2, 14, 10), toon(r() > 0.5 ? 0x4d9c52 : 0x5aa95a));
    crown.position.y = 3.2 + r();
    tree.add(trunk, crown);
    tree.position.set(x, 0, z);
    g.add(tree);
  }
  // A small three-row stand behind the far baseline, with a few spectators.
  for (let k = 0; k < 3; k++) {
    const row = inked(new THREE.BoxGeometry(18, 0.45, 1.1), toon(0x5664b0), 0);
    row.position.set(0, 0.25 + k * 0.45, -22.5 - k * 1.1);
    g.add(row);
    for (let i = 0; i < 16; i++) {
      if (r() < 0.35) continue;
      const fan = inked(new THREE.CapsuleGeometry(0.22, 0.25, 4, 8), toon([0xe0473b, 0xf4f3ee, 0xf2c94c, 0x1f6fd6, 0x3fd3b0][Math.floor(r() * 5)]));
      fan.position.set(-8.4 + i * 1.12, 0.95 + k * 0.45, -22.5 - k * 1.1);
      g.add(fan);
    }
  }
  g.add(umpireChair(), bench(-7.5, 3, 0xf4f3ee), bench(-7.5, -3, 0xf4f3ee));
  return g;
}

/** A stadium bowl: steep tiers round all four sides, an instanced crowd, a ribbon of boards. */
function stadium(g) {
  const r = rng(11);
  const tierColour = toon(0x3a3f78);
  const crowdColours = [0xe0473b, 0xf4f3ee, 0xf2c94c, 0x1f6fd6, 0x3fd3b0, 0xff7a45, 0x2b2f55];
  const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.22, 3, 6), toon(0xffffff), 4000);
  let n = 0;
  const m = new THREE.Matrix4();
  const place = (x, y, z) => {
    if (n >= 4000 || r() < 0.12) return;
    m.makeTranslation(x + (r() - 0.5) * 0.2, y + 0.45, z);
    people.setMatrixAt(n, m);
    people.setColorAt(n, new THREE.Color(crowdColours[Math.floor(r() * crowdColours.length)]));
    n++;
  };
  for (let k = 0; k < 12; k++) {
    const y = 1.2 + k * 0.9;
    const dz = 22 + k * 1.2;
    const dx = 14 + k * 1.2;
    const north = new THREE.Mesh(new THREE.BoxGeometry(2 * dx, 0.9, 1.2), tierColour);
    north.position.set(0, y - 0.45, -dz);
    const east = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2 * dz), tierColour);
    east.position.set(dx, y - 0.45, 0);
    const west = east.clone();
    west.position.x = -dx;
    const south = north.clone();
    south.position.z = dz;
    g.add(north, east, west, south);
    for (let x = -dx + 0.6; x < dx; x += 0.75) { place(x, y, -dz); place(x, y, dz); }
    for (let z = -dz + 0.6; z < dz; z += 0.75) { place(dx, y, z); place(-dx, y, z); }
  }
  people.count = n;
  g.add(people);
  const boards = [[0, -21, 26, 0.12], [-13, 0, 0.12, 42], [13, 0, 0.12, 42]];
  boards.forEach(([x, z, w, d], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), toon(i === 0 ? 0xf2c94c : 0x15306b));
    b.position.set(x, 0.5, z);
    g.add(b);
  });
  // Roof rim.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(34, 1.2, 6, 48), toon(0xdfe4ee));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(0.75, 1.15, 1);
  rim.position.y = 13;
  g.add(rim, umpireChair());
  return g;
}

/** A toy diorama: the court on a floating plinth against sky and clouds, a handful of props. */
function diorama(g) {
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 42), toon(0x2a6d3e));
  plinth.position.y = -1.52;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(25.6, 2.5, 41.6), toon(0x8a5a3c));
  soil.position.y = -3.6;
  g.add(plinth, soil);
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2 + r() * 2, 14, 10), toon(0xffffff));
      puff.position.set(j * 2.6, r() * 1.5, r());
      cloud.add(puff);
    }
    const a = (i / 9) * Math.PI * 2;
    cloud.position.set(Math.cos(a) * 60, -6 + r() * 14, Math.sin(a) * 60 - 10);
    g.add(cloud);
  }
  g.add(umpireChair(), bench(-7.5, 3, 0xff7a45), bench(-7.5, -3, 0x3fd3b0));
  for (const [x, z] of [[11, -19], [-11, -19], [11, 19], [-11, 19]]) {
    const pot = new THREE.Group();
    const tub = inked(new THREE.CylinderGeometry(0.6, 0.45, 0.8, 12), toon(0xf4f3ee));
    tub.position.y = 0.4;
    const bush = inked(new THREE.SphereGeometry(0.9, 14, 10), toon(0x4d9c52));
    bush.position.y = 1.3;
    pot.add(tub, bush);
    pot.position.set(x, 0, z);
    g.add(pot);
  }
  return g;
}

export const ARENAS = {
  club: { build: club, sky: [0x4f9de0, 0xd3e8f2], fog: [60, 200] },
  stadium: { build: stadium, sky: [0x3f7fd0, 0xcfe0f0], fog: [80, 220] },
  diorama: { build: diorama, sky: [0x7cc4f2, 0xfde9c9], fog: [90, 260] },
};

export function arena(scene, name) {
  const A = ARENAS[name];
  scene.add(sky(...A.sky));
  scene.fog = new THREE.Fog(A.sky[1], ...A.fog);
  scene.background = new THREE.Color(A.sky[1]);
  const g = new THREE.Group();
  A.build(g);
  scene.add(g);
}
