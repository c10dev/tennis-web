import { describe, expect, it } from 'vitest';
import { overall } from '../src/player/overall.ts';
import { createRoster, filler, turnOver } from '../src/journey/world.ts';
import { WORLD_J } from '../src/journey/tuning.ts';

describe('journey world', () => {
  const r = createRoster(1, '김테니');

  it('starts with a pool of named pros spread from the top down and four junior cohorts', () => {
    expect(r.pros).toHaveLength(WORLD_J.pros);
    expect(r.juniors).toHaveLength(WORLD_J.cohort * 4);
    const levels = r.pros.map(overall).sort((a, b) => b - a);
    expect(levels[0]).toBeGreaterThan(16.8);
    expect(levels[0]).toBeLessThan(18.6);
    expect(levels[99]).toBeGreaterThan(13.8);
    expect(levels[99]).toBeLessThan(15.4);
    for (const age of [14, 15, 16, 17]) expect(r.juniors.filter((p) => p.age === age)).toHaveLength(WORLD_J.cohort);
    const names = [...r.pros, ...r.juniors].map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('김테니');
  });

  it('gives every player room to grow, juniors the most', () => {
    for (const p of [...r.pros, ...r.juniors]) expect(p.potential).toBeGreaterThanOrEqual(Math.round(overall(p) * 10) / 10 - 0.05);
    const gap = (ps: typeof r.pros) => ps.reduce((a, p) => a + p.potential - overall(p), 0) / ps.length;
    expect(gap(r.juniors)).toBeGreaterThan(gap(r.pros) + 1);
  });

  it('ages everyone a year, retires older pros, turns the best 17-year-olds pro and brings in a new cohort', () => {
    const rank = r.pros.map((p) => p.id);
    const juniorRank = r.juniors.map((p) => p.id);
    const { roster, retired } = turnOver(r, 1, 1, rank, juniorRank, '김테니');
    expect(retired.length).toBeGreaterThan(3);
    for (const p of retired) expect(p.age).toBeGreaterThanOrEqual(WORLD_J.retire.from - 1);
    const graduates = roster.pros.filter((p) => r.juniors.some((j) => j.id === p.id));
    expect(graduates).toHaveLength(WORLD_J.graduates);
    for (const p of graduates) expect(p.age).toBe(18);
    expect(roster.juniors.filter((p) => p.age === 14)).toHaveLength(WORLD_J.cohort);
    expect(roster.juniors.some((p) => p.age === 18)).toBe(false);
    expect(roster.pros.length).toBeLessThanOrEqual(WORLD_J.maxPros);
    // Ids go to the new cohort and to the newcomers who top the pool up.
    const newcomers = roster.pros.filter((p) => !r.pros.some((q) => q.id === p.id) && !r.juniors.some((j) => j.id === p.id)).length;
    expect(roster.nextId).toBe(r.nextId + WORLD_J.cohort + newcomers);
    expect(roster.pros.length).toBeGreaterThanOrEqual(WORLD_J.pros);
  });

  it('is deterministic', () => {
    expect(createRoster(1, '김테니')).toEqual(r);
    expect(filler(3, 'perth-f/1/0', 5, 12, 22)).toEqual(filler(3, 'perth-f/1/0', 5, 12, 22));
    expect(Math.abs(overall(filler(3, 'x', 1, 12, 22)) - 12)).toBeLessThan(1.2);
  });
});
