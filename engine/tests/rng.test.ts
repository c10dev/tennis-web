import { describe, expect, it } from 'vitest';
import { chance, createRng, deriveSeed, range, weightedIndex } from '../src/rng/mulberry32.ts';

describe('createRng (mulberry32)', () => {
  it('matches the reference mulberry32 sequence for seed 42', () => {
    const rng = createRng(42);
    const values = Array.from({ length: 5 }, () => rng.next());
    expect(values).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423,
    ]);
  });

  it('repeats the same sequence for the same seed', () => {
    const a = createRng(123456);
    const b = createRng(123456);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const same = Array.from({ length: 100 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBeLessThan(3);
  });

  it('stays in [0, 1) with a mean near 0.5', () => {
    const rng = createRng(7);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(Math.abs(sum / 100_000 - 0.5)).toBeLessThan(0.01);
  });

  it('exposes its state so a run can be fingerprinted', () => {
    const a = createRng(9);
    const b = createRng(9);
    a.next();
    expect(a.state()).not.toBe(b.state());
    b.next();
    expect(a.state()).toBe(b.state());
  });

  it('accepts any number as a seed by truncating it to uint32', () => {
    expect(createRng(2 ** 32 + 5).next()).toBe(createRng(5).next());
    expect(createRng(-1).next()).toBe(createRng(0xffffffff).next());
  });
});

describe('deriveSeed', () => {
  it('depends only on the base seed and the index, not on call order', () => {
    const forward = [0, 1, 2, 3].map((i) => deriveSeed(42, i));
    const backward = [3, 2, 1, 0].map((i) => deriveSeed(42, i)).reverse();
    expect(forward).toEqual(backward);
  });

  it('returns distinct uint32 seeds', () => {
    const seeds = new Set(Array.from({ length: 10_000 }, (_, i) => deriveSeed(42, i)));
    expect(seeds.size).toBe(10_000);
    for (const s of seeds) expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
    expect(deriveSeed(42, 0)).not.toBe(deriveSeed(43, 0));
  });
});

describe('helpers', () => {
  it('chance respects the edges and the rate', () => {
    const rng = createRng(11);
    expect(chance(rng, 0)).toBe(false);
    expect(chance(rng, 1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 50_000; i++) if (chance(rng, 0.3)) hits++;
    expect(Math.abs(hits / 50_000 - 0.3)).toBeLessThan(0.01);
  });

  it('range draws inside [min, max)', () => {
    const rng = createRng(12);
    for (let i = 0; i < 1000; i++) {
      const v = range(rng, -2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });

  it('weightedIndex follows the weights and never picks a zero weight', () => {
    const rng = createRng(13);
    const counts = [0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[weightedIndex(rng, [1, 0, 3])]! += 1;
    expect(counts[1]).toBe(0);
    expect(Math.abs(counts[0]! / 60_000 - 0.25)).toBeLessThan(0.01);
  });

  it('weightedIndex rejects empty or non-positive weights', () => {
    const rng = createRng(14);
    expect(() => weightedIndex(rng, [])).toThrow();
    expect(() => weightedIndex(rng, [0, 0])).toThrow();
    expect(() => weightedIndex(rng, [1, -1])).toThrow();
  });
});
