// The stage under a top band (presentation spec L2, S-1): the canvas runs full screen, the court is framed for the
// area below the band, and the view extends upward into it.
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { framingView } from '../src/camera/framing.ts';

describe('framingView', () => {
  it('frames the whole canvas without a band', () => {
    expect(framingView(400, 500, 0)).toEqual({ aspect: 0.8, view: null });
  });

  it('frames the area under the band and extends the view up over it', () => {
    expect(framingView(400, 500, 100)).toEqual({ aspect: 1, view: { fullWidth: 400, fullHeight: 400, x: 0, y: -100, width: 400, height: 500 } });
  });

  it('draws the framed area exactly where it was framed: the band on top, the rest unchanged', () => {
    const plain = new PerspectiveCamera(50, 1, 0.3, 400);
    plain.updateProjectionMatrix();
    const banded = new PerspectiveCamera(50, 1, 0.3, 400);
    const v = framingView(400, 500, 100).view!;
    banded.setViewOffset(v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height);
    banded.updateProjectionMatrix();
    // A point on the framed area's bottom edge (NDC y −1 for the plain camera) lands at the canvas bottom too, and
    // its top edge (+1) lands 100 px down a 500 px canvas: NDC 1 − 2·100/500 = 0.6.
    const e = (m: number[], i: number) => m[i]!;
    const p = plain.projectionMatrix.elements;
    const b = banded.projectionMatrix.elements;
    // y_ndc = (m5·y + m9·z) / −z for a point (0, y, z); take z = −10 and y at the plain frame's edges.
    const yEdge = (s: number) => (s * 10) / e(p, 5);
    const ndc = (m: number[], y: number) => (e(m, 5) * y + e(m, 9) * -10) / 10;
    expect(ndc(b, yEdge(-1))).toBeCloseTo(-1, 9);
    expect(ndc(b, yEdge(1))).toBeCloseTo(0.6, 9);
  });

  it('never frames a band taller than the canvas', () => {
    expect(framingView(400, 500, 600).aspect).toBeGreaterThan(0);
    expect(framingView(400, 0, 0)).toEqual({ aspect: 1, view: null });
  });
});
