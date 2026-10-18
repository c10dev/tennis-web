import { describe, expect, it } from 'vitest';
import { overall } from '../src/player/overall.ts';
import { applyGain, checkTalents, createPro, GROUPS, groupValues, ovr, trueLevel } from '../src/journey/ratings.ts';
import { CREATE } from '../src/journey/tuning.ts';

const input = { name: '김테니', nation: 'KOR' as const, style: 'baseliner' as const };

describe('journey ratings', () => {
  it('starts everyone in a room at the same age, OVR and potential, shaped by talent points', () => {
    const serve = createPro(input, { serve: 6, return: 4 });
    const mind = createPro(input, { mental: 5, backhand: 5 });
    for (const p of [serve, mind]) {
      expect(ovr(p)).toBe(CREATE.ovr);
      expect(p.age).toBe(CREATE.age);
      expect(p.potential).toBe(CREATE.potential);
    }
    expect(groupValues(serve).serve).toBeGreaterThan(groupValues(mind).serve + 5);
    expect(groupValues(mind).mental).toBeGreaterThan(groupValues(serve).mental + 3);
    expect(createPro(input, { serve: 6, return: 4 })).toEqual(serve);
  });

  it('takes at most ten whole, non-negative points', () => {
    expect(() => checkTalents({ serve: 11 })).toThrow();
    expect(() => checkTalents({ serve: 6, return: 5 })).toThrow();
    expect(() => checkTalents({ serve: -1 })).toThrow();
    expect(() => checkTalents({ serve: 1.5 })).toThrow();
    expect(() => checkTalents({})).not.toThrow();
  });

  it('shows six groups on a 0–100 scale', () => {
    const g = groupValues(createPro(input, {}));
    expect(Object.keys(g)).toEqual([...GROUPS]);
    for (const v of Object.values(g)) expect(v).toBeGreaterThan(40);
    for (const v of Object.values(g)) expect(v).toBeLessThan(90);
  });

  it('turns a gain in overall into ratings, more of it in the focused groups', () => {
    const p = createPro(input, { forehand: 5, return: 5 });
    const before = groupValues(p);
    // Ratings are whole numbers: progress carries over, so a gain shows in full once it adds up.
    let after = p;
    for (let i = 0; i < 6; i++) after = applyGain(after, 0.5, ['serve']);
    expect(trueLevel(after) - trueLevel(p)).toBeCloseTo(3, 5);
    expect(overall(after) - overall(p)).toBeGreaterThan(1.5);
    const g = groupValues(after);
    expect(g.serve - before.serve).toBeGreaterThan(g.forehand - before.forehand);
  });

  it('takes a loss from every group alike', () => {
    const p = createPro(input, { physical: 10 });
    let after = p;
    for (let i = 0; i < 4; i++) after = applyGain(after, -0.5, ['serve']);
    expect(trueLevel(after) - trueLevel(p)).toBeCloseTo(-2, 5);
  });
});
