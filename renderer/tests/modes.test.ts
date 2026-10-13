import { describe, expect, it } from 'vitest';
import { selectPoints } from '../src/broadcast/modes.ts';
import { buildTimeline, type PointSegment } from '../src/playback/timeline.ts';
import { BROADCAST } from '../src/tuning/index.ts';
import { SAMPLE } from './fixtures.ts';

const isKey = (s: PointSegment) =>
  s.endsGame || s.point.tags.some((t) => t === 'break_point' || t === 'set_point' || t === 'match_point' || t === 'tiebreak');

describe('selectPoints (GDD §8.5 viewing modes)', () => {
  for (const r of SAMPLE.slice(0, 3)) {
    const tl = buildTimeline(r);
    const all = tl.segments.map((_, i) => i);

    it(`full plays every point (seed ${r.seed})`, () => {
      expect(selectPoints(tl, 'full')).toEqual(all);
    });

    it(`key points are exactly the big points and the points that end games (seed ${r.seed})`, () => {
      expect(selectPoints(tl, 'key')).toEqual(all.filter((i) => isKey(tl.segments[i]!)));
      expect(selectPoints(tl, 'key').length).toBeLessThan(all.length);
    });

    it(`highlights add whole break games, long rallies and winners after a rally (seed ${r.seed})`, () => {
      const picked = new Set(selectPoints(tl, 'highlights'));
      for (const i of selectPoints(tl, 'key')) expect(picked.has(i)).toBe(true);
      let gameStart = 0;
      tl.segments.forEach((s, i) => {
        const p = s.point;
        if (p.rallyLength >= BROADCAST.longRally) expect(picked.has(i)).toBe(true);
        if (p.endedBy === 'winner' && p.rallyLength >= BROADCAST.winnerRally) expect(picked.has(i)).toBe(true);
        if (s.endsGame) {
          if (s.isBreak) for (let k = gameStart; k <= i; k++) expect(picked.has(k)).toBe(true);
          gameStart = i + 1;
        }
      });
      expect(picked.size).toBeLessThan(all.length);
      expect([...picked]).toEqual([...picked].sort((a, b) => a - b));
    });

    it(`result only plays no points (seed ${r.seed})`, () => {
      expect(selectPoints(tl, 'result')).toEqual([]);
    });
  }
});
