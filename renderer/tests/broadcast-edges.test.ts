import { describe, expect, it } from 'vitest';
import { createConfig, exhibitionConfig, simulateMatch, type MatchConfig, type MatchResult } from '@tennis/engine';
import { allCues, crowdIntensity } from '../src/audio/cues.ts';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { selectPoints } from '../src/broadcast/modes.ts';
import { buildProgramme, programmeTimeFor } from '../src/broadcast/programme.ts';
import { overlayAt } from '../src/overlay/overlays.ts';
import { buildTimeline } from '../src/playback/timeline.ts';

// Edge cases a bug hunt found (2026-10-14): the end of a programme, one-tiebreak matches, Fast4 sudden death, cuts.
const config = (rules: MatchConfig['rules']): MatchConfig => ({ ...exhibitionConfig('hard'), rules });
const tiebreakOnly = (seed: number) => simulateMatch(config({ bestOf: 3, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' }), seed);
const fast4 = (seed: number) => simulateMatch(config({ bestOf: 3, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' }), seed);

describe('programmeTimeFor', () => {
  it('maps the very end of the match to the end of the last live clip, not to the start', () => {
    const tl = buildTimeline(simulateMatch(createConfig(exhibitionConfig('clay').players), 1));
    for (const mode of ['full', 'key', 'highlights'] as const) {
      const p = buildProgramme(tl, mode);
      const last = p.clips.filter((c) => c.kind === 'live').at(-1)!;
      expect(programmeTimeFor(p, tl.totalSec), mode).toBeCloseTo(last.start + last.duration, 6);
    }
  });
});

describe('one-tiebreak matches (setFormat tiebreak)', () => {
  const tl = buildTimeline(tiebreakOnly(4));

  it('picks key points by stakes, not by the tiebreak tag every point carries', () => {
    const key = selectPoints(tl, 'key');
    expect(key.length).toBeLessThan(tl.segments.length / 2);
    for (const i of tl.segments.keys()) if (tl.segments[i]!.point.tags.some((t) => t === 'set_point' || t === 'match_point')) expect(key).toContain(i);
  });

  it('captions only the big points, and gives the crowd no tiebreak bonus on every point', () => {
    const p = buildProgramme(tl, 'full');
    const plain = tl.segments.find((s) => !s.point.tags.some((t) => t === 'set_point' || t === 'match_point'))!;
    const t = programmeTimeFor(p, plain.zero);
    expect(overlayAt(p, broadcastFrameAt(p, t)).lowerThird).toBeNull();
    const tagged = { ...plain, point: { ...plain.point, tags: plain.point.tags.filter((x) => x !== 'tiebreak') } };
    expect(crowdIntensity(plain, true)).toBeCloseTo(crowdIntensity(tagged, true), 9);
  });
});

describe('Fast4 sudden death', () => {
  it('names the player one point from the match at 4-4, or no one when both are', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const tl = buildTimeline(fast4(seed));
      const p = buildProgramme(tl, 'full');
      for (const s of tl.segments) {
        const { tags, scoreBefore } = s.point;
        if (!scoreBefore.tiebreak || scoreBefore.points[0] !== scoreBefore.points[1] || !tags.includes('match_point')) continue;
        const won = (id: 0 | 1) => scoreBefore.sets.filter(([a, b]) => (id === 0 ? a > b : b > a)).length;
        const holders = ([0, 1] as const).filter((id) => won(id) === 1);
        const lower = overlayAt(p, broadcastFrameAt(p, programmeTimeFor(p, s.zero))).lowerThird!;
        expect(lower.title).toBe('MATCH POINT');
        expect(lower.detail).toBe(holders.length === 1 ? tl.names[holders[0]!] : undefined);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('cues at a camera cut', () => {
  it('sounds every live bounce once', () => {
    for (const r of [simulateMatch(createConfig(exhibitionConfig('hard').players), 1), fast4(1)] as MatchResult[]) {
      const tl = buildTimeline(r);
      const live = allCues(buildProgramme(tl, 'full')).filter((c) => c.kind === 'bounce' && !c.replay);
      expect(live).toHaveLength(tl.segments.flatMap((s) => s.point.shots).filter((s) => s.bounce).length);
    }
  });
});
