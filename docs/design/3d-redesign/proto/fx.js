// Style-frame prototype: the optic ball, its trail, and the impact language (squash, star, smear, speed lines).
import * as THREE from 'three';
import { inked, inkMaterial, PALETTE as P } from './look.js';

export function ball(at, { radius = 0.11, squash = 0 } = {}) {
  const m = inked(new THREE.SphereGeometry(radius, 18, 12), new THREE.MeshBasicMaterial({ color: P.ball, fog: false }));
  m.position.copy(at);
  if (squash) m.scale.set(1 + squash, 1 - squash * 0.8, 1 + squash);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.1, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(at.x, 0.015, at.z);
  const g = new THREE.Group();
  g.add(m, shadow);
  return g;
}

/** A white ribbon along `points` (oldest first), tapering to nothing at the tail. */
export function trail(points, width = 0.14, colour = 0xffffff) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 40, width, 6);
  const pos = geo.attributes.position;
  const centre = new THREE.Vector3();
  // Taper by pulling each ring towards the curve at its share along.
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 7);
    const u = ring / 40;
    curve.getPointAt(Math.min(1, u), centre);
    const p = new THREE.Vector3().fromBufferAttribute(pos, i).sub(centre).multiplyScalar(Math.pow(u, 1.4)).add(centre);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, fog: false }));
}

/** A comic impact star facing `camera`, with an ink rim. */
export function impactStar(at, camera, size = 0.55, colour = 0xffffff) {
  const s = new THREE.Shape();
  const n = 9;
  for (let i = 0; i <= 2 * n; i++) {
    const a = (i / (2 * n)) * Math.PI * 2;
    const r = i % 2 ? size * 0.45 : size * (0.85 + 0.3 * ((i * 37) % 5) / 5);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const g = new THREE.Group();
  const geo = new THREE.ShapeGeometry(s);
  const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x15171e, fog: false }));
  rim.scale.setScalar(1.12);
  rim.position.z = -0.01;
  const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colour, fog: false }));
  const core = new THREE.Mesh(new THREE.CircleGeometry(size * 0.3, 16), new THREE.MeshBasicMaterial({ color: P.ball, fog: false }));
  core.position.z = 0.01;
  g.add(rim, face, core);
  g.position.copy(at);
  g.lookAt(camera.position);
  return g;
}

/** Speed lines: thin ink wedges radiating from `at`, in the camera's plane. */
export function speedLines(at, camera, inner = 0.8, outer = 2.4, count = 14) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x15171e, transparent: true, opacity: 0.55, fog: false, side: THREE.DoubleSide });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.07;
    const r0 = inner * (1 + (i % 4) * 0.12);
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    shape.lineTo(Math.cos(a + 0.025) * outer, Math.sin(a + 0.025) * outer);
    shape.lineTo(Math.cos(a - 0.025) * outer, Math.sin(a - 0.025) * outer);
    g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mat));
  }
  g.position.copy(at);
  g.lookAt(camera.position);
  return g;
}

/** A swing smear: a translucent fan from angle a0 to a1 about `pivot`, radius r0–r1, tilted by `tilt` (radians). */
export function smear(pivot, r0, r1, a0, a1, tilt = 0, yaw = 0) {
  const geo = new THREE.RingGeometry(r0, r1, 32, 1, a0, a1 - a0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.set(-Math.PI / 2 + tilt, 0, 0);
  const g = new THREE.Group();
  g.add(m);
  const edge = new THREE.Mesh(new THREE.RingGeometry(r1 - 0.025, r1 + 0.025, 32, 1, a0, a1 - a0), inkMaterial(0).clone());
  edge.material = new THREE.MeshBasicMaterial({ color: 0x15171e, transparent: true, opacity: 0.6, side: THREE.DoubleSide, fog: false });
  edge.rotation.copy(m.rotation);
  g.add(edge);
  g.position.copy(pivot);
  g.rotation.y = yaw;
  return g;
}

/** A marker ring and a dashed band for engine heights (contact bands, the net) in the lineup frames. */
export function band(y0, y1, x0, x1, colour, opacity = 0.18) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.6);
  return m;
}
