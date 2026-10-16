// The player model from its glb bytes (ADR-024): one skinned body (the parts merged, so one draw), the skeleton and
// the clips. A small reader for the one asset we ship rather than GLTFLoader, so tests build exactly what the page
// draws; the palette texture is decoded only in a browser (loadPlayerModel).
import {
  AnimationClip, Bone, BufferAttribute, BufferGeometry, Group, Matrix4, NearestFilter, PropertyBinding, QuaternionKeyframeTrack,
  Skeleton, SkinnedMesh, SRGBColorSpace, Texture, VectorKeyframeTrack, type KeyframeTrack,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { readGlb, type Glb, type GltfJson } from '../asset/glb.ts';

export interface PlayerModel {
  /** The skeleton's root bone's parent, with the body mesh beside it; clone it per player (SkeletonUtils.clone). */
  readonly root: Group;
  readonly clips: AnimationClip[];
  /** The palette texture, or null where images cannot be decoded (tests). */
  readonly texture: Texture | null;
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
type Typed = Float32Array | Uint8Array | Uint16Array | Uint32Array;
interface TypedClass { new (b: ArrayBuffer, o: number, n: number): Typed; readonly BYTES_PER_ELEMENT: number }
const ARRAYS: Record<number, TypedClass> = { 5126: Float32Array, 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array };

function accessor(json: GltfJson, bin: Uint8Array, index: number): { array: Typed; size: number } {
  const a = json.accessors[index]!;
  const view = json.bufferViews[a.bufferView!]!;
  const size = COMPONENTS[a.type]!;
  const Typed = ARRAYS[a.componentType]!;
  if (view.byteStride && view.byteStride !== size * Typed.BYTES_PER_ELEMENT) throw new Error('interleaved data is not supported');
  const start = bin.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  // Copy into an aligned buffer: views into the GLB need not start on the element size.
  const bytes = bin.buffer.slice(start, start + a.count * size * Typed.BYTES_PER_ELEMENT) as ArrayBuffer;
  return { array: new Typed(bytes, 0, a.count * size), size };
}

/** glTF names as three's loaders bind them: "upperarm.r" becomes "upperarmr". */
export const boneName = (name: string): string => PropertyBinding.sanitizeNodeName(name);

const ATTRIBUTES: Record<string, string> = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };

export function buildPlayerModel({ json, bin }: Glb, texture: Texture | null = null): PlayerModel {
  const skin = json.skins![0]!;
  const bones = new Map<number, Bone>();
  for (const index of skin.joints) {
    const node = json.nodes[index]!;
    const bone = new Bone();
    bone.name = boneName(node.name ?? `joint${index}`);
    if (node.translation) bone.position.fromArray(node.translation);
    if (node.rotation) bone.quaternion.fromArray(node.rotation);
    if (node.scale) bone.scale.fromArray(node.scale);
    bones.set(index, bone);
  }
  const roots: Bone[] = [];
  for (const [index, bone] of bones) {
    for (const child of json.nodes[index]!.children ?? []) {
      const b = bones.get(child);
      if (b) bone.add(b);
    }
  }
  for (const bone of bones.values()) if (!bone.parent) roots.push(bone);

  const parts = json.nodes.filter((n) => n.mesh !== undefined).flatMap((n) => json.meshes[n.mesh!]!.primitives).map((p) => {
    const g = new BufferGeometry();
    for (const [key, name] of Object.entries(ATTRIBUTES)) {
      const at = p.attributes[key];
      if (at === undefined) continue;
      const { array, size } = accessor(json, bin, at);
      g.setAttribute(name, new BufferAttribute(array, size));
    }
    g.setIndex(new BufferAttribute(accessor(json, bin, p.indices!).array, 1));
    return g;
  });
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error('player meshes do not merge');
  const inverses = accessor(json, bin, skin.inverseBindMatrices!).array;
  const boneInverses = skin.joints.map((_, i) => new Matrix4().fromArray(inverses, i * 16));
  const skeleton = new Skeleton(skin.joints.map((i) => bones.get(i)!), boneInverses);
  const body = new SkinnedMesh(geometry);
  body.name = 'body';
  const root = new Group();
  root.add(...roots, body);
  body.bind(skeleton, new Matrix4());

  const clips = json.animations.map((a) => {
    const tracks: KeyframeTrack[] = a.channels.map((c) => {
      const s = a.samplers[c.sampler]!;
      const times = accessor(json, bin, s.input).array as Float32Array;
      const values = accessor(json, bin, s.output).array as Float32Array;
      const name = boneName(json.nodes[c.target.node]!.name ?? '');
      return c.target.path === 'rotation'
        ? new QuaternionKeyframeTrack(`${name}.quaternion`, times, values)
        : new VectorKeyframeTrack(`${name}.position`, times, values);
    });
    return new AnimationClip(a.name ?? 'clip', -1, tracks);
  });
  return { root, clips, texture };
}

/** Fetch and build the model in a browser, decoding its palette texture. */
export async function loadPlayerModel(url: string): Promise<PlayerModel> {
  const glb = readGlb(new Uint8Array(await (await fetch(url)).arrayBuffer()));
  const image = glb.json.images?.[0];
  let texture: Texture | null = null;
  if (image?.bufferView !== undefined) {
    const v = glb.json.bufferViews[image.bufferView]!;
    const bytes = glb.bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: image.mimeType ?? 'image/png' }), { imageOrientation: 'none' });
    texture = new Texture(bitmap);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
  }
  return buildPlayerModel(glb, texture);
}
