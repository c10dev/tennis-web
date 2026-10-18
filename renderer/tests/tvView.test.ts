// The TV view as a still (ADR-031, M8 phase 0): the Main camera with its pan settled on the ball and its field of view
// fitted to the stage, and a projector from Three coordinates to the stage's CSS pixels for pose-space size checks.
import { describe, expect, it } from 'vitest';
import { COURT } from '@tennis/engine';
import { fitFov } from '../src/camera/framing.ts';
import { mainCamPose, panTarget } from '../src/camera/mainCam.ts';
import { tvProjector, tvView } from '../src/camera/tvView.ts';
import { TV_STAGE } from '../src/tuning/index.ts';

const aspect = TV_STAGE.width / TV_STAGE.height;

describe('the TV view as a still', () => {
  it('is the Main camera panned to where the ball wants it, fitted to the stage', () => {
    const ball = { x: 3, y: 2, z: 1 };
    const main = mainCamPose(panTarget(ball), aspect);
    const view = tvView(ball, aspect);
    expect(view.position).toEqual(main.position);
    expect(view.target).toEqual(main.target);
    expect(view.fov).toBe(fitFov(main, 'main', aspect));
    expect(tvView(null, aspect).target.x).toBe(0);
  });

  it('projects the camera’s aim to the middle of the stage and both baselines inside it, the near one lower', () => {
    const project = tvProjector(null);
    const aim = tvView(null, aspect).target;
    const mid = project(aim);
    expect(mid.x).toBeCloseTo(TV_STAGE.width / 2, 6);
    expect(mid.y).toBeCloseTo(TV_STAGE.height / 2, 6);
    const half = 5.485; // the doubles sidelines
    const near = [project({ x: -half, y: 0, z: COURT.halfLength }), project({ x: half, y: 0, z: COURT.halfLength })];
    const far = [project({ x: -half, y: 0, z: -COURT.halfLength }), project({ x: half, y: 0, z: -COURT.halfLength })];
    for (const p of [...near, ...far]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(TV_STAGE.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(TV_STAGE.height);
    }
    expect(near[0]!.y).toBeGreaterThan(far[0]!.y);
    // Perspective: the near baseline is wider on screen than the far one.
    expect(near[1]!.x - near[0]!.x).toBeGreaterThan(far[1]!.x - far[0]!.x);
  });

  it('draws a 1.7 m standing height about 30–45 px tall at the near baseline and smaller at the far one', () => {
    const project = tvProjector(null);
    const tall = (z: number) => project({ x: 0, y: 0, z }).y - project({ x: 0, y: 1.7, z }).y;
    expect(tall(COURT.halfLength)).toBeGreaterThan(30);
    expect(tall(COURT.halfLength)).toBeLessThan(45);
    expect(tall(-COURT.halfLength)).toBeLessThan(tall(COURT.halfLength) * 0.8);
  });
});
