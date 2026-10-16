import { describe, expect, it } from 'vitest';
import { tickFreq, uiSound, voiceEnd, type UiCue } from '../src/audio/uiCues.ts';
import { AUDIO } from '../src/tuning/index.ts';

// UI sounds for the quick screens (ADR-029, TD-047): short synthesised voices, described as data so they can be tested.
const ALL: UiCue[] = [
  { kind: 'deal', i: 0 }, { kind: 'deal', i: 2 }, { kind: 'pick' }, { kind: 'hold' }, { kind: 'flip' },
  { kind: 'clash', matchup: 'won' }, { kind: 'clash', matchup: 'lost' }, { kind: 'clash', matchup: 'even' },
  { kind: 'tick', i: 0, n: 24, down: false }, { kind: 'rise' }, { kind: 'stamp' },
];
const top = (cue: UiCue) => Math.max(...uiSound(cue).voices.filter((v) => v.type === 'tone').map((v) => v.freq));

describe('uiSound', () => {
  it('keeps every cue short and below the peak limit', () => {
    for (const cue of ALL) {
      const { voices } = uiSound(cue);
      expect(voices.length, cue.kind).toBeGreaterThan(0);
      for (const v of voices) {
        expect(voiceEnd(v), cue.kind).toBeLessThanOrEqual(AUDIO.ui.maxSec);
        expect(v.peak, cue.kind).toBeGreaterThan(0);
        expect(v.peak, cue.kind).toBeLessThanOrEqual(AUDIO.ui.peakMax);
      }
    }
  });

  it('rings a won clash higher than an even one, and an even one higher than a lost one', () => {
    expect(top({ kind: 'clash', matchup: 'won' })).toBeGreaterThan(top({ kind: 'clash', matchup: 'even' }));
    expect(top({ kind: 'clash', matchup: 'even' })).toBeGreaterThan(top({ kind: 'clash', matchup: 'lost' }));
  });

  it('deals the three cards on rising notes', () => {
    expect(top({ kind: 'deal', i: 1 })).toBeGreaterThan(top({ kind: 'deal', i: 0 }));
    expect(top({ kind: 'deal', i: 2 })).toBeGreaterThan(top({ kind: 'deal', i: 1 }));
  });

  it('ducks the crowd for the face-down hold, and only then', () => {
    const { duck } = uiSound({ kind: 'hold' });
    expect(duck?.bus).toBe('crowd');
    expect(duck!.level).toBeLessThan(0.5);
    expect(duck!.sec).toBeGreaterThanOrEqual(0.4);
    for (const cue of ALL.filter((c) => c.kind !== 'hold')) expect(uiSound(cue).duck, cue.kind).toBeUndefined();
  });
});

describe('tickFreq', () => {
  it('climbs from the base note for a gain, never falling, ending higher', () => {
    for (const n of [1, 3, 12, 40]) {
      const f = Array.from({ length: n }, (_, i) => tickFreq(i, n, false));
      expect(f[0]).toBeCloseTo(AUDIO.ui.tick.base, 6);
      for (let i = 1; i < n; i++) expect(f[i]!).toBeGreaterThanOrEqual(f[i - 1]!);
      if (n > 1) expect(f[n - 1]!).toBeGreaterThan(f[0]!);
      for (const x of f) {
        expect(x).toBeGreaterThanOrEqual(AUDIO.ui.tick.base - 1e-9);
        expect(x).toBeLessThanOrEqual(AUDIO.ui.tick.base * 2 ** (AUDIO.ui.tick.maxSemitones / 12) + 1e-9);
      }
    }
  });

  it('walks down for a loss', () => {
    const f = Array.from({ length: 10 }, (_, i) => tickFreq(i, 10, true));
    for (let i = 1; i < f.length; i++) expect(f[i]!).toBeLessThanOrEqual(f[i - 1]!);
    expect(f[9]!).toBeLessThan(f[0]!);
  });
});
