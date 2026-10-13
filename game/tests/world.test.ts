import { describe, expect, it } from 'vitest';
import { createConfig, simulateMatch } from '@tennis/engine';
import { createPlayer, defaultAllocation, type NewPlayer } from '../src/player/create.ts';
import { overall } from '../src/player/overall.ts';
import { generateWorld } from '../src/world/generate.ts';
import { CREATION, WORLD } from '../src/tuning.ts';

const NEW: NewPlayer = { name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') };

describe('generateWorld', () => {
  const world = generateWorld(7, createPlayer(NEW, 7));
  const ai = world.players.filter((p) => p.id !== world.userId);

  it('is the same world for the same seed, and another for another seed', () => {
    expect(generateWorld(7, createPlayer(NEW, 7))).toEqual(world);
    expect(generateWorld(8, createPlayer(NEW, 8))).not.toEqual(world);
  });

  it('has 64 players with unique ids and names, the user among them', () => {
    expect(world.players).toHaveLength(WORLD.size);
    expect(new Set(world.players.map((p) => p.id)).size).toBe(WORLD.size);
    expect(new Set(world.players.map((p) => p.name)).size).toBe(WORLD.size);
    expect(world.players.find((p) => p.id === world.userId)!.name).toBe('Alex Kim');
  });

  it('spreads AI ability around a tour average of 13, ages 18 to 34', () => {
    const levels = ai.map(overall);
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const sd = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length);
    expect(mean).toBeGreaterThan(12.5);
    expect(mean).toBeLessThan(13.5);
    expect(sd).toBeGreaterThan(1);
    expect(sd).toBeLessThan(1.8);
    for (const p of ai) {
      expect(p.age).toBeGreaterThanOrEqual(18);
      expect(p.age).toBeLessThanOrEqual(34);
      for (const [k, v] of Object.entries(p.attributes)) {
        if (k === 'surfaceAffinity') continue;
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      }
      if (p.age <= 23) expect(p.potential).toBeGreaterThan(overall(p));
    }
  });

  it('makes players the engine can play', () => {
    const [a, b] = ai;
    expect(() => simulateMatch(createConfig([a!, b!]), 1)).not.toThrow();
  });
});

describe('createPlayer', () => {
  it('is an 18-year-old prospect whose ratings are the style template plus the allocation', () => {
    const p = createPlayer(NEW, 3);
    expect(p.age).toBe(18);
    expect(p.style).toBe('baseliner');
    expect(p.potential).toBeGreaterThanOrEqual(CREATION.potential[0]);
    expect(p.potential).toBeLessThanOrEqual(CREATION.potential[1]);
    expect(p.attributes.forehand).toBe(NEW.allocation.forehand);
  });

  it('starts around 40th in the world with the suggested allocation', () => {
    for (const style of ['big_server', 'baseliner', 'counter_puncher', 'all_court'] as const) {
      const player = createPlayer({ name: 'Alex Kim', style, allocation: defaultAllocation(style) }, 5);
      const world = generateWorld(5, player);
      const rank = [...world.players].sort((x, y) => overall(y) - overall(x)).findIndex((x) => x.id === world.userId) + 1;
      expect(rank).toBeGreaterThanOrEqual(30);
      expect(rank).toBeLessThanOrEqual(52);
    }
  });

  it('keeps every rating inside its range and the total inside the budget', () => {
    const a = defaultAllocation('all_court');
    const spent = Object.values(a).reduce((x, y) => x + y, 0);
    expect(spent).toBeLessThanOrEqual(CREATION.budget);
    expect(() => createPlayer({ ...NEW, allocation: { ...a, forehand: CREATION.max + 1 } }, 1)).toThrow(/forehand/);
    expect(() => createPlayer({ ...NEW, allocation: { ...a, return: CREATION.min - 1 } }, 1)).toThrow(/return/);
    const raised = Object.entries(a).filter(([, v]) => v < CREATION.max).slice(0, 8).map(([k, v]) => [k, v + 1]);
    const over = { ...a, ...Object.fromEntries(raised) };
    expect(() => createPlayer({ ...NEW, allocation: over }, 1)).toThrow(/budget/);
    expect(() => createPlayer({ ...NEW, name: '  ' }, 1)).toThrow(/name/);
  });
});

describe('overall', () => {
  it('is 13 for a player rated 13 everywhere, and rises with any rating that counts', () => {
    const p = createPlayer(NEW, 1);
    const flat = { ...p, attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, k === 'surfaceAffinity' ? v : 13])) as typeof p.attributes };
    expect(overall(flat)).toBeCloseTo(13, 9);
    expect(overall({ ...flat, attributes: { ...flat.attributes, forehand: 16 } })).toBeGreaterThan(13);
    expect(overall({ ...flat, attributes: { ...flat.attributes, volley: 20 } })).toBeCloseTo(13, 9);
  });
});
