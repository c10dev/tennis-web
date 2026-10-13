import { describe, expect, it } from 'vitest';
import { AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, SRGBColorSpace, type Mesh, type Material } from 'three';
import { buildTimeline } from '../src/playback/timeline.ts';
import { createStage } from '../src/scene/stage.ts';
import { DAYLIGHT, VENUE } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const stage = createStage(buildTimeline(match(1, 'clay')));
const lights = stage.scene.children;

describe('daylight', () => {
  it('lights the court with a warm sun over a sky/ground hemisphere, no flat ambient to wash out the cel bands', () => {
    const suns = lights.filter((o): o is DirectionalLight => o instanceof DirectionalLight);
    expect(suns).toHaveLength(1);
    expect(suns[0]!.intensity).toBe(DAYLIGHT.sun.intensity);
    expect(suns[0]!.position.y).toBeGreaterThan(0);
    expect(lights.filter((o) => o instanceof HemisphereLight)).toHaveLength(1);
    expect(lights.filter((o) => o instanceof AmbientLight)).toHaveLength(0);
  });

  it('hazes the far stands into the sky with fog the colour of the horizon', () => {
    const fog = stage.scene.fog as Fog;
    expect(fog).toBeInstanceOf(Fog);
    expect(fog.color.getHex()).toBe(DAYLIGHT.sky.horizon);
    // The court stays clear; the far stands start to fade.
    expect(fog.near).toBeGreaterThan(45);
    expect(fog.far).toBeLessThan(400);
  });

  it('puts a gradient sky dome round the venue, inside the camera far plane, untouched by fog', () => {
    const sky = stage.scene.getObjectByName('sky') as Mesh;
    sky.geometry.computeBoundingSphere();
    const r = sky.geometry.boundingSphere!.radius;
    expect(r).toBeLessThan(400);
    expect(r).toBeGreaterThan(VENUE.endStandY + VENUE.tiers * VENUE.tierDepth + 40);
    expect((sky.material as Material & { fog: boolean }).fog).toBe(false);
    const colours = sky.geometry.getAttribute('color');
    const pos = sky.geometry.getAttribute('position');
    let top = 0;
    let horizon = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > pos.getY(top)) top = i;
      if (Math.abs(pos.getY(i)) < Math.abs(pos.getY(horizon))) horizon = i;
    }
    const at = (i: number) => new Color(colours.getX(i), colours.getY(i), colours.getZ(i)).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
    expect(at(top).l).toBeLessThan(at(horizon).l);
  });

  it('keeps the ball, its trail and the outlines out of the fog', () => {
    for (const name of ['ball', 'ball-trail', 'head-outline', 'ball-outline']) {
      const m = (stage.scene.getObjectByName(name) as Mesh).material as Material & { fog: boolean };
      expect(m.fog, name).toBe(false);
    }
  });
});
