// Kits on the skinned players (ADR-024, TD-062): the palette's garment cells recoloured per player, shading kept,
// so A and B follow the per-surface colour rule (ADR-019) instead of both wearing the Rogue's green.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Color, SkinnedMesh, type MeshToonMaterial } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { kitFor, recolourCells } from '../src/scene/kit.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { COLOURS, PLAYER_KIT } from '../src/tuning/index.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A 16×8 palette (8×4 cells of 2×2): every cell a top-to-bottom gradient of its own colour. */
function palette(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(16 * 8 * 4);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      const shade = y % 2 === 0 ? 1 : 0.5;
      data.set([Math.round(40 * shade), Math.round(200 * shade), Math.round(120 * shade), 255], i);
    }
  }
  return data;
}

describe('palette recolouring', () => {
  it('paints the given cells in the kit colour, keeping their shading, and leaves the rest alone', () => {
    const data = palette();
    const before = data.slice();
    recolourCells(data, 16, 8, [{ col: 0, row: 1, colour: 0xe0473b }]);
    // Cell (0, 1) is x 0–1, y 2–3.
    const top = data.slice((2 * 16 + 0) * 4, (2 * 16 + 0) * 4 + 3);
    const bottom = data.slice((3 * 16 + 1) * 4, (3 * 16 + 1) * 4 + 3);
    const hue = (p: Uint8ClampedArray) => new Color(p[0]! / 255, p[1]! / 255, p[2]! / 255).getHSL({ h: 0, s: 0, l: 0 }).h;
    expect(Math.abs(hue(top) - new Color(0xe0473b).getHSL({ h: 0, s: 0, l: 0 }).h)).toBeLessThan(0.02);
    expect(lum(top[0]!, top[1]!, top[2]!)).toBeGreaterThan(lum(bottom[0]!, bottom[1]!, bottom[2]!));
    expect(lum(bottom[0]!, bottom[1]!, bottom[2]!)).toBeGreaterThan(lum(top[0]!, top[1]!, top[2]!) * PLAYER_KIT.shadeFloor - 1);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        if (x < 2 && (y === 2 || y === 3)) continue;
        const i = (y * 16 + x) * 4;
        expect([...data.slice(i, i + 4)]).toEqual([...before.slice(i, i + 4)]);
      }
    }
  });

  it('keeps a light kit light: the darkest shade of a near-white kit stays above mid grey', () => {
    const data = palette();
    recolourCells(data, 16, 8, [{ col: 3, row: 2, colour: COLOURS.kits.hard.B }]);
    const i = (5 * 16 + 6) * 4;
    expect(lum(data[i]!, data[i + 1]!, data[i + 2]!) / 255).toBeGreaterThan(0.5);
  });
});

describe('kits per player', () => {
  it('recolours the cells the body actually uses for its garments, and never a skin cell', () => {
    const body = model.root.getObjectByName('body') as SkinnedMesh;
    const uv = body.geometry.attributes.uv!;
    const used = new Set<string>();
    for (let i = 0; i < uv.count; i++) used.add(`${Math.floor(uv.getX(i) * PLAYER_KIT.grid.cols)},${Math.floor(uv.getY(i) * PLAYER_KIT.grid.rows)}`);
    for (const [col, row] of [...PLAYER_KIT.cells.shirt, ...PLAYER_KIT.cells.trim]) expect(used.has(`${col},${row}`)).toBe(true);
    const garments = new Set([...PLAYER_KIT.cells.shirt, ...PLAYER_KIT.cells.trim].map(([c, r]) => `${c},${r}`));
    for (const [col, row] of PLAYER_KIT.skinCells) expect(garments.has(`${col},${row}`)).toBe(false);
  });

  it('dresses A in the surface colour and B in the light kit, the trim a darker shade of each', () => {
    const l = (hex: number) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l;
    for (const surface of ['hard', 'clay', 'grass'] as const) {
      for (const id of ['A', 'B'] as const) {
        const kit = kitFor(surface, id);
        expect(kit.shirt).toBe(COLOURS.kits[surface][id]);
        expect(kit.trim).toBe(new Color(kit.shirt).lerp(new Color(COLOURS.shorts), PLAYER_KIT.trimToShorts).getHex());
        expect(l(kit.trim)).toBeLessThan(l(kit.shirt));
      }
      expect(l(kitFor(surface, 'B').trim)).toBeGreaterThan(l(kitFor(surface, 'A').trim));
    }
  });

  it('gives each rig its own material, so one player’s kit never shows on the other', () => {
    const a = new GltfRig(model, kitFor('hard', 'A'));
    const b = new GltfRig(model, kitFor('hard', 'B'));
    const mat = (r: GltfRig) => (r.object3d.getObjectByName('body') as SkinnedMesh).material as MeshToonMaterial;
    expect(mat(a)).not.toBe(mat(b));
  });
});
