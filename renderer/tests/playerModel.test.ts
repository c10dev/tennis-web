// The committed player model (ADR-024, slice step 1): a pruned CC0 KayKit body inside the budgets of
// docs/3d-redesign.md §4.4, with in-place clips that only turn the deform bones.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGlb, type GltfJson } from '../src/asset/glb.ts';
import { PLAYER_MODEL } from '../src/tuning/index.ts';

const path = new URL('../../ui/public/models/player.glb', import.meta.url);
const { json, bin } = readGlb(new Uint8Array(readFileSync(path)));
const names = json.nodes.map((n) => n.name ?? '');

const accessorFloats = (j: GltfJson, b: Uint8Array, index: number): Float32Array => {
  const a = j.accessors[index]!;
  const view = j.bufferViews[a.bufferView!]!;
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]!;
  const start = b.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Float32Array(b.buffer.slice(start, start + a.count * comps * 4));
};

describe('player model', () => {
  it('keeps the body meshes and nothing else, within the triangle budget', () => {
    const meshNodes = json.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name);
    expect(meshNodes.sort()).toEqual([...PLAYER_MODEL.bodyMeshes].sort());
    const tris = json.meshes.reduce((sum, m) => sum + m.primitives.reduce((s, p) => s + json.accessors[p.indices!]!.count / 3, 0), 0);
    expect(tris).toBeLessThanOrEqual(5000);
  });

  it('has the clips the rig uses, turning only deform bones (hips may move), with no scale tracks', () => {
    expect(json.animations.map((a) => a.name).sort()).toEqual([...PLAYER_MODEL.clips].sort());
    for (const a of json.animations) {
      for (const c of a.channels) {
        const bone = names[c.target.node]!;
        expect(PLAYER_MODEL.deformBones, `${a.name} ${bone}`).toContain(bone);
        expect(c.target.path === 'rotation' || (c.target.path === 'translation' && bone === 'hips'), `${a.name} ${bone}.${c.target.path}`).toBe(true);
      }
    }
    const animated = new Set(json.animations.flatMap((a) => a.channels.map((c) => c.target.node)));
    expect(animated.size).toBeLessThanOrEqual(32);
  });

  it('keeps every clip in place: the hips wander less than 0.1 units across the ground (0.2 in a reaction)', () => {
    for (const a of json.animations) {
      const ch = a.channels.find((c) => names[c.target.node] === 'hips' && c.target.path === 'translation');
      if (!ch) continue;
      const v = accessorFloats(json, bin, a.samplers[ch.sampler]!.output);
      const xs = [...v].filter((_, i) => i % 3 === 0);
      const zs = [...v].filter((_, i) => i % 3 === 2);
      const limit = /^(Idle|Running|Walking)/.test(a.name ?? '') ? 0.1 : 0.2;
      expect(Math.max(...xs) - Math.min(...xs), a.name).toBeLessThan(limit);
      expect(Math.max(...zs) - Math.min(...zs), a.name).toBeLessThan(limit);
    }
  });

  it('stays small and carries its CC0 credit', () => {
    expect(statSync(path).size).toBeLessThan(PLAYER_MODEL.maxBytes);
    const credits = new URL('../../ui/public/models/CREDITS.md', import.meta.url);
    expect(existsSync(credits)).toBe(true);
    expect(readFileSync(credits, 'utf8')).toMatch(/CC0/);
  });
});
