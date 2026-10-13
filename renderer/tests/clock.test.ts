import { describe, expect, it } from 'vitest';
import { clockReducer, createClock, type ClockAction, type ClockState } from '../src/playback/clock.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { PLAYBACK } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(1));
const run = (actions: ClockAction[], from: ClockState = createClock()) => actions.reduce((s, a) => clockReducer(tl, s, a), from);
const at = (t: number, o: Partial<ClockState> = {}): ClockState => ({ ...createClock(), t, ...o });

describe('playback clock', () => {
  it('starts paused at 0 at normal speed', () => {
    expect(createClock()).toEqual({ t: 0, playing: false, speed: 1 });
  });

  it('plays, pauses and toggles', () => {
    expect(run([{ type: 'play' }]).playing).toBe(true);
    expect(run([{ type: 'play' }, { type: 'pause' }]).playing).toBe(false);
    expect(run([{ type: 'toggle' }]).playing).toBe(true);
    expect(run([{ type: 'toggle' }, { type: 'toggle' }]).playing).toBe(false);
  });

  it('advances by real time times speed only while playing', () => {
    expect(run([{ type: 'tick', dt: 0.1 }]).t).toBe(0);
    expect(run([{ type: 'play' }, { type: 'tick', dt: 0.1 }]).t).toBeCloseTo(0.1, 9);
    expect(run([{ type: 'play' }, { type: 'setSpeed', speed: 4 }, { type: 'tick', dt: 0.1 }]).t).toBeCloseTo(0.4, 9);
    expect(run([{ type: 'play' }, { type: 'setSpeed', speed: 0.25 }, { type: 'tick', dt: 0.1 }]).t).toBeCloseTo(0.025, 9);
  });

  it('ignores a long stall (a hidden tab) instead of jumping ahead', () => {
    expect(run([{ type: 'play' }, { type: 'tick', dt: 30 }]).t).toBeCloseTo(PLAYBACK.maxTickSec, 9);
    expect(run([{ type: 'play' }, { type: 'tick', dt: -1 }]).t).toBe(0);
  });

  it('accepts only the listed speeds', () => {
    for (const speed of PLAYBACK.speeds) expect(run([{ type: 'setSpeed', speed }]).speed).toBe(speed);
    expect(run([{ type: 'setSpeed', speed: 3 }]).speed).toBe(1);
  });

  it('stops at the end, and playing again starts over', () => {
    const end = run([{ type: 'play' }, { type: 'tick', dt: 0.2 }], at(tl.totalSec - 0.1));
    expect(end).toMatchObject({ t: tl.totalSec, playing: false });
    expect(run([{ type: 'play' }], end)).toMatchObject({ t: 0, playing: true });
  });

  it('seeks within the match', () => {
    expect(run([{ type: 'seek', t: 100 }]).t).toBe(100);
    expect(run([{ type: 'seek', t: -5 }]).t).toBe(0);
    expect(run([{ type: 'seek', t: 1e9 }]).t).toBe(tl.totalSec);
  });

  it('jumps to the next point, or to the end after the last one', () => {
    const s = tl.segments;
    expect(run([{ type: 'nextPoint' }]).t).toBe(s[1]!.start);
    expect(run([{ type: 'nextPoint' }], at(s[4]!.start + 2)).t).toBe(s[5]!.start);
    expect(run([{ type: 'nextPoint' }], at(s.at(-1)!.start + 1)).t).toBe(tl.totalSec);
  });

  it('goes back to the start of this point, or to the previous point when just past its start', () => {
    const s = tl.segments;
    expect(run([{ type: 'prevPoint' }], at(s[4]!.start + 3)).t).toBe(s[4]!.start);
    expect(run([{ type: 'prevPoint' }], at(s[4]!.start + 0.5)).t).toBe(s[3]!.start);
    expect(run([{ type: 'prevPoint' }], at(0.2)).t).toBe(0);
  });

  it('keeps playing through point jumps and seeks', () => {
    expect(run([{ type: 'play' }, { type: 'nextPoint' }, { type: 'seek', t: 50 }]).playing).toBe(true);
  });
});
