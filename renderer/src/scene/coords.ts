// The one place court coordinates (metres, z up, A's end at y < 0) become Three.js coordinates (y up).
// (x, y, z) → (x, z, −y) keeps the frame right-handed, so the A end is nearest a camera looking towards −z.
import { Vector3 } from 'three';
import type { Vec2, Vec3 } from '@tennis/engine';

export const toThree = (v: Vec3): Vector3 => new Vector3(v.x, v.z, -v.y);

export const groundToThree = (v: Vec2, height = 0): Vector3 => new Vector3(v.x, height, -v.y);

/** Rotation about Three's y axis that turns a rig's local +z (its front) towards a court-plane direction. */
export const yawFor = (facing: Vec2): number => Math.atan2(facing.x, -facing.y);
