// Closed-form two-bone inverse kinematics (law of cosines): pure, so a pose stays a function of replay time (ADR-007).
import { Vector3 } from 'three';
import { clamp } from '../math.ts';

/** Keeps the chain from locking straight or folding flat, where the elbow direction is undefined. */
const SLACK = 1e-3;
const FALLBACK_POLES = [new Vector3(0, 0, -1), new Vector3(1, 0, 0)];

/**
 * Elbow and end positions for a chain rooted at the origin reaching for `target`: an upper bone, then a lower one,
 * bent towards `pole`. A target out of range is reached as far as the chain allows, along the same direction.
 */
export function solveTwoBone(target: Vector3, upper: number, lower: number, pole: Vector3): { elbow: Vector3; end: Vector3 } {
  const dir = target.lengthSq() > 1e-12 ? target.clone().normalize() : pole.clone().normalize();
  const d = clamp(target.length(), Math.abs(upper - lower) + SLACK, upper + lower - SLACK);
  const cos = clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1);
  const sin = Math.sqrt(1 - cos * cos);
  let side = perpendicular(pole, dir);
  for (const p of FALLBACK_POLES) if (side.lengthSq() < 1e-6) side = perpendicular(p, dir);
  side.normalize();
  const elbow = dir.clone().multiplyScalar(upper * cos).addScaledVector(side, upper * sin);
  return { elbow, end: dir.clone().multiplyScalar(d) };
}

/** The part of `v` at right angles to the unit vector `dir`. */
const perpendicular = (v: Vector3, dir: Vector3): Vector3 => v.clone().addScaledVector(dir, -v.dot(dir));
