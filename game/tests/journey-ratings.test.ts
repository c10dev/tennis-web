import { describe, expect, it } from 'vitest';
import { overall } from '../src/player/overall.ts';
import { applyGain, candidates, GROUPS, groupValues, ovr, trueLevel } from '../src/journey/ratings.ts';

const input = { name: '김테니', nation: 'KOR' as const, style: 'baseliner' as const };

describe('journey ratings', () => {
  it('offers three candidates at OVR 45 whose groups differ', () => {
    const list = candidates(1, input);
    expect(list).toHaveLength(3);
    for (const c of list) {
      expect(ovr(c)).toBe(45);
      expect(c.age).toBe(14);
      expect(c.name).toBe('김테니');
      expect(c.potential).toBeGreaterThan(overall(c));
    }
    const shapes = list.map((c) => JSON.stringify(groupValues(c)));
    expect(new Set(shapes).size).toBe(3);
  });

  it('shows six groups on a 0–100 scale', () => {
    const g = groupValues(candidates(2, input)[0]!);
    expect(Object.keys(g)).toEqual([...GROUPS]);
    for (const v of Object.values(g)) expect(v).toBeGreaterThan(20);
    for (const v of Object.values(g)) expect(v).toBeLessThan(70);
  });

  it('is deterministic for a seed', () => {
    expect(candidates(5, input)).toEqual(candidates(5, input));
    expect(candidates(5, input)).not.toEqual(candidates(6, input));
  });

  it('turns a gain in overall into ratings, more of it in the focused groups', () => {
    const p = candidates(3, input)[0]!;
    const before = groupValues(p);
    // Ratings are whole numbers: progress carries over, so a gain shows in full once it adds up.
    let after = p;
    for (let i = 0; i < 6; i++) after = applyGain(after, 0.5, ['serve']);
    expect(trueLevel(after) - trueLevel(p)).toBeCloseTo(3, 5);
    expect(overall(after) - overall(p)).toBeGreaterThan(1.5);
    const g = groupValues(after);
    expect(g.serve - before.serve).toBeGreaterThan(g.forehand - before.forehand);
    expect(p).toEqual(candidates(3, input)[0]);
  });

  it('takes a loss from every group alike', () => {
    const p = candidates(3, input)[1]!;
    let after = p;
    for (let i = 0; i < 4; i++) after = applyGain(after, -0.5, ['serve']);
    expect(trueLevel(after) - trueLevel(p)).toBeCloseTo(-2, 5);
  });
});
