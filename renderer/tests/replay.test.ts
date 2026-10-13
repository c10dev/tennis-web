import { describe, expect, it } from 'vitest';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { lineCall } from '../src/broadcast/hawkeye.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import { replayInserts, wantsReplay } from '../src/broadcast/replay.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline, scoreAt, type PointSegment } from '../src/playback/timeline.ts';
import { BROADCAST } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'hard'));
const landed = (s: PointSegment) => s.zero + s.point.shots.at(-1)!.t + s.point.shots.at(-1)!.flightSec;
const close = (s: PointSegment) => {
  const c = lineCall(s.point, s.point.shots.at(-1)!);
  return c !== null && Math.abs(c.marginM) <= BROADCAST.hawkeyeMarginM;
};

describe('replay selection', () => {
  it('replays winners after a rally, long rallies, converted big points and close calls', () => {
    tl.segments.forEach((s) => {
      const p = s.point;
      const converted = (p.tags.includes('break_point') && p.winner !== p.server)
        || (p.tags.includes('set_point') && (s.gap === 'set_end' || s.gap === 'match_end'))
        || (p.tags.includes('match_point') && s.gap === 'match_end');
      const expected = (p.endedBy === 'winner' && p.rallyLength >= BROADCAST.winnerRally) || p.rallyLength >= BROADCAST.longRally
        || converted || close(s);
      expect(wantsReplay(s)).toBe(expected);
    });
    expect(tl.segments.filter(wantsReplay).length).toBeGreaterThan(5);
  });

  it('plays the last seconds of the point at half speed from the side, after the reaction shot', () => {
    tl.segments.forEach((s, i) => {
      const insert = replayInserts(tl, i);
      if (!wantsReplay(s)) return expect(insert).toBeNull();
      const replay = insert!.clips[0]!;
      expect(insert!.at).toBeCloseTo(Math.min(landed(s) + BROADCAST.reactionSec, s.next - BROADCAST.serveCamLeadSec), 9);
      expect(replay).toMatchObject({ kind: 'replay', rate: BROADCAST.replayRate, camera: 'side', pointIndex: i, scoreTime: insert!.at });
      expect(replay.matchFrom).toBeLessThanOrEqual(landed(s) - 1);
      expect(replay.matchFrom).toBeGreaterThanOrEqual(s.start);
      expect(replay.matchFrom + replay.duration * replay.rate).toBeGreaterThanOrEqual(landed(s));
      expect(insert!.clips.length).toBe(close(s) ? 2 : 1);
    });
  });

  it('follows a close call with a still Hawk-Eye close-up of the mark', () => {
    const i = tl.segments.findIndex(close);
    expect(i).toBeGreaterThanOrEqual(0);
    const hawk = replayInserts(tl, i)!.clips[1]!;
    expect(hawk).toMatchObject({ kind: 'hawkeye', rate: 0, camera: 'hawkeye', matchFrom: landed(tl.segments[i]!) });
  });
});

describe('replays in the programme', () => {
  const p = buildProgramme(tl, 'full');

  it('shows the match as it was during a replay, with the score as it is now', () => {
    const replay = p.clips.find((c) => c.kind === 'replay')!;
    const t = replay.start + replay.duration / 2;
    const f = broadcastFrameAt(p, t);
    const m = matchFrameAt(tl, f.matchT);
    expect(f.matchT).toBeCloseTo(replay.matchFrom + (replay.duration / 2) * replay.rate, 9);
    expect(f.ball).toEqual(m.ball);
    expect(f.players).toEqual(m.players);
    expect(f.scoreBug.rows[0].points).toBe(matchFrameAt(tl, replay.scoreTime!).scoreBug.rows[0].points);
    expect(scoreAt(tl, replay.scoreTime!)).toEqual(tl.segments[replay.pointIndex]!.point.scoreAfter);
  });

  it('carries the line call on Hawk-Eye frames only, with the ball on its mark', () => {
    const hawk = p.clips.find((c) => c.kind === 'hawkeye')!;
    const f = broadcastFrameAt(p, hawk.start + 1);
    const seg = tl.segments[hawk.pointIndex]!;
    expect(f.hawkeye).toEqual(lineCall(seg.point, seg.point.shots.at(-1)!));
    expect(f.ball!.z).toBeCloseTo(0, 6);
    expect(f.ball!.x).toBeCloseTo(f.hawkeye!.mark.x, 6);
    expect(broadcastFrameAt(p, hawk.start - 0.01).hawkeye).toBeNull();
  });

  it('makes the programme longer by exactly the inserted clips', () => {
    const plain = buildProgramme(tl, 'full', () => null);
    const extra = p.clips.filter((c) => c.kind === 'replay' || c.kind === 'hawkeye').reduce((a, c) => a + c.duration, 0);
    expect(p.totalSec).toBeCloseTo(plain.totalSec + extra, 6);
  });
});
