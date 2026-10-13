// Seeded randomness for the engine. Every random draw in a match goes through one Rng passed in by the caller,
// so the same seed and input always produce the same events (GDD §5.3).

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Internal uint32 state, for fingerprinting a run. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => a,
  };
}

/** Seed of the index-th run derived from a base seed (splitmix32 mix), independent of the order runs are made. */
export function deriveSeed(baseSeed: number, index: number): number {
  let z = ((baseSeed >>> 0) + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}

export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) {
    if (!(w >= 0)) throw new RangeError('Weights must be non-negative');
    total += w;
  }
  if (!(total > 0)) throw new RangeError('At least one weight must be positive');
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return i;
  }
  // Floating-point remainder: return the last positive weight.
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i]! > 0) return i;
  throw new RangeError('unreachable');
}
