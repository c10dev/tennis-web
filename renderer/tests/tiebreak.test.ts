import { describe, expect, it } from 'vitest';
import { averagePlayer, bigServer, createConfig, simulateMatch } from '@tennis/engine';
import { buildTimeline, scoreAt } from '../src/playback/timeline.ts';
import { scoreBugModel } from '../src/overlay/scoreBug.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';

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
});
