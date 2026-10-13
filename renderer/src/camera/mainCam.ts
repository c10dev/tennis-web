// Main Cam (GDD §8.1): the TV angle, high behind the near baseline. It stays at that end through changeovers and
// pans slightly with the ball. Pure functions; the UI owns the eased pan value between frames.
import { COURT, type Vec3 } from '@tennis/engine';
import { clamp } from '../math.ts';
import { CAMERA } from '../tuning/index.ts';

export interface CamPose {
  /** Three.js coordinates (y up). */
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

export function mainCamPose(pan: number): CamPose {
  return {
    position: { x: pan * CAMERA.positionPanShare, y: CAMERA.height, z: COURT.halfLength + CAMERA.behindBaseline },
    target: { x: pan, y: 0, z: CAMERA.lookZ },
    fov: CAMERA.fov,
  };
}

/** Where the pan wants to be for this ball: a share of its x, clamped; centred when no ball is in play. */
export function panTarget(ball: Vec3 | null): number {
  if (!ball) return 0;
  return clamp(ball.x * CAMERA.panFollow, -CAMERA.maxPan, CAMERA.maxPan);
}

/** Exponential ease towards the target; frame-rate independent. */
export function dampPan(current: number, target: number, dt: number): number {
  return target + (current - target) * Math.exp(-Math.max(0, dt) / CAMERA.panTimeConstant);
}
