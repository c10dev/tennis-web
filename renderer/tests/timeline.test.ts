import { describe, expect, it } from 'vitest';
import type { MatchResult, PointEvent } from '@tennis/engine';
import { buildTimeline, scoreAt, segmentAt } from '../src/playback/timeline.ts';
import { PLAYBACK } from '../src/tuning/index.ts';
import { SAMPLE, match } from './fixtures.ts';

const pointsOf = (r: MatchResult) => r.events.filter((e): e is PointEvent => e.type === 'point');

describe('buildTimeline', () => {
  it('has one segment per point, in order, each starting with the toss before the first serve', () => {
    for (const r of SAMPLE) {
      const tl = buildTimeline(r);
      const points = pointsOf(r);
      expect(tl.segments.map((s) => s.point)).toEqual(points);
      expect(tl.segments[0]!.start).toBe(0);
      for (const s of tl.segments) {
        expect(s.zero).toBeCloseTo(s.start + PLAYBACK.tossLeadSec, 9);
        expect(s.end).toBeCloseTo(s.zero + s.point.durationSec, 9);
        expect(s.next).toBeGreaterThan(s.end);
      }
      for (let i = 1; i < tl.segments.length; i++) expect(tl.segments[i]!.start).toBe(tl.segments[i - 1]!.next);
      expect(tl.totalSec).toBe(tl.segments.at(-1)!.next);
    }
  });

  it('pauses longer for a changeover and longest at the end of a set, then holds the final score', () => {
    const r = match(3);
    const tl = buildTimeline(r);
    const kinds = new Set<string>();
    tl.segments.forEach((s) => {
      const i = r.events.indexOf(s.point);
      const after: string[] = [];
      for (let j = i + 1; j < r.events.length && r.events[j]!.type !== 'point'; j++) after.push(r.events[j]!.type);
      const expected = after.includes('match_end') ? 'match_end' : after.includes('set_end') ? 'set_end'
        : after.includes('changeover') ? 'changeover' : 'point';
      expect(s.gap).toBe(expected);
      kinds.add(expected);
      const gaps = { point: PLAYBACK.pointGapSec, changeover: PLAYBACK.changeoverSec, set_end: PLAYBACK.setEndSec, match_end: PLAYBACK.matchEndHoldSec };
      expect(s.next - s.end).toBeCloseTo(gaps[s.gap], 9);
    });
    expect([...kinds].sort()).toEqual(['changeover', 'match_end', 'point', 'set_end']);
  });

  it('marks the points that end a game, those that break serve, and where each point starts', () => {
    const r = match(3);
    const tl = buildTimeline(r);
    tl.segments.forEach((s) => {
      const i = r.events.indexOf(s.point);
      const gameEnd = r.events.slice(i + 1).find((e, k, rest) => e.type === 'game_end' && rest.slice(0, k).every((x) => x.type !== 'point'));
      expect(s.endsGame).toBe(gameEnd !== undefined);
      expect(s.isBreak).toBe(gameEnd?.type === 'game_end' && gameEnd.isBreak);
    });
    expect(tl.segments.some((s) => s.isBreak)).toBe(true);
    expect(tl.pointStarts).toEqual(tl.segments.map((s) => s.start));
  });

  it('keeps names and surface for the overlays', () => {
    const tl = buildTimeline(match(2, 'grass'));
    expect(tl.names).toEqual(['Flint', 'Rook']);
    expect(tl.surface).toBe('grass');
  });

  it('rejects replays written with another schema version', () => {
    const old = { ...match(1), schemaVersion: 1 } as unknown as MatchResult;
    expect(() => buildTimeline(old)).toThrow(/schema version 1.*expects 2/);
  });

  it('plays a replay loaded from JSON, without the engine', () => {
    const r = match(1);
    const loaded = JSON.parse(JSON.stringify(r)) as MatchResult;
    expect(buildTimeline(loaded).totalSec).toBe(buildTimeline(r).totalSec);
  });
});

describe('segmentAt', () => {
  const tl = buildTimeline(match(1));

  it('finds the segment whose span contains t, boundaries belonging to the later segment', () => {
    tl.segments.forEach((s, i) => {
      expect(segmentAt(tl, s.start)).toBe(i);
      expect(segmentAt(tl, (s.start + s.next) / 2)).toBe(i);
      if (i > 0) expect(segmentAt(tl, s.start - 1e-6)).toBe(i - 1);
    });
  });

  it('clamps times outside the match', () => {
    expect(segmentAt(tl, -5)).toBe(0);
    expect(segmentAt(tl, tl.totalSec + 5)).toBe(tl.segments.length - 1);
  });
});

describe('scoreAt', () => {
  const r = match(4);
  const tl = buildTimeline(r);

  it('shows the score before the point while it is played and the score after it during the pause', () => {
    for (const s of tl.segments.slice(0, 40)) {
      expect(scoreAt(tl, s.start)).toEqual(s.point.scoreBefore);
      expect(scoreAt(tl, s.end - 1e-6)).toEqual(s.point.scoreBefore);
      expect(scoreAt(tl, s.end)).toEqual(s.point.scoreAfter);
      expect(scoreAt(tl, s.next - 1e-6)).toEqual(s.point.scoreAfter);
    }
  });

  it('shows the final score after the last point and at the very end', () => {
    const final = r.events.at(-1)!;
    if (final.type !== 'match_end') throw new Error('no match_end');
    expect(scoreAt(tl, tl.totalSec)).toEqual(final.score);
    expect(scoreAt(tl, tl.segments.at(-1)!.end)).toEqual(final.score);
  });
});
