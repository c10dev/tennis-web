// Which way the strings face (ADR-031 A1/A6): a horizontal side of the racket, turned towards the player's front. Where
// that side is square to the front (the racket pointing at the net or behind, in the vertical plane through the
// player's front), the old sign test flipped the hand half a turn about the racket for a hair's change of direction,
// moving the racket head 0.2 m in a frame.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { racketFace } from '../src/scene/strokeSolver.ts';

const forward = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);

describe('racket face', () => {
  it('is square to the racket, unit length', () => {
    for (const dir of [new Vector3(1, 0, 0), new Vector3(0.3, 0.5, 0.8).normalize(), new Vector3(0, -0.6, 0.8), new Vector3(0, 1, 0)]) {
      const f = racketFace(dir, forward);
      expect(f.length()).toBeCloseTo(1, 9);
      expect(f.dot(dir)).toBeCloseTo(0, 9);
    }
  });

  it('keeps the old rule away from that plane: the horizontal side towards the front', () => {
    const dir = new Vector3(-0.9, 0.2, 0.4).normalize();
    const side = UP.clone().cross(dir);
    if (side.dot(forward) < 0) side.negate();
    side.addScaledVector(dir, -side.dot(dir)).normalize();
    expect(racketFace(dir, forward).distanceTo(side)).toBeLessThan(1e-9);
  });

  // Only a racket pointing exactly at the front (or straight back) has no face to keep: every rule flips somewhere.
  it('turns smoothly as the racket sweeps through the plane of the player’s front, above or below level', () => {
    for (const tilt of [-0.6, -0.2, 0.2, 0.45]) {
      let prev: Vector3 | null = null;
      for (let k = -50; k <= 50; k++) {
        const dir = new Vector3(k / 500, tilt, 0.8).normalize();
        const f = racketFace(dir, forward);
        if (prev) expect(f.angleTo(prev), `tilt ${tilt}, x ${k / 500}`).toBeLessThan(0.1);
        prev = f;
      }
    }
  });
});
