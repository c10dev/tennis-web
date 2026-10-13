// The ball's trail: one camera-facing ribbon, tapering and fading to its tail. The CPU lays the centre line and
// per-sample width and opacity; the vertex shader turns each pair of vertices to face the camera (ADR-019).
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial } from 'three';
import { BALL_LOOK } from '../tuning/index.ts';
import type { TrailPoint } from './ballMotion.ts';
import { trailStyle } from './ballMotion.ts';
import { toThree } from './coords.ts';

const VERTEX = /* glsl */ `
attribute vec3 dir;
attribute float side;
attribute float width;
attribute float alpha;
varying float vAlpha;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 toEye = normalize(cameraPosition - world.xyz);
  vec3 across = cross(normalize((modelMatrix * vec4(dir, 0.0)).xyz), toEye);
  float len = length(across);
  world.xyz += (len > 1e-4 ? across / len : vec3(0.0)) * side * width * 0.5;
  vAlpha = alpha;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 colour;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(colour, vAlpha);
}`;

export interface TrailView {
  readonly object3d: Mesh;
  /** Lay the ribbon along the samples, newest first, tapering over `sec`; `scale` follows the ball's camera scale. */
  apply(points: readonly TrailPoint[], scale: number, sec: number): void;
}

export function createTrail(): TrailView {
  const n = BALL_LOOK.trail.samples;
  const geometry = new BufferGeometry();
  const attr = (name: string, size: number) => {
    const a = new BufferAttribute(new Float32Array(2 * n * size), size);
    geometry.setAttribute(name, a);
    return a;
  };
  const position = attr('position', 3);
  const dir = attr('dir', 3);
  const side = attr('side', 1);
  const width = attr('width', 1);
  const alpha = attr('alpha', 1);
  for (let i = 0; i < n; i++) side.setX(2 * i, 1).setX(2 * i + 1, -1);
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geometry.setIndex(index);
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { colour: { value: new Color(BALL_LOOK.trail.colour) } },
    transparent: true,
    depthWrite: false,
    // Which way the strip winds depends on the camera side; never cull it.
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'ball-trail';
  // Its bounds change every frame and it is always near the ball, which the cameras follow.
  mesh.frustumCulled = false;
  mesh.visible = false;
  return {
    object3d: mesh,
    apply(points, scale, sec) {
      const m = Math.min(points.length, n);
      mesh.visible = m >= 2;
      if (!mesh.visible) return;
      const centres = points.slice(0, m).map((p) => toThree(p.pos));
      for (let i = 0; i < m; i++) {
        const a = centres[Math.max(0, i - 1)]!;
        const b = centres[Math.min(m - 1, i + 1)]!;
        const style = trailStyle(points[i]!.age, sec);
        for (const k of [2 * i, 2 * i + 1]) {
          position.setXYZ(k, centres[i]!.x, centres[i]!.y + BALL_LOOK.radius * scale, centres[i]!.z);
          dir.setXYZ(k, b.x - a.x, b.y - a.y, b.z - a.z);
          width.setX(k, style.width * scale);
          alpha.setX(k, style.alpha);
        }
      }
      for (const a of [position, dir, width, alpha]) a.needsUpdate = true;
      geometry.setDrawRange(0, (m - 1) * 6);
    },
  };
}
