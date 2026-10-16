import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { COURT } from '@tennis/engine';
import { fitFov, horizontalFov, portraitBallScale } from '../src/camera/framing.ts';
import { mainCamPose, type CamPose } from '../src/camera/mainCam.ts';
import { createStage } from '../src/scene/stage.ts';
import { standHeightAt } from '../src/scene/venue.ts';
import { BALL_LOOK, CAMERA } from '../src/tuning/index.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { match } from './fixtures.ts';

/** Court (x, y, height) → normalised device coordinates for a pose shown at `aspect`. */
function ndc(pose: CamPose, aspect: number, x: number, y: number, h: number) {
  const cam = new PerspectiveCamera(fitFov(pose, 'main', aspect), aspect, 0.3, 400);
  cam.position.set(pose.position.x, pose.position.y, pose.position.z);
  cam.lookAt(pose.target.x, pose.target.y, pose.target.z);
  cam.updateMatrixWorld();
  return { p: new Vector3(x, h, -y).project(cam), cam };
}

/** The doubles court (the lines drawn) and the players around it, court coordinates. */
const DOUBLES = COURT.halfWidth + 1.37;
const MUST_SEE: [number, number, number][] = [
  [-DOUBLES, -COURT.halfLength, 0], [DOUBLES, -COURT.halfLength, 0], [-DOUBLES, COURT.halfLength, 0], [DOUBLES, COURT.halfLength, 0],
  // The far player's head well behind their baseline, the near player's feet behind theirs.
  [0, COURT.halfLength + 2, 2.1], [-3, COURT.halfLength + 2, 2.1], [3, COURT.halfLength + 2, 2.1],
  [0, -COURT.halfLength - 2.5, 0], [-3, -COURT.halfLength - 2.5, 0], [3, -COURT.halfLength - 2.5, 0],
];

/** Phone stages: the quick match's 60dvh stage on a few phones (CSS px). */
const PHONES = [412 / 503, 393 / 511, 360 / 480, 430 / 559];

describe('main camera framing (M7 step 5)', () => {
  it('is the TV camera unchanged on wide screens', () => {
    for (const aspect of [16 / 9, 1280 / 720, 2.2, CAMERA.landscapeAspect]) expect(mainCamPose(0.6, aspect)).toEqual(mainCamPose(0.6));
    for (const aspect of [16 / 9, 2.2]) expect(fitFov(mainCamPose(0), 'main', aspect)).toBe(CAMERA.fov);
  });

  it('shows the whole doubles court and both players on a phone stage, at every pan', () => {
    for (const aspect of PHONES) {
      for (const pan of [0, CAMERA.maxPan, -CAMERA.maxPan]) {
        for (const [x, y, h] of MUST_SEE) {
          const { p } = ndc(mainCamPose(pan, aspect), aspect, x, y, h);
          expect(Math.abs(p.x), `aspect ${aspect.toFixed(2)} pan ${pan} x (${x}, ${y}, ${h})`).toBeLessThanOrEqual(0.96);
          expect(Math.abs(p.y), `aspect ${aspect.toFixed(2)} pan ${pan} y (${x}, ${y}, ${h})`).toBeLessThanOrEqual(0.96);
        }
      }
    }
  });

  it('fills the phone stage with the court instead of sky and empty surround', () => {
    for (const aspect of PHONES) {
      const pose = mainCamPose(0, aspect);
      const near = ndc(pose, aspect, 0, -COURT.halfLength, 0).p.y;
      const far = ndc(pose, aspect, 0, COURT.halfLength, 0).p.y;
      // From baseline to baseline, at least half the stage's height (the court must also fit the narrow width).
      expect(far - near).toBeGreaterThan(1);
    }
  });

  /** Ball diameter in CSS px at court (0, y) on a phone stage `w` px wide, as drawn (portrait scale included). */
  const ballPx = (aspect: number, w: number, y: number) => {
    const r = BALL_LOOK.radius * portraitBallScale(aspect);
    const { p: centre, cam } = ndc(mainCamPose(0, aspect), aspect, 0, y, r);
    const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion).multiplyScalar(r);
    const edge = new Vector3(0, r, -y).add(right).project(cam);
    return Math.abs(edge.x - centre.x) * w;
  };

  it('keeps the far-baseline ball at least 4 px across on a 412×503 stage, and no beach ball at the near one', () => {
    expect(ballPx(412 / 503, 412, COURT.halfLength)).toBeGreaterThanOrEqual(4);
    expect(ballPx(412 / 503, 412, -COURT.halfLength)).toBeLessThan(14);
    expect(portraitBallScale(16 / 9)).toBe(1);
  });

  it('draws the ball at the portrait scale on a phone stage, and at its own size on a wide one', () => {
    const tl = buildTimeline(match(2));
    const seg = tl.segments.find((s) => s.point.shots.length >= 2)!;
    const frame = { ...matchFrameAt(tl, seg.zero + seg.point.shots[1]!.t + 0.2), camera: 'main' as const };
    const stage = createStage(tl);
    const ball = stage.scene.getObjectByName('ball')!;
    stage.applyFrame(frame);
    expect(ball.scale.x).toBe(1);
    stage.setAspect(412 / 503);
    stage.applyFrame(frame);
    expect(ball.scale.x).toBeCloseTo(BALL_LOOK.portraitScale, 9);
  });

  it('stands above the stands behind the near end', () => {
    for (const aspect of PHONES) {
      const c = mainCamPose(0, aspect).position;
      expect(c.y).toBeGreaterThan(standHeightAt(c.x, -c.z) + 0.3);
    }
  });

  it('moves smoothly from the TV angle to the phone angle as the screen narrows', () => {
    let last = mainCamPose(0, CAMERA.landscapeAspect);
    for (let a = CAMERA.landscapeAspect; a >= 0.6; a -= 0.05) {
      const pose = mainCamPose(0, a);
      expect(Math.abs(pose.position.y - last.position.y)).toBeLessThan(1.5);
      expect(Math.abs(pose.position.z - last.position.z)).toBeLessThan(1.5);
      last = pose;
    }
  });
});

describe('fitFov', () => {
  const close: CamPose = { position: { x: 0, y: 2, z: 15 }, target: { x: 0, y: 0, z: 0 }, fov: 32 };

  it('keeps every camera at least its minimum width across on a narrow screen', () => {
    for (const aspect of PHONES) {
      expect(horizontalFov(fitFov(close, 'serve', aspect), aspect)).toBeGreaterThanOrEqual(CAMERA.closeMinHorizontalFov - 1e-9);
      expect(horizontalFov(fitFov({ ...close, fov: 34 }, 'side', aspect), aspect)).toBeGreaterThanOrEqual(CAMERA.minHorizontalFov - 1e-9);
    }
  });

  it('leaves every camera alone on a wide screen', () => {
    for (const camera of ['serve', 'reaction', 'hawkeye', 'side'] as const) expect(fitFov(close, camera, 16 / 9)).toBe(close.fov);
  });
});
