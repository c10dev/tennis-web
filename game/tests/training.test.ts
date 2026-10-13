import { describe, expect, it } from 'vitest';
import { createRng } from '@tennis/engine';
import { createPlayer, defaultAllocation } from '../src/player/create.ts';
import { overall } from '../src/player/overall.ts';
import { canPlay, endWeek, matchFatigue, type WeekActivity } from '../src/player/week.ts';
import { FOCUS_RATINGS } from '../src/tuning.ts';
import type { CareerPlayer } from '../src/types.ts';

const prospect = (): CareerPlayer => ({ ...createPlayer({ name: 'Alex Kim', style: 'all_court', allocation: defaultAllocation('all_court') }, 1), potential: 17 });
const weeks = (p: CareerPlayer, n: number, activity: WeekActivity, seed = 1) => {
  const rng = createRng(seed);
  let out = p;
  // Injured players can only rest, as the season loop enforces.
  for (let i = 0; i < n; i++) out = endWeek(out, out.injuryWeeks > 0 ? { kind: 'rest' } : activity, rng);
  return out;
};
const train = (focus: 'serve' | 'groundstrokes' | 'return' | 'physical' | 'mental', intensity: 'light' | 'normal' | 'hard'): WeekActivity => ({ kind: 'train', focus, intensity });

describe('training', () => {
  it('raises the focused ratings and barely the others', () => {
    const before = prospect();
    const after = weeks(before, 10, train('serve', 'normal'));
    for (const k of FOCUS_RATINGS.serve) expect(after.attributes[k]).toBeGreaterThan(before.attributes[k]);
    expect(after.attributes.forehand - before.attributes.forehand).toBeLessThanOrEqual(1);
    expect(overall(after)).toBeGreaterThan(overall(before));
  });

  it('grows faster the harder the week, averaged over many players', () => {
    const gain = (intensity: 'light' | 'normal' | 'hard') => {
      let sum = 0;
      for (let seed = 1; seed <= 40; seed++) sum += overall(weeks(prospect(), 8, train('groundstrokes', intensity), seed)) - overall(prospect());
      return sum;
    };
    expect(gain('hard')).toBeGreaterThan(gain('normal'));
    expect(gain('normal')).toBeGreaterThan(gain('light'));
  });

  it('stops near the hidden potential and never leaves the 1–20 scale', () => {
    const capped = { ...prospect(), potential: overall(prospect()) };
    const after = weeks(capped, 40, train('physical', 'hard'));
    expect(overall(after)).toBeLessThan(capped.potential + 0.6);
    const star = { ...prospect(), potential: 19.5, attributes: { ...prospect().attributes, movement: 20 } };
    expect(weeks(star, 30, train('physical', 'hard')).attributes.movement).toBe(20);
  });

  it('develops the young faster than players in their late twenties', () => {
    const young = weeks(prospect(), 12, train('return', 'normal'));
    const older = weeks({ ...prospect(), age: 28 }, 12, train('return', 'normal'));
    expect(overall(young)).toBeGreaterThan(overall(older));
  });
});

describe('condition', () => {
  it('tires with harder work and matches, recovers with rest, stays within 0–1', () => {
    const p = prospect();
    const hard = endWeek(p, train('mental', 'hard'), createRng(1)).fatigue;
    const light = endWeek(p, train('mental', 'light'), createRng(1)).fatigue;
    expect(hard).toBeGreaterThan(light);
    const played = endWeek(p, { kind: 'tournament', sets: 12, travelled: true }, createRng(1)).fatigue;
    expect(played).toBeGreaterThan(hard);
    const tired = { ...p, fatigue: 0.9 };
    expect(endWeek(tired, { kind: 'rest' }, createRng(1)).fatigue).toBeLessThan(0.6);
    expect(weeks(p, 20, { kind: 'tournament', sets: 20, travelled: true }).fatigue).toBeLessThanOrEqual(1);
    expect(weeks(p, 20, { kind: 'rest' }).fatigue).toBeGreaterThanOrEqual(0);
  });

  it('hands the engine a share of the weekly fatigue as starting fatigue', () => {
    expect(matchFatigue({ ...prospect(), fatigue: 0 })).toBe(0);
    expect(matchFatigue({ ...prospect(), fatigue: 1 })).toBeGreaterThan(0.3);
    expect(matchFatigue({ ...prospect(), fatigue: 1 })).toBeLessThanOrEqual(1);
  });

  it('gets injured more often working hard and tired, and sits out the weeks it takes', () => {
    const injuries = (activity: WeekActivity, fatigue: number) => {
      let n = 0;
      for (let seed = 1; seed <= 3000; seed++) if (endWeek({ ...prospect(), fatigue }, activity, createRng(seed)).injuryWeeks > 0) n++;
      return n;
    };
    expect(injuries(train('physical', 'hard'), 0.8)).toBeGreaterThan(injuries(train('physical', 'light'), 0.1));
    const hurt = { ...prospect(), injuryWeeks: 2 };
    expect(canPlay(hurt)).toBe(false);
    const next = endWeek(hurt, { kind: 'rest' }, createRng(1));
    expect(next.injuryWeeks).toBe(1);
    expect(next.attributes).toEqual(hurt.attributes);
    expect(() => endWeek(hurt, train('serve', 'normal'), createRng(1))).toThrow(/injured/);
  });
});

describe('aging', () => {
  it('wears players down after thirty', () => {
    const veteran = { ...prospect(), age: 33, potential: 0 };
    expect(overall(weeks(veteran, 24, { kind: 'rest' }))).toBeLessThan(overall(veteran));
    expect(overall(weeks({ ...veteran, age: 25 }, 24, { kind: 'rest' }))).toBe(overall(veteran));
  });

  it('is deterministic for the same random stream', () => {
    expect(weeks(prospect(), 10, train('serve', 'hard'), 9)).toEqual(weeks(prospect(), 10, train('serve', 'hard'), 9));
  });
});
