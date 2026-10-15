import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { solveTwoBone } from '../src/scene/ik.ts';

const UPPER = 0.3;
const LOWER = 0.8;
const pole = new Vector3(0, -1, 0);

describe('solveTwoBone', () => {
  it('reaches a target in range with both bones at their lengths, the elbow bent towards the pole', () => {
    const target = new Vector3(-0.7, 0.2, 0.4);
    const { elbow, end } = solveTwoBone(target, UPPER, LOWER, pole);
    expect(end.distanceTo(target)).toBeLessThan(1e-9);
    expect(elbow.length()).toBeCloseTo(UPPER, 9);
    expect(end.distanceTo(elbow)).toBeCloseTo(LOWER, 9);
    // The elbow sits on the pole's side of the shoulder–target line.
    const dir = target.clone().normalize();
    const off = elbow.clone().sub(dir.clone().multiplyScalar(elbow.dot(dir)));
    expect(off.dot(pole)).toBeGreaterThan(0);
  });

  it('stretches straight towards a target out of reach', () => {
    const target = new Vector3(3, 0, 0);
    const { elbow, end } = solveTwoBone(target, UPPER, LOWER, pole);
    expect(end.x).toBeCloseTo(UPPER + LOWER, 2);
    expect(end.y).toBeCloseTo(0, 9);
    expect(elbow.length()).toBeCloseTo(UPPER, 9);
  });

  it('stops short of folding flat for a target too close', () => {
    const { elbow, end } = solveTwoBone(new Vector3(0.1, 0, 0), UPPER, LOWER, pole);
    expect(end.length()).toBeGreaterThan(LOWER - UPPER);
    expect(end.distanceTo(elbow)).toBeCloseTo(LOWER, 9);
  });

  it('stays finite when the pole lies along the target direction', () => {
    const { elbow, end } = solveTwoBone(new Vector3(0, -0.9, 0), UPPER, LOWER, pole);
    for (const v of [elbow, end]) for (const c of v.toArray()) expect(Number.isFinite(c)).toBe(true);
    expect(end.y).toBeCloseTo(-0.9, 9);
  });
});
