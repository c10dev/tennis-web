// Binary glTF (GLB) read, write and prune, with no dependency (ADR-024): enough to cut a CC0 character pack down to
// the body, bones and clips the game uses. Works on bytes, so tests and the prune script share it.

export interface GltfAccessor { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[]; normalized?: boolean; sparse?: unknown }
export interface GltfBufferView { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number }
export interface GltfPrimitive { attributes: Record<string, number>; indices?: number; material?: number; mode?: number; targets?: Record<string, number>[] }
export interface GltfMesh { name?: string; primitives: GltfPrimitive[] }
export interface GltfNode { name?: string; mesh?: number; skin?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
export interface GltfChannel { sampler: number; target: { node: number; path: string } }
export interface GltfSampler { input: number; output: number; interpolation?: string }
export interface GltfAnimation { name?: string; channels: GltfChannel[]; samplers: GltfSampler[] }
export interface GltfJson {
  asset: unknown;
  scene?: number;
  scenes?: unknown[];
  nodes: GltfNode[];
  meshes: GltfMesh[];
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  buffers: { byteLength: number }[];
  animations: GltfAnimation[];
  skins?: { joints: number[]; inverseBindMatrices?: number; skeleton?: number }[];
  images?: { bufferView?: number; mimeType?: string; name?: string }[];
  [key: string]: unknown;
}
export interface Glb { json: GltfJson; bin: Uint8Array }

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

export function readGlb(bytes: Uint8Array): Glb {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('not a GLB');
  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array = new Uint8Array(0);
  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(new TextDecoder().decode(body)) as GltfJson;
    else if (type === BIN_CHUNK) bin = body;
    offset += 8 + length;
  }
  if (!json) throw new Error('GLB without a JSON chunk');
  json.animations ??= [];
  return { json, bin };
}

const pad4 = (n: number) => (n + 3) & ~3;

export function writeGlb({ json, bin }: Glb): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = pad4(text.byteLength);
  const binLength = pad4(bin.byteLength);
  const total = 12 + 8 + jsonLength + (binLength ? 8 + binLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  if (binLength) {
    const at = 20 + jsonLength;
    view.setUint32(at, binLength, true);
    view.setUint32(at + 4, BIN_CHUNK, true);
    out.set(bin, at + 8);
  }
  return out;
}

export interface PruneOptions {
  /** Nodes whose mesh stays; every other node keeps its place in the hierarchy but loses its mesh. */
  meshNodes: readonly string[];
  /** Animations kept, by name. */
  animations: readonly string[];
  /** Whether an animation channel stays. */
  channel(nodeName: string, path: string): boolean;
}

/** Keep only the listed meshes, animations and channels; repack the binary with just the data they use. */
export function pruneGlb(source: Glb, options: PruneOptions): Glb {
  const json = structuredClone(source.json);
  const keepMesh = new Set(options.meshNodes);
  for (const node of json.nodes) {
    if (node.mesh !== undefined && !keepMesh.has(node.name ?? '')) {
      delete node.mesh;
      delete node.skin;
    }
  }
  // Meshes still referenced, renumbered.
  const meshMap = new Map<number, number>();
  const meshes: GltfMesh[] = [];
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    if (!meshMap.has(node.mesh)) {
      meshMap.set(node.mesh, meshes.length);
      meshes.push(json.meshes[node.mesh]!);
    }
    node.mesh = meshMap.get(node.mesh)!;
  }
  json.meshes = meshes;
  json.animations = json.animations
    .filter((a) => options.animations.includes(a.name ?? ''))
    .map((a) => {
      const channels = a.channels.filter((c) => options.channel(json.nodes[c.target.node]?.name ?? '', c.target.path));
      const samplers = channels.map((c) => a.samplers[c.sampler]!);
      return { ...a, channels: channels.map((c, i) => ({ ...c, sampler: i })), samplers };
    });
  return repack(json, source.bin);
}

/** Copy every accessor still in use (and image views) into a fresh binary, one tight view each. */
function repack(json: GltfJson, bin: Uint8Array): Glb {
  const used = new Map<number, number>();
  const accessors: GltfAccessor[] = [];
  const bufferViews: GltfBufferView[] = [];
  const chunks: Uint8Array[] = [];
  let length = 0;
  const addView = (bytes: Uint8Array, extra: Partial<GltfBufferView> = {}) => {
    const at = pad4(length);
    if (at > length) chunks.push(new Uint8Array(at - length));
    chunks.push(bytes);
    length = at + bytes.byteLength;
    bufferViews.push({ buffer: 0, byteOffset: at, byteLength: bytes.byteLength, ...extra });
    return bufferViews.length - 1;
  };
  const use = (index: number): number => {
    const seen = used.get(index);
    if (seen !== undefined) return seen;
    const a = json.accessors[index]!;
    if (a.sparse) throw new Error('sparse accessors are not supported');
    const view = json.bufferViews[a.bufferView!]!;
    const element = COMPONENTS[a.type]! * COMPONENT_BYTES[a.componentType]!;
    const stride = view.byteStride ?? element;
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const bytes = bin.slice(start, start + stride * (a.count - 1) + element);
    const extra: Partial<GltfBufferView> = view.target === undefined ? {} : { target: view.target };
    if (view.byteStride) extra.byteStride = view.byteStride;
    const copy: GltfAccessor = { ...a, bufferView: addView(bytes, extra) };
    delete copy.byteOffset;
    accessors.push(copy);
    used.set(index, accessors.length - 1);
    return accessors.length - 1;
  };
  for (const mesh of json.meshes) {
    for (const p of mesh.primitives) {
      for (const k of Object.keys(p.attributes)) p.attributes[k] = use(p.attributes[k]!);
      if (p.indices !== undefined) p.indices = use(p.indices);
      if (p.targets) p.targets = p.targets.map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, use(v)])));
    }
  }
  for (const skin of json.skins ?? []) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = use(skin.inverseBindMatrices);
  for (const a of json.animations) for (const s of a.samplers) Object.assign(s, { input: use(s.input), output: use(s.output) });
  for (const image of json.images ?? []) {
    if (image.bufferView === undefined) continue;
    const v = json.bufferViews[image.bufferView]!;
    image.bufferView = addView(bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  }
  const out = new Uint8Array(pad4(length));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return { json: { ...json, accessors, bufferViews, buffers: [{ byteLength: out.byteLength }] }, bin: out };
}
