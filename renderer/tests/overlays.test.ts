import { describe, expect, it } from 'vitest';
import { computeStats, type PointEvent } from '@tennis/engine';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { buildProgramme, programmeTimeFor } from '../src/broadcast/programme.ts';
import { overlayAt } from '../src/overlay/overlays.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { BROADCAST, OVERLAY } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const r = match(6, 'hard');
const tl = buildTimeline(r);
const p = buildProgramme(tl, 'full');
/** Overlay at match second T, seen live. */
const live = (T: number) => overlayAt(p, broadcastFrameAt(p, programmeTimeFor(p, T)));
const big = (s: (typeof tl.segments)[number], tag: string) => s.point.tags.includes(tag as never);

describe('overlayAt', () => {
  it('shows the speed of each serve for two seconds after it is struck', () => {
    for (const s of tl.segments.slice(0, 30)) {
      s.point.shots.filter((x) => x.shot === 'serve').forEach((serve, k) => {
        expect(live(s.zero + serve.t + 1).serveSpeed).toEqual({ kmh: Math.round(serve.speedKmh), label: k === 0 ? '1st serve' : '2nd serve' });
        expect(live(s.zero + serve.t - 0.2).serveSpeed).toBeNull();
      });
      const last = s.point.shots.filter((x) => x.shot === 'serve').at(-1)!;
      expect(live(s.zero + last.t + OVERLAY.serveSpeedSec + 0.1).serveSpeed).toBeNull();
    }
  });

  it('counts the rally once it reaches three shots, during the point only', () => {
    const long = tl.segments.find((s) => s.point.rallyLength >= 6)!;
    const rally = long.point.shots.filter((x) => x.outcome !== 'fault');
    expect(live(long.zero + rally[1]!.t + 0.05).rally).toBeNull();
    expect(live(long.zero + rally[2]!.t + 0.05).rally).toBe(3);
    expect(live(long.zero + rally[5]!.t + 0.05).rally).toBe(6);
    expect(live((long.end + long.next) / 2).rally).toBeNull();
  });

  it('flags break, set and match points before the serve, naming who has the chance', () => {
    let checked = 0;
    for (const s of tl.segments) {
      const o = live(s.zero - 0.2).lowerThird;
      const title = big(s, 'match_point') ? 'MATCH POINT' : big(s, 'set_point') ? 'SET POINT' : big(s, 'break_point') ? 'BREAK POINT'
        : big(s, 'tiebreak') ? 'TIEBREAK' : null;
      if (!title) {
        expect(o).toBeNull();
        continue;
      }
      expect(o!.title).toBe(title);
      const converted = (title === 'BREAK POINT' && s.point.winner !== s.point.server)
        || (title === 'SET POINT' && (s.gap === 'set_end' || s.gap === 'match_end')) || (title === 'MATCH POINT' && s.gap === 'match_end');
      if (converted) expect(o!.detail).toBe(tl.names[s.point.winner === 'A' ? 0 : 1]);
      expect(live(s.zero + OVERLAY.lowerThirdAfterSec + 0.2).lowerThird).toBeNull();
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('introduces the players over the opening shot', () => {
    const o = overlayAt(p, broadcastFrameAt(p, 1));
    expect(o.intro).toEqual([{ name: 'Flint', style: 'Big server' }, { name: 'Rook', style: 'All-court' }]);
    expect(live(tl.segments[0]!.zero + 2).intro).toBeNull();
  });

  it('tags replays and shows the Hawk-Eye call in centimetres', () => {
    const replay = p.clips.find((c) => c.kind === 'replay')!;
    expect(overlayAt(p, broadcastFrameAt(p, replay.start + 0.5)).replay).toBe(true);
    expect(live(10).replay).toBe(false);
    const hawk = p.clips.find((c) => c.kind === 'hawkeye')!;
    const f = broadcastFrameAt(p, hawk.start + 0.5);
    const o = overlayAt(p, f);
    expect(o.replay).toBe(true);
    expect(o.hawkeye).toEqual({ call: f.hawkeye!.call, cm: Math.round(Math.abs(f.hawkeye!.marginM) * 1000) / 10 });
  });

  it('shows the set\'s stats after each set and the match stats at the end', () => {
    const points = r.events.filter((e): e is PointEvent => e.type === 'point');
    const setEnds = tl.segments.filter((s) => s.gap === 'set_end');
    expect(setEnds.length).toBeGreaterThan(0);
    for (const s of setEnds) {
      const setNo = s.point.scoreBefore.sets.length;
      const o = live(s.next - 1).stats!;
      expect(o.title).toBe(`SET ${setNo + 1} STATS`);
      expect(o.stats).toEqual(computeStats(points.filter((x) => x.scoreBefore.sets.length === setNo)));
      expect(live(s.end - 0.1).stats).toBeNull();
    }
    const last = tl.segments.at(-1)!;
    expect(live(last.next - 1).stats).toEqual({ title: 'MATCH STATS', stats: r.stats });
    const result = buildProgramme(tl, 'result');
    const o = overlayAt(result, broadcastFrameAt(result, 2));
    expect(o.stats).toEqual({ title: 'MATCH STATS', stats: r.stats });
    expect(o.lowerThird!.title).toBe('GAME, SET AND MATCH');
    expect(o.lowerThird!.detail).toContain(tl.names[r.winner === 'A' ? 0 : 1]);
  });

  it('keeps the stats panel clear of the reaction shot', () => {
    const s = tl.segments.find((x) => x.gap === 'set_end')!;
    const last = s.point.shots.at(-1)!;
    expect(live(s.zero + last.t + last.flightSec + BROADCAST.reactionSec - 0.3).stats).toBeNull();
  });
});
