import { describe, expect, it } from 'vitest';
import { Color, SRGBColorSpace, type Material, type Mesh, type MeshBasicMaterial } from 'three';
import type { Surface } from '@tennis/engine';
import { createStage } from '../src/scene/stage.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { COLOURS } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const SURFACES: Surface[] = ['hard', 'clay', 'grass'];
const hsl = (hex: number) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
/** Hue distance in degrees on the colour wheel. */
const hueGap = (a: number, b: number) => {
  const d = Math.abs(hsl(a).h - hsl(b).h) * 360;
  return Math.min(d, 360 - d);
};
/** Near-white, near-black and greys have no hue family. */
const neutral = (hex: number) => hsl(hex).s < 0.25 || hsl(hex).l > 0.9 || hsl(hex).l < 0.1;

describe('surface palettes (docs/design-references.md §3)', () => {
  it('uses the Rally Pop court colours and off-white lines', () => {
    expect(COLOURS.surface.hard.court).toBe(0x3470b8);
    expect(COLOURS.surface.clay.court).toBe(0xb8552e);
    expect(COLOURS.surface.grass.court).toBe(0x2f7a45);
    expect(COLOURS.lines).not.toBe(0xffffff);
    expect(hsl(COLOURS.lines).l).toBeGreaterThan(0.9);
  });
});

describe('kits', () => {
  for (const surface of SURFACES) {
    const kit = COLOURS.kits[surface];
    const { court, surround } = COLOURS.surface[surface];

    it(`never puts a shirt in the ${surface} court's hue family`, () => {
      for (const id of ['A', 'B'] as const) {
        const shirt = kit[id];
        if (neutral(shirt)) continue;
        expect(hueGap(shirt, court)).toBeGreaterThan(40);
        expect(hueGap(shirt, surround)).toBeGreaterThan(40);
      }
    });

    it(`keeps A coloured and B light on ${surface}, so the players stay apart`, () => {
      expect(neutral(kit.A)).toBe(false);
      expect(hsl(kit.B).l - hsl(kit.A).l).toBeGreaterThan(0.3);
    });
  }

  it('dresses player A on clay in neither red nor orange, and on grass in no green', () => {
    expect(hueGap(COLOURS.kits.clay.A, 0xff0000)).toBeGreaterThan(40);
    expect(hueGap(COLOURS.kits.clay.A, 0xff8000)).toBeGreaterThan(40);
    expect(hueGap(COLOURS.kits.grass.A, 0x00ff00)).toBeGreaterThan(60);
  });
});

describe('the ball owns yellow-green', () => {
  for (const surface of SURFACES) {
    it(`has nothing else in the ball's hue on ${surface}`, () => {
      const stage = createStage(buildTimeline(match(1, surface)));
      const ball = stage.scene.getObjectByName('ball')!;
      const exempt = new Set<Material>();
      ball.traverse((o) => { if ((o as Mesh).material) exempt.add((o as Mesh).material as Material); });
      stage.scene.traverse((o) => {
        const m = (o as Mesh).material as MeshBasicMaterial | undefined;
        if (!m || exempt.has(m) || !m.color) return;
        const hex = m.color.getHex();
        if (neutral(hex) || hsl(hex).s < 0.4) return;
        expect(hueGap(hex, COLOURS.ball), `${o.name || o.type} #${hex.toString(16)}`).toBeGreaterThan(25);
      });
    });
  }
});
