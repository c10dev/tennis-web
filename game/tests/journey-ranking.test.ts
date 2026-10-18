import { describe, expect, it } from 'vitest';
import { estimateRank, rankOf, recordSwing, total } from '../src/journey/ranking.ts';
import { createRoster } from '../src/journey/world.ts';

describe('journey ranking', () => {
  const { pros } = createRoster(1, 'me');
  const me = { ...pros[0]!, id: 'user', name: 'me' };
  const points: Record<string, number[]> = Object.fromEntries(pros.map((p, i) => [p.id, [1000 - i * 5, 0, 0, 0]]));

  it('sums the last four swings and replaces a slot a year on', () => {
    let pts = recordSwing({}, 0, new Map([['a', 100]]), ['a', 'b']);
    expect(pts).toEqual({ a: [100, 0, 0, 0] });
    pts = recordSwing(pts, 1, new Map([['a', 50]]), ['a']);
    expect(total(pts.a)).toBe(150);
    pts = recordSwing(pts, 0, new Map([['a', 10]]), ['a']);
    expect(pts.a).toEqual([10, 50, 0, 0]);
    expect(recordSwing(pts, 1, new Map(), ['a']).a).toEqual([10, 0, 0, 0]);
  });

  it('ranks the user among the pool, unranked with no points, estimated below it', () => {
    expect(rankOf(me, pros, points)).toBeNull();
    expect(rankOf(me, pros, { ...points, user: [998, 0, 0, 0] })).toBe(2);
    const low = rankOf(me, pros, { ...points, user: [10, 0, 0, 0] })!;
    expect(low).toBeGreaterThan(pros.length);
    expect(low).toBe(estimateRank(10));
    expect(estimateRank(10)).toBeGreaterThan(1000);
    expect(estimateRank(200)).toBeLessThan(320);
  });
});
