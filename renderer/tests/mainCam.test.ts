import { describe, expect, it } from 'vitest';
import { COURT } from '@tennis/engine';
import { dampPan, mainCamPose, panTarget } from '../src/camera/mainCam.ts';
import { CAMERA } from '../src/tuning.ts';

describe('main camera', () => {
  it('sits high behind the near (A starting) baseline and looks down the court', () => {
    const cam = mainCamPose(0);
    expect(cam.position.z).toBeGreaterThan(COURT.halfLength + 10);
    expect(cam.position.y).toBeGreaterThan(8);
    expect(cam.position.y).toBeLessThan(14);
    expect(cam.target.y).toBe(0);
    expect(Math.abs(cam.target.z)).toBeLessThan(COURT.halfLength / 2);
    expect(cam.position.x).toBe(0);
  });

  it('pans a little with the ball across the court, never further than its limit', () => {
    expect(panTarget({ x: 2, y: 0, z: 1 })).toBeCloseTo(2 * CAMERA.panFollow, 9);
    expect(panTarget({ x: 40, y: 0, z: 1 })).toBe(CAMERA.maxPan);
    expect(panTarget({ x: -40, y: 0, z: 1 })).toBe(-CAMERA.maxPan);
    expect(panTarget(null)).toBe(0);
    const panned = mainCamPose(1);
    expect(panned.target.x).toBe(1);
    expect(panned.position.x).toBeCloseTo(CAMERA.positionPanShare, 9);
  });

  it('eases towards the pan target without overshooting, at any frame rate', () => {
    let pan = 0;
    for (let i = 0; i < 30; i++) {
      const next = dampPan(pan, 1, 1 / 60);
      expect(next).toBeGreaterThan(pan);
      expect(next).toBeLessThanOrEqual(1);
      pan = next;
    }
    expect(dampPan(0, 1, 10)).toBeCloseTo(1, 6);
    const twoSteps = dampPan(dampPan(0, 1, 1 / 60), 1, 1 / 60);
    expect(dampPan(0, 1, 2 / 60)).toBeCloseTo(twoSteps, 9);
  });
});
