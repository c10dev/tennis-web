// Main Cam (GDD §8.1): the TV angle, high behind the near baseline. It stays at that end through changeovers and
// pans slightly with the ball. Pure functions; the UI owns the eased pan value between frames.
import { COURT, type Vec3 } from '@tennis/engine';
import { clamp, lerp } from '../math.ts';
import { CAMERA } from '../tuning/index.ts';
import { portraitShare, verticalFov } from './framing.ts';

export interface CamPose {
  /** Three.js coordinates (y up). */
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

/** The TV angle on a wide screen; on a narrower one it moves towards the upright-phone framing (CAMERA.portrait). */
export function mainCamPose(pan: number, aspect: number = CAMERA.landscapeAspect): CamPose {
  const u = portraitShare(aspect);
  const P = CAMERA.portrait;
  return {
    position: { x: pan * CAMERA.positionPanShare, y: lerp(CAMERA.height, P.height, u), z: COURT.halfLength + lerp(CAMERA.behindBaseline, P.behindBaseline, u) },
    target: { x: pan, y: 0, z: lerp(CAMERA.lookZ, P.lookZ, u) },
    fov: u === 0 ? CAMERA.fov : lerp(CAMERA.fov, verticalFov(P.horizontalFov, aspect), u),
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
