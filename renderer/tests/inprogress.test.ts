import { describe, expect, it } from 'vitest';
import { advance, exhibitionConfig, simulateMatch, startMatch, type MatchResult } from '@tennis/engine';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline, scoreAt, type ReplayInput } from '../src/playback/timeline.ts';

const config = exhibitionConfig('hard');
const full = simulateMatch(config, 21);
const live = startMatch(config, 21);
advance(live, 'set');
const firstSet: ReplayInput = { schemaVersion: 3, config: live.config, events: [...live.events] };

describe('replays of schema v2 to v5', () => {
  it('plays them, and refuses anything else', () => {
    expect(() => buildTimeline({ ...full, schemaVersion: 2 } as unknown as MatchResult)).not.toThrow();
    expect(() => buildTimeline(full)).not.toThrow();
    expect(() => buildTimeline({ ...full, schemaVersion: 6 } as unknown as MatchResult)).toThrow(/schema version 6/);
  });
});

describe('a match still in progress', () => {
  const partial = buildTimeline(firstSet);
  const whole = buildTimeline(full);

  it('lays out the points played so far exactly as the finished match does', () => {
    expect(partial.complete).toBe(false);
    expect(partial.winner).toBeNull();
    expect(whole.complete).toBe(true);
    expect(partial.segments.length).toBeGreaterThan(5);
    expect(partial.segments).toEqual(whole.segments.slice(0, partial.segments.length));
    expect(partial.totalSec).toBe(whole.segments[partial.segments.length - 1]!.next);
  });

  it('ends on the score after the last point, not on a result', () => {
    const last = partial.segments.at(-1)!;
    expect(scoreAt(partial, partial.totalSec)).toEqual(last.point.scoreAfter);
    expect(matchFrameAt(partial, partial.totalSec).scoreBug.final).toBe(false);
  });

  it('builds a programme whose timing is a prefix of the finished match\'s, so playback can carry on', () => {
    const p = buildProgramme(partial, 'full');
    const q = buildProgramme(whole, 'full');
    for (let t = 0; t < p.totalSec; t += 3.7) {
      const a = broadcastFrameAt(p, t);
      const b = broadcastFrameAt(q, t);
      expect(a.matchT).toBeCloseTo(b.matchT, 9);
      expect(a.pointIndex).toBe(b.pointIndex);
      expect(a.clip).toBe(b.clip);
    }
  });
});

describe('a match growing one point at a time (quick match, schema v4)', () => {
  it('keeps the timing of everything already shown as each point is added', async () => {
    const { createConfig, averagePlayer } = await import('@tennis/engine');
    const config = createConfig([averagePlayer('Ann'), averagePlayer('Bea')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' } });
    const live = startMatch(config, 6);
    let previous: ReturnType<typeof buildProgramme> | null = null;
    for (let i = 0; i < 12; i++) {
      advance(live, 'point', { cards: { A: 'attack', B: 'defend' } });
      const p = buildProgramme(buildTimeline({ schemaVersion: 4, config: live.config, events: [...live.events] }), 'full');
      if (previous) {
        for (let t = 0; t < previous.totalSec - 3; t += 1.3) {
          expect(broadcastFrameAt(p, t).matchT).toBeCloseTo(broadcastFrameAt(previous, t).matchT, 9);
        }
      }
      previous = p;
    }
  });
});
