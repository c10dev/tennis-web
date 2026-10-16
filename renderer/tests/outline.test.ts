import { describe, expect, it } from 'vitest';
import { BackSide, Mesh, MeshBasicMaterial, ShaderMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { buildTimeline } from '../src/playback/timeline.ts';
import { addOutline, isOutline, outlineWidth } from '../src/scene/outline.ts';
import { createStage } from '../src/scene/stage.ts';
import { LOOK } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const outlinesUnder = (root: Object3D) => {
  const out: Mesh[] = [];
  root.traverse((o) => { if (isOutline(o)) out.push(o as Mesh); });
  return out;
};

describe('addOutline', () => {
  const part = new Mesh(new SphereGeometry(0.2, 12, 8), new MeshBasicMaterial());
  part.name = 'head';
  const hull = addOutline(part);

  it('adds an ink hull drawn from the back faces, riding on the part', () => {
    expect(hull.parent).toBe(part);
    expect(hull.name).toBe('head-outline');
    const m = hull.material as ShaderMaterial;
    expect(m.side).toBe(BackSide);
    expect(m.uniforms.colour!.value.getHex()).toBe(LOOK.outline.colour);
    expect(isOutline(hull)).toBe(true);
    expect(isOutline(part)).toBe(false);
  });

  it('is pushed out along smooth, outward normals (no cracks at seams)', () => {
    const pos = hull.geometry.getAttribute('position');
    const nor = hull.geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      const p = new Vector3().fromBufferAttribute(pos, i);
      const n = new Vector3().fromBufferAttribute(nor, i);
      expect(n.length()).toBeCloseTo(1, 5);
      expect(n.dot(p)).toBeGreaterThan(0);
    }
    // Coincident seam vertices are merged, so the hull cannot split open where the part's UV seam is.
    expect(pos.count).toBeLessThan(part.geometry.getAttribute('position').count);
  });

  it('keeps the same width on screen near and far, so close-ups get a fine line', () => {
    const yy = 1 / Math.tan((30 / 2) * (Math.PI / 180));
    const px = (depth: number) => (outlineWidth(depth, yy) / depth) * (yy * 720) / 2;
    expect(px(40)).toBeCloseTo(LOOK.outline.px, 5);
    expect(px(15)).toBeCloseTo(LOOK.outline.px, 5);
    expect(outlineWidth(40, yy)).toBeGreaterThan(outlineWidth(15, yy));
    expect(outlineWidth(4, yy)).toBeLessThan(0.01);
  });
});

describe('outlines on the stage', () => {
  const stage = createStage(buildTimeline(match(1)));
  const all = outlinesUnder(stage.scene);
  const owner = (o: Object3D): string | null => {
    for (let p: Object3D | null = o; p; p = p.parent) if (['player-A', 'player-B', 'net-assembly', 'ball'].includes(p.name)) return p.name;
    return null;
  };

  it('outlines players, net and ball only', () => {
    for (const o of all) expect(owner(o), o.name).not.toBeNull();
    for (const name of ['player-A', 'player-B', 'net-assembly', 'ball']) expect(all.some((o) => owner(o) === name), name).toBe(true);
    expect(outlinesUnder(stage.scene.getObjectByName('court')!).every((o) => owner(o) === 'net-assembly')).toBe(true);
    expect(outlinesUnder(stage.scene.getObjectByName('venue')!)).toEqual([]);
  });

  it('outlines the hands, shoes and cap (ADR-028)', () => {
    for (const part of ['right-hand', 'left-hand', 'foot-left', 'foot-right', 'cap']) expect(all.filter((o) => o.name === `${part}-outline`), part).toHaveLength(2);
    // 15 parts a player since motion track A's forearm (ADR-023): 30, plus the net's tape and posts and the ball.
    expect(LOOK.outline.maxDraws).toBe(34);
  });

  it('stays within the draw budget: one extra draw per outlined part', () => {
    const perPlayer = LOOK.outline.rigParts.length;
    expect(all.length).toBe(2 * perPlayer + 3 + 1);
    expect(all.length).toBeLessThanOrEqual(LOOK.outline.maxDraws);
  });
});
