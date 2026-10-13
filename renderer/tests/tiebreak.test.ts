import { describe, expect, it } from 'vitest';
import { averagePlayer, bigServer, createConfig, simulateMatch } from '@tennis/engine';
import { buildTimeline, scoreAt } from '../src/playback/timeline.ts';
import { scoreBugModel } from '../src/overlay/scoreBug.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import type { PointEvent } from '@tennis/engine';

const result = simulateMatch(createConfig([bigServer('Flint'), averagePlayer('Rook')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } }), 4);

describe('one-tiebreak matches (schema v5)', () => {
  it('lays out a v5 match and shows tiebreak counts on the score bug from the first point', () => {
    expect(result.schemaVersion).toBe(5);
    const tl = buildTimeline(result);
    expect(tl.complete).toBe(true);
    const first = scoreBugModel(scoreAt(tl, 0), tl.names, { noAd: tl.noAd, winner: null });
    expect(first.tiebreak).toBe(true);
    expect(first.rows.map((r) => r.points)).toEqual(['0', '0']);
    expect(tl.segments.at(-1)!.gap).toBe('match_end');
  });

  it('builds a programme for it', () => {
    expect(buildProgramme(buildTimeline(result), 'key').totalSec).toBeGreaterThan(0);
  });

  it('has no games column, and shows the tiebreak count as the set once it is over (TD-029)', () => {
    const tl = buildTimeline(result);
    expect(tl.tiebreakOnly).toBe(true);
    const during = matchFrameAt(tl, tl.segments[2]!.zero).scoreBug;
    expect(during.rows.map((r) => r.games)).toEqual([null, null]);
    expect(during.tiebreak).toBe(true);
    const last = result.events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;
    const count: [number, number] = [last.scoreBefore.points[0] + (last.winner === 'A' ? 1 : 0), last.scoreBefore.points[1] + (last.winner === 'B' ? 1 : 0)];
    const end = matchFrameAt(tl, tl.totalSec).scoreBug;
    expect(end.final).toBe(true);
    expect(end.rows.map((r) => r.sets)).toEqual([[count[0]], [count[1]]]);
    expect(tl.finalScore!.sets).toEqual([count]);
  });

  it('keeps the games column for other formats', () => {
    const tl = buildTimeline(simulateMatch(createConfig([bigServer('Flint'), averagePlayer('Rook')]), 4));
    expect(tl.tiebreakOnly).toBe(false);
    expect(matchFrameAt(tl, tl.segments[2]!.zero).scoreBug.rows[0].games).not.toBeNull();
  });
});
