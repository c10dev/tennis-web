import { describe, expect, it } from 'vitest';
import { Box3, type Object3D } from 'three';
import { COURT } from '@tennis/engine';
import { buildVenue, standHeightAt } from '../src/scene/venue.ts';
import { COURT_DRAW } from '../src/tuning/index.ts';

const box = (o: Object3D) => new Box3().setFromObject(o);

describe('buildVenue', () => {
  const venue = buildVenue('clay');

  it('surrounds the court with stands that stay off the court and its run-off', () => {
    const stands = venue.children.filter((o) => o.name.startsWith('stand-'));
    expect(stands.map((s) => s.name).sort()).toEqual(['stand-east', 'stand-north', 'stand-south', 'stand-west']);
    for (const s of stands) {
      const b = box(s);
      const clearOfSides = b.min.x >= COURT_DRAW.surroundHalfWidth || b.max.x <= -COURT_DRAW.surroundHalfWidth;
      const clearOfEnds = b.min.z >= COURT_DRAW.surroundHalfLength || b.max.z <= -COURT_DRAW.surroundHalfLength;
      expect(clearOfSides || clearOfEnds).toBe(true);
    }
  });

  it('puts the umpire chair beside the net on the −x side, outside the posts', () => {
    const b = box(venue.getObjectByName('umpire-chair')!);
    expect(b.max.x).toBeLessThan(-(COURT_DRAW.doublesHalfWidth + COURT_DRAW.postOutside));
    expect(Math.abs((b.min.z + b.max.z) / 2)).toBeLessThan(0.5);
    expect(b.max.y).toBeGreaterThan(2);
  });

  it('describes the stand heights it builds, for camera placement', () => {
    expect(standHeightAt(0, 0)).toBe(0);
    expect(standHeightAt(COURT_DRAW.surroundHalfWidth + 5, 0)).toBeGreaterThan(1);
    expect(standHeightAt(0, -(COURT.halfLength + 15))).toBeGreaterThan(1);
    for (const tier of venue.children.filter((o) => o.name.startsWith('stand-')).flatMap((s) => s.children)) {
      const b = box(tier);
      const height = standHeightAt((b.min.x + b.max.x) / 2, -(b.min.z + b.max.z) / 2);
      expect(height).toBeGreaterThan(0);
      expect(b.max.y).toBeCloseTo(height, 6);
    }
  });

  it('dresses each surface differently', () => {
    const colour = (s: 'hard' | 'clay' | 'grass') =>
      JSON.stringify((buildVenue(s).getObjectByName('stand-north')!.children[0] as unknown as { material: { color: { getHex(): number } } }).material.color.getHex());
    expect(new Set([colour('hard'), colour('clay'), colour('grass')]).size).toBe(3);
  });
});
