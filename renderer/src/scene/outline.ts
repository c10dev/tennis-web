// Ink outlines by inverted hull (ADR-019): a back-face copy of a part, pushed out along smooth normals by a width
// that stays about LOOK.outline.px on screen at any distance. No post-processing pass, one extra draw per part.
import { BackSide, Color, Mesh, ShaderMaterial, type BufferGeometry, type Object3D } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOOK } from '../tuning/index.ts';

const VERTEX = /* glsl */ `
uniform float px;
uniform float referenceHeight;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // projectionMatrix[1][1] is 1 / tan(fov / 2): the same formula as outlineWidth().
  float width = px * 2.0 * -mv.z / (projectionMatrix[1][1] * referenceHeight);
  mv.xyz += normalize(normalMatrix * normal) * width;
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 colour;
void main() {
  gl_FragColor = vec4(colour, 1.0);
}`;

/** Metres the hull is pushed out at view depth `depth` with projection term `yy` (1 / tan(fov / 2)). */
export function outlineWidth(depth: number, yy: number): number {
  const { px, referenceHeight } = LOOK.outline;
  return (px * 2 * depth) / (yy * referenceHeight);
}

let material: ShaderMaterial | null = null;

function inkMaterial(): ShaderMaterial {
  material ??= new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      colour: { value: new Color(LOOK.outline.colour) },
      px: { value: LOOK.outline.px },
      referenceHeight: { value: LOOK.outline.referenceHeight },
    },
    side: BackSide,
  });
  return material;
}

const hulls = new WeakMap<BufferGeometry, BufferGeometry>();

/** The part's shape with seams welded and normals smoothed, so pushing out along them leaves no cracks. */
function hullGeometry(source: BufferGeometry): BufferGeometry {
  let hull = hulls.get(source);
  if (!hull) {
    const bare = source.clone();
    for (const name of Object.keys(bare.attributes)) if (name !== 'position') bare.deleteAttribute(name);
    hull = mergeVertices(bare, 1e-4);
    hull.computeVertexNormals();
    hulls.set(source, hull);
  }
  return hull;
}

/** Give `part` an ink outline that moves with it; returns the hull. */
export function addOutline(part: Mesh): Mesh {
  const hull = new Mesh(hullGeometry(part.geometry), inkMaterial());
  hull.name = `${part.name || 'part'}-outline`;
  hull.userData.outline = true;
  part.add(hull);
  return hull;
}

export const isOutline = (o: Object3D): boolean => o.userData.outline === true;
