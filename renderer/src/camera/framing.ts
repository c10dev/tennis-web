// Framing for the screen's shape (M7, ADR-022): how the broadcast cameras adapt from a wide TV frame to a phone held
// upright. Pure: field-of-view maths and the share of the way to the portrait framing.
import { MathUtils } from 'three';
import type { CameraId } from '../broadcast/types.ts';
import { lerp } from '../math.ts';
import { BALL_LOOK, CAMERA } from '../tuning/index.ts';
import type { CamPose } from './mainCam.ts';

const WIDE: ReadonlySet<CameraId> = new Set(['main', 'side']);

export const horizontalFov = (vertical: number, aspect: number): number =>
  MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(vertical) / 2) * aspect));

export const verticalFov = (horizontal: number, aspect: number): number =>
  MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(horizontal) / 2) / aspect));

/** 0 at CAMERA.landscapeAspect and wider (the TV frame), 1 at CAMERA.portrait.aspect and narrower. */
export function portraitShare(aspect: number): number {
  return MathUtils.clamp((CAMERA.landscapeAspect - aspect) / (CAMERA.landscapeAspect - CAMERA.portrait.aspect), 0, 1);
}

/**
 * The vertical field of view to draw `pose` with: widened on narrow screens so the frame keeps a minimum width
 * across. Wide cameras keep CAMERA.minHorizontalFov (the main camera moves towards its portrait width as the screen
 * turns upright, since its portrait pose is fitted to the court), close-ups CAMERA.closeMinHorizontalFov.
 */
export function fitFov(pose: CamPose, camera: CameraId, aspect: number): number {
  const minWidth = camera === 'main'
    ? lerp(CAMERA.minHorizontalFov, CAMERA.portrait.horizontalFov, portraitShare(aspect))
    : WIDE.has(camera) ? CAMERA.minHorizontalFov : CAMERA.closeMinHorizontalFov;
  return Math.max(pose.fov, verticalFov(minWidth, aspect));
}

/** The ball is drawn a little larger on an upright phone, where the whole court must fit its width. */
export const portraitBallScale = (aspect: number): number => lerp(1, BALL_LOOK.portraitScale, portraitShare(aspect));
