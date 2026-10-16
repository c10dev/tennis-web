import { describe, expect, it } from 'vitest';
import { createTicker, resultSounds, revealSounds, tickThresholds, type UiSound } from '../src/audio/ui.ts';
import { AUDIO } from '../src/tuning/index.ts';

/** Feeds a count-up's shown values to a ticker, as countUp's formatter sees them frame by frame. */
const run = (from: number, to: number, shown: number[]): UiSound[] => {
  const tick = createTicker(from, to);
  return shown.map(tick).filter((s): s is UiSound => s !== null);
};

describe('reveal sounds (TD-047, ADR-021 reveal)', () => {
  it('ducks the crowd while the cards lie face down', () => {
    expect(revealSounds('facedown', 'won')).toEqual([{ kind: 'duck', on: true }]);
  });

  it('lifts the duck as both cards flip', () => {
    expect(revealSounds('flip', 'lost')).toEqual([{ kind: 'duck', on: false }]);
  });

  it('strikes the clash with the verdict pop (the white frame and kick land then), and lifts the duck if cut short', () => {
    for (const m of ['won', 'lost', 'even'] as const) expect(revealSounds('verdict', m)).toEqual([{ kind: 'clash' }, { kind: 'pop', matchup: m }]);
    expect(revealSounds('abort', 'won')).toEqual([{ kind: 'duck', on: false }]);
  });

  it('pitches a won verdict highest and a lost one lowest', () => {
    const hz = AUDIO.ui.popHz;
    expect(hz.won).toBeGreaterThan(hz.even);
    expect(hz.even).toBeGreaterThan(hz.lost);
  });

  it('ducks by a real amount and comes back slower than it goes down', () => {
    expect(AUDIO.ui.duckDb).toBeLessThan(-3);
    expect(AUDIO.ui.restoreSec).toBeGreaterThan(AUDIO.ui.duckSec);
  });
});

describe('count-up ticks', () => {
  it('ticks once per number when the count is short', () => {
    expect(tickThresholds(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(tickThresholds(70, 71)).toEqual([71]);
  });

  it('spreads at most maxTicks ticks over a long count, ending on the final number', () => {
    const t = tickThresholds(0, 240);
    expect(t).toHaveLength(AUDIO.ui.maxTicks);
    expect(t.at(-1)).toBe(240);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
  });

  it('counts down for a loss, still ending on the final number', () => {
    const t = tickThresholds(0, -8);
    expect(t).toEqual([-1, -2, -3, -4, -5, -6, -7, -8]);
    expect(tickThresholds(3, 3)).toEqual([]);
  });

  it('rises a semitone per tick, whichever way the number goes', () => {
    const up = run(0, 4, [0, 1, 2, 3, 4]);
    expect(up).toEqual([0, 1, 2, 3].map((s) => ({ kind: 'tick', semitones: s })));
    const down = run(0, -3, [0, -1, -2, -3]);
    expect(down.map((s) => (s.kind === 'tick' ? s.semitones : NaN))).toEqual([0, 1, 2]);
  });

  it('never goes above maxSemitones', () => {
    const shown = Array.from({ length: 501 }, (_, i) => i);
    const ticks = run(0, 500, shown);
    expect(ticks).toHaveLength(AUDIO.ui.maxTicks);
    for (const t of ticks) if (t.kind === 'tick') expect(t.semitones).toBeLessThanOrEqual(AUDIO.ui.maxSemitones);
  });

  it('ticks once when a frame jumps past several steps, and stays quiet on the starting number and repeats', () => {
    expect(run(0, 100, [0, 0, 0])).toEqual([]);
    expect(run(0, 100, [0, 60, 60, 100])).toHaveLength(2);
  });
});

describe('result sounds', () => {
  it('plays the stinger of the result', () => {
    expect(resultSounds(true)).toEqual([{ kind: 'sting', won: true }]);
    expect(resultSounds(false)).toEqual([{ kind: 'sting', won: false }]);
  });
});
