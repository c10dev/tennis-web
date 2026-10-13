import { describe, expect, it } from 'vitest';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { selectPoints } from '../src/broadcast/modes.ts';
import { buildProgramme, clipAt, programmeTimeFor } from '../src/broadcast/programme.ts';
import { cameraAt, cameraTrack } from '../src/broadcast/director.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { BROADCAST } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(5, 'grass'));

describe('buildProgramme', () => {
  it('is deterministic and its clips run back to back', () => {
    for (const mode of ['full', 'key', 'highlights', 'result'] as const) {
      const p = buildProgramme(tl, mode);
      expect(buildProgramme(tl, mode)).toEqual(p);
      expect(p.clips[0]!.start).toBe(0);
      for (let i = 1; i < p.clips.length; i++) expect(p.clips[i]!.start).toBeCloseTo(p.clips[i - 1]!.start + p.clips[i - 1]!.duration, 9);
      const last = p.clips.at(-1)!;
      expect(p.totalSec).toBeCloseTo(last.start + last.duration, 9);
    }
  });

  it('opens with the player introduction, then plays the whole match live in full mode', () => {
    const p = buildProgramme(tl, 'full');
    expect(p.clips[0]).toMatchObject({ kind: 'intro', duration: BROADCAST.introSec, rate: 0, camera: 'side' });
    const live = p.clips.filter((c) => c.kind === 'live');
    expect(live[0]!.matchFrom).toBe(0);
    for (let i = 1; i < live.length; i++) expect(live[i]!.matchFrom).toBeCloseTo(live[i - 1]!.matchFrom + live[i - 1]!.duration, 9);
    const end = live.at(-1)!;
    expect(end.matchFrom + end.duration).toBeCloseTo(tl.totalSec, 9);
  });

  it('films each live clip with the director\'s camera', () => {
    const track = cameraTrack(tl);
    for (const c of buildProgramme(tl, 'full').clips.filter((x) => x.kind === 'live')) {
      const shot = cameraAt(track, c.matchFrom + c.duration / 2);
      expect({ camera: c.camera, focus: c.focus }).toEqual({ camera: shot.camera, focus: shot.focus });
    }
  });

  it('plays only the chosen points in key and highlight modes, each from its toss', () => {
    for (const mode of ['key', 'highlights'] as const) {
      const p = buildProgramme(tl, mode);
      const chosen = selectPoints(tl, mode);
      expect(p.pointStarts).toHaveLength(chosen.length);
      chosen.forEach((index, k) => {
        const clip = clipAt(p, p.pointStarts[k]!);
        expect(clip.pointIndex).toBe(index);
        expect(clip.matchFrom).toBeCloseTo(tl.segments[index]!.start, 9);
      });
      const shown = new Set(p.clips.filter((c) => c.kind === 'live').map((c) => c.pointIndex));
      expect([...shown]).toEqual(chosen);
    }
  });

  it('is one result clip in result mode', () => {
    const p = buildProgramme(tl, 'result');
    expect(p.clips).toHaveLength(1);
    expect(p.clips[0]).toMatchObject({ kind: 'result', rate: 0, matchFrom: tl.totalSec });
  });

  it('finds the programme time for a match time, to keep the place when the mode changes', () => {
    const p = buildProgramme(tl, 'full');
    for (const T of [0, 33.3, tl.totalSec / 2, tl.totalSec - 1]) {
      const c = clipAt(p, programmeTimeFor(p, T));
      expect(c.kind).toBe('live');
      expect(c.matchFrom + (programmeTimeFor(p, T) - c.start) * c.rate).toBeCloseTo(T, 6);
    }
    const key = buildProgramme(tl, 'key');
    const t = programmeTimeFor(key, tl.segments[1]!.start);
    expect(clipAt(key, t).pointIndex).toBeGreaterThanOrEqual(1);
  });
});

describe('broadcastFrameAt', () => {
  const p = buildProgramme(tl, 'full');

  it('is the match frame at the clip\'s match time, with the camera on top', () => {
    const live = p.clips.find((c) => c.kind === 'live' && c.pointIndex === 7)!;
    const t = live.start + live.duration / 2;
    const f = broadcastFrameAt(p, t);
    const matchT = live.matchFrom + live.duration / 2;
    expect(f).toMatchObject({ camera: live.camera, clip: 'live' });
    expect(f.matchT).toBeCloseTo(matchT, 9);
    const m = matchFrameAt(tl, f.matchT);
    expect({ ball: f.ball, players: f.players, scoreBug: f.scoreBug, pointIndex: f.pointIndex, t: f.t })
      .toEqual({ ball: m.ball, players: m.players, scoreBug: m.scoreBug, pointIndex: m.pointIndex, t });
  });

  it('holds still on the introduction with the score at love-all, and ends on the final score', () => {
    const intro = broadcastFrameAt(p, 1);
    expect(intro.clip).toBe('intro');
    expect(intro.ball).toBeNull();
    expect(intro.scoreBug.rows.map((r) => r.points)).toEqual(['0', '0']);
    const result = broadcastFrameAt(buildProgramme(tl, 'result'), 3);
    expect(result.scoreBug.final).toBe(true);
  });
});
