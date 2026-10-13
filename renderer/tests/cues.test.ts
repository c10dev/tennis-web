import { describe, expect, it } from 'vitest';
import { allCues, crowdIntensity, cuesBetween, type Cue } from '../src/audio/cues.ts';
import { scoreCall } from '../src/audio/calls.ts';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { AUDIO } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(3, 'clay'));
const p = buildProgramme(tl, 'full');
const cues = allCues(p);

describe('allCues', () => {
  it('is sorted by programme time', () => {
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.at).toBeGreaterThanOrEqual(cues[i - 1]!.at);
  });

  it('strikes a hit exactly when each live shot is played, and a bounce when it lands', () => {
    const hits = cues.filter((c): c is Extract<Cue, { kind: 'hit' }> => c.kind === 'hit' && !c.replay);
    const shots = tl.segments.flatMap((s) => s.point.shots);
    expect(hits).toHaveLength(shots.length);
    for (const h of hits.slice(0, 200)) {
      const f = broadcastFrameAt(p, h.at);
      const seg = tl.segments[f.pointIndex]!;
      expect(seg.point.shots.some((s) => Math.abs(seg.zero + s.t - f.matchT) < 1e-6 && s.speedKmh === h.speedKmh)).toBe(true);
    }
    const bounces = cues.filter((c) => c.kind === 'bounce' && !c.replay);
    expect(bounces).toHaveLength(shots.filter((s) => s.bounce).length);
    expect(cues.filter((c) => c.kind === 'net' && !c.replay)).toHaveLength(shots.filter((s) => !s.bounce).length);
  });

  it('has the umpire call faults, outs and the score after every point', () => {
    const calls = cues.filter((c): c is Extract<Cue, { kind: 'call' }> => c.kind === 'call');
    const shots = tl.segments.flatMap((s) => s.point.shots);
    const faults = shots.filter((s) => (s.outcome === 'fault' || s.outcome === 'double_fault') && s.bounce).length;
    expect(calls.filter((c) => c.text === 'Fault')).toHaveLength(faults);
    const outs = shots.filter((s) => (s.outcome === 'unforced_error' || s.outcome === 'forced_error') && s.bounce).length;
    expect(calls.filter((c) => c.text === 'Out')).toHaveLength(outs);
    const scores = calls.filter((c) => c.text !== 'Fault' && c.text !== 'Out').map((c) => c.text);
    expect(scores).toEqual(tl.segments.map((s) => scoreCall(s.point.scoreAfter, {
      server: s.point.server, winner: s.point.winner, endsGame: s.endsGame, gap: s.gap, noAd: tl.noAd,
    }, tl.names)));
  });

  it('replays the hits and bounces of a replay at its pace, without the umpire or the crowd', () => {
    const replay = p.clips.find((c) => c.kind === 'replay')!;
    const inside = cues.filter((c) => c.at >= replay.start && c.at < replay.start + replay.duration);
    expect(inside.some((c) => c.kind === 'hit')).toBe(true);
    expect(inside.every((c) => (c.kind === 'hit' || c.kind === 'bounce' || c.kind === 'net') && c.replay)).toBe(true);
  });
});

describe('crowdIntensity', () => {
  it('cheers winners louder than errors, longer rallies and bigger points louder still', () => {
    const segs = tl.segments;
    const avg = (f: (s: (typeof segs)[number]) => boolean) => {
      const xs = segs.filter(f).map(crowdIntensity);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(avg((s) => s.point.endedBy === 'winner')).toBeGreaterThan(avg((s) => s.point.endedBy === 'unforced_error'));
    for (const s of segs) {
      expect(crowdIntensity(s)).toBeGreaterThan(0);
      expect(crowdIntensity(s)).toBeLessThanOrEqual(1);
    }
    const plain = segs.find((s) => s.point.tags.length === 0 && s.point.endedBy === 'winner')!;
    const bigger = { ...plain, point: { ...plain.point, tags: ['break_point' as const] } };
    expect(crowdIntensity(bigger)).toBeGreaterThan(crowdIntensity(plain));
  });
});

describe('cuesBetween', () => {
  it('hands out every cue exactly once while playing frame by frame', () => {
    const seen: Cue[] = [];
    let t = 0;
    for (; t < 120; t += 1 / 60) seen.push(...cuesBetween(p, t, t + 1 / 60, 1));
    expect(seen).toEqual(cues.filter((c) => c.at < t));
    expect(seen.length).toBeGreaterThan(50);
  });

  it('drops the umpire and the crowd above 2x, and everything on a seek', () => {
    const fast = cuesBetween(p, 0, 60, 4, Infinity);
    expect(fast.some((c) => c.kind === 'hit')).toBe(true);
    expect(fast.some((c) => c.kind === 'call' || c.kind === 'crowd')).toBe(false);
    expect(cuesBetween(p, 0, 60, 2, Infinity).some((c) => c.kind === 'call')).toBe(true);
    expect(cuesBetween(p, 10, 10 + AUDIO.maxCueGapSec + 0.1, 1)).toEqual([]);
    expect(cuesBetween(p, 20, 10, 1)).toEqual([]);
  });
});
