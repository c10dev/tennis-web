// Style-frame prototype (docs/3d-redesign.md): toon materials, ink outlines and a seeded RNG. Not game code.
import * as THREE from 'three';

const bands = new Uint8Array([150, 205, 255].flatMap((v) => [v, v, v, 255]));
const gradient = new THREE.DataTexture(bands, 3, 1, THREE.RGBAFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const cache = new Map();
/** One toon material per colour, as renderer/src/scene/materials.ts does. */
export function toon(colour) {
  if (!cache.has(colour)) cache.set(colour, new THREE.MeshToonMaterial({ color: colour, gradientMap: gradient }));
  return cache.get(colour);
}
export const flat = (colour, extra = {}) => new THREE.MeshBasicMaterial({ color: colour, ...extra });

export const view = { height: 503, px: 2.2 };
/** Inverted hull pushed out a constant number of pixels, like renderer/src/scene/outline.ts. */
export function inkMaterial(px = view.px, colour = 0x15171e) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { px: { value: px }, h: { value: view.height }, colour: { value: new THREE.Color(colour) } },
    vertexShader: `uniform float px; uniform float h;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        float k = px * 2.0 * max(-mv.z, 0.1) / (projectionMatrix[1][1] * h);
        if (projectionMatrix[3][3] > 0.5) k = px * 2.0 / (projectionMatrix[1][1] * h);
        mv.xyz += n * k;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 colour; void main() { gl_FragColor = vec4(colour, 1.0); }',
  });
}

/** A mesh plus its outline hull (the hull is a child, so it follows every transform). */
export function inked(geometry, material, px) {
  const mesh = new THREE.Mesh(geometry, material);
  if (px !== 0) {
    const hull = new THREE.Mesh(geometry, inkMaterial(px ?? view.px));
    hull.name = 'ink';
    mesh.add(hull);
  }
  return mesh;
}

/** Mulberry32: deterministic crowds and props. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PALETTE = {
  court: 0x3470b8, surround: 0x22508f, lines: 0xf3f0e6, net: 0x161616, post: 0x1d2a44, ball: 0xd6f53a,
  skin: 0xe8b48c, skinB: 0xa8714f, shorts: 0x1d2333, shoes: 0xf6f6f2, racket: 0x26282c, strings: 0xe6e1d3,
  kitA: 0xe0473b, kitB: 0xf4f3ee, accentB: 0x1f6fd6, hair: 0x3b2a20, hairB: 0xf0c75a,
};
