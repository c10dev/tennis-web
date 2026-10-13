import { describe, expect, it } from 'vitest';
import { cameraAt, cameraTrack } from '../src/broadcast/director.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { BROADCAST } from '../src/tuning/index.ts';
import { SAMPLE, match } from './fixtures.ts';

describe('cameraTrack', () => {
  it('covers the whole match with back-to-back shots', () => {
    for (const r of SAMPLE) {
      const tl = buildTimeline(r);
      const track = cameraTrack(tl);
      expect(track[0]!.from).toBe(0);
      expect(track.at(-1)!.to).toBe(tl.totalSec);
      for (let i = 1; i < track.length; i++) {
        expect(track[i]!.from).toBe(track[i - 1]!.to);
        expect(track[i]!.to).toBeGreaterThan(track[i]!.from);
        const same = track[i]!.camera === track[i - 1]!.camera && track[i]!.focus === track[i - 1]!.focus;
        expect(same).toBe(false);
      }
    }
  });

  const tl = buildTimeline(match(4, 'clay'));
  const track = cameraTrack(tl);
  const at = (t: number) => cameraAt(track, t);

  it('shows the server up close before big points and the first point of each game, then cuts to the main camera', () => {
    let checked = 0;
    tl.segments.forEach((s, i) => {
      const big = s.point.tags.some((t) => t === 'break_point' || t === 'set_point' || t === 'match_point');
      const opener = s.point.scoreBefore.points[0] === 0 && s.point.scoreBefore.points[1] === 0;
      const before = at(s.zero - 0.3);
      if (big || opener) {
        expect(before).toEqual({ camera: 'serve', focus: s.point.server });
        checked++;
      } else if (i > 0 && tl.segments[i - 1]!.gap === 'point') {
        expect(before.camera).not.toBe('serve');
      }
      const first = s.point.shots.find((x) => x.outcome === 'in');
      if (first) expect(at(s.zero + first.t + 0.4).camera).toBe('main');
    });
    expect(checked).toBeGreaterThan(20);
  });

  it('cuts to the point winner after an ace, a winner or a big point', () => {
    let checked = 0;
    for (const s of tl.segments) {
      const big = s.point.tags.some((t) => t === 'break_point' || t === 'set_point' || t === 'match_point');
      if (!(big || s.point.endedBy === 'ace' || s.point.endedBy === 'winner')) continue;
      const last = s.point.shots.at(-1)!;
      const landed = s.zero + last.t + last.flightSec;
      expect(at(landed + BROADCAST.reactionSec / 2)).toEqual({ camera: 'reaction', focus: s.point.winner });
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('goes wide from the side while players change ends', () => {
    for (const s of tl.segments.filter((x) => x.gap === 'changeover' || x.gap === 'set_end')) {
      expect(at((s.end + s.next) / 2 + 1).camera).toBe('side');
    }
  });

  it('keeps the main camera on ordinary rallies', () => {
    const plain = tl.segments.find((s) => s.point.tags.length === 0 && s.point.endedBy === 'unforced_error' && s.point.shots.length > 4
      && s.point.scoreBefore.points.some((p) => p > 0))!;
    expect(at(plain.zero + plain.point.shots[3]!.t).camera).toBe('main');
  });
});
