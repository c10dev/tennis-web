// Kits on the skinned players (ADR-024, TD-062): the palette's garment cells recoloured per player, so A and B follow
// the per-surface colour rule (ADR-019). The pixel work is pure; making the texture needs a browser (a canvas).
import { CanvasTexture, Color, type Texture } from 'three';
import type { PlayerId, Surface } from '@tennis/engine';
import { COLOURS, PLAYER_KIT } from '../tuning/index.ts';

export interface Kit {
  shirt: number;
  trim: number;
}

/** A wears the surface's colour, B the light kit; the trim (hood and scarf) is the shirt halfway to the shorts. */
export function kitFor(surface: Surface, id: PlayerId): Kit {
  const shirt = COLOURS.kits[surface][id];
  return { shirt, trim: new Color(shirt).lerp(new Color(COLOURS.shorts), PLAYER_KIT.trimToShorts).getHex() };
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Paint each cell of an RGBA image (grid PLAYER_KIT.grid) in its colour, scaled by the cell's own shading: its
 *  brightest pixel keeps the full colour, the darkest no less than `shadeFloor` of it. In place. */
export function recolourCells(data: Uint8ClampedArray, width: number, height: number, cells: { col: number; row: number; colour: number }[]): void {
  const cw = width / PLAYER_KIT.grid.cols;
  const ch = height / PLAYER_KIT.grid.rows;
  for (const { col, row, colour } of cells) {
    const c = new Color(colour);
    const x0 = Math.round(col * cw);
    const y0 = Math.round(row * ch);
    const x1 = Math.round((col + 1) * cw);
    const y1 = Math.round((row + 1) * ch);
    let lo = Infinity;
    let hi = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        const l = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
        lo = Math.min(lo, l);
        hi = Math.max(hi, l);
      }
    }
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        const u = hi > lo ? (luminance(data[i]!, data[i + 1]!, data[i + 2]!) - lo) / (hi - lo) : 1;
        const shade = PLAYER_KIT.shadeFloor + (1 - PLAYER_KIT.shadeFloor) * u;
        data[i] = Math.round(c.r * 255 * shade);
        data[i + 1] = Math.round(c.g * 255 * shade);
        data[i + 2] = Math.round(c.b * 255 * shade);
      }
    }
  }
}

const made = new WeakMap<Texture, Map<string, Texture>>();

/** The palette with this kit's colours (browser only; the same texture back for the same kit). */
export function kitTexture(base: Texture, kit: Kit): Texture {
  const key = `${kit.shirt}/${kit.trim}`;
  const cache = made.get(base) ?? new Map<string, Texture>();
  made.set(base, cache);
  const hit = cache.get(key);
  if (hit) return hit;
  const image = base.image as { width: number; height: number } & CanvasImageSource;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const cells = [
    ...PLAYER_KIT.cells.shirt.map(([col, row]) => ({ col, row, colour: kit.shirt })),
    ...PLAYER_KIT.cells.trim.map(([col, row]) => ({ col, row, colour: kit.trim })),
  ];
  recolourCells(pixels.data, canvas.width, canvas.height, cells);
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.flipY = base.flipY;
  texture.colorSpace = base.colorSpace;
  texture.magFilter = base.magFilter;
  texture.minFilter = base.minFilter;
  texture.generateMipmaps = base.generateMipmaps;
  cache.set(key, texture);
  return texture;
}
