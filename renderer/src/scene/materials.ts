// The material factory for lit surfaces: toon (Rally Pop, ADR-019) or the M3 Lambert look, picked by LOOK.toon.
import { DataTexture, MeshLambertMaterial, MeshToonMaterial, NearestFilter, RedFormat } from 'three';
import { LOOK } from '../tuning/index.ts';

export type LitMaterial = MeshToonMaterial | MeshLambertMaterial;

let gradient: DataTexture | null = null;

/** The three-texel gradient map every toon material shares; nearest filtering keeps the bands hard. */
export function toonGradient(): DataTexture {
  if (gradient) return gradient;
  gradient = new DataTexture(Uint8Array.from(LOOK.toonBands), LOOK.toonBands.length, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

/** A colour → material function that hands out one shared material per colour. */
export function createMaterials({ toon = LOOK.toon }: { toon?: boolean } = {}): (colour: number) => LitMaterial {
  const cache = new Map<number, LitMaterial>();
  return (colour) => {
    let m = cache.get(colour);
    if (!m) {
      m = toon ? new MeshToonMaterial({ color: colour, gradientMap: toonGradient() }) : new MeshLambertMaterial({ color: colour });
      cache.set(colour, m);
    }
    return m;
  };
}

/** The scene's lit material for a colour. */
export const lit = createMaterials();
