import { describe, expect, it } from 'vitest';
import { MeshLambertMaterial, MeshToonMaterial, NearestFilter, type Material, type Mesh, type Object3D } from 'three';
import { createMaterials, toonGradient } from '../src/scene/materials.ts';
import { buildCourt } from '../src/scene/court.ts';
import { buildVenue } from '../src/scene/venue.ts';
import { MannequinRig } from '../src/scene/rig.ts';
import { LOOK } from '../src/tuning/index.ts';

const materials = (root: Object3D): Material[] => {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) out.push(...(Array.isArray(m) ? m : [m]));
  });
  return out;
};

describe('toon gradient', () => {
  it('has three hard bands, darkest first', () => {
    const g = toonGradient();
    expect(g.image.width).toBe(3);
    expect(g.image.height).toBe(1);
    const data = Array.from(g.image.data as Uint8Array);
    expect(new Set(data).size).toBe(3);
    expect([...data].sort((a, b) => a - b)).toEqual(data);
    expect(g.magFilter).toBe(NearestFilter);
    expect(g.minFilter).toBe(NearestFilter);
  });
});

describe('material factory', () => {
  it('makes toon materials on the shared gradient when toon is on', () => {
    const m = createMaterials({ toon: true })(0x3470b8);
    expect(m).toBeInstanceOf(MeshToonMaterial);
    expect((m as MeshToonMaterial).gradientMap).toBe(toonGradient());
    expect(m.color.getHex()).toBe(0x3470b8);
  });

  it('falls back to the old Lambert look when toon is off', () => {
    const m = createMaterials({ toon: false })(0x3470b8);
    expect(m).toBeInstanceOf(MeshLambertMaterial);
    expect(m.color.getHex()).toBe(0x3470b8);
  });

  it('shares one material per colour', () => {
    const make = createMaterials({ toon: true });
    expect(make(0x123456)).toBe(make(0x123456));
    expect(make(0x123456)).not.toBe(make(0x654321));
  });

  it('follows LOOK.toon by default', () => {
    expect(createMaterials()(0x111111)).toBeInstanceOf(LOOK.toon ? MeshToonMaterial : MeshLambertMaterial);
  });
});

describe('scene materials', () => {
  it.runIf(LOOK.toon)('leaves no Lambert material in the court, venue or players', () => {
    const roots = [buildCourt('clay'), buildVenue('clay'), new MannequinRig(0x1f7ae0).object3d];
    for (const root of roots) {
      for (const m of materials(root)) expect(m).not.toBeInstanceOf(MeshLambertMaterial);
    }
    expect(materials(buildCourt('hard')).some((m) => m instanceof MeshToonMaterial)).toBe(true);
  });
});
