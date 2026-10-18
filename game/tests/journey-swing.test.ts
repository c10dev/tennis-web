import { describe, expect, it } from 'vitest';
import { junior } from './journey-helpers.ts';
import { newJourney } from '../src/journey/start.ts';
import { answerAll } from '../src/journey/autoplay.ts';
import { advanceSwing } from '../src/journey/swing.ts';
import type { JourneyState } from '../src/journey/types.ts';
import { autoPlan, type Plan } from '../src/journey/plan.ts';
import { total } from '../src/journey/ranking.ts';

const start = (seed = 1) => newJourney({ seed, player: junior('김테니', 'baseliner'), hand: 'right', focus: ['forehand'] });
const plan = (s: JourneyState): Plan => autoPlan(s, 'smart', ['forehand', 'serve']);

describe('journey swing', () => {
  it('starts at 14 in year 1 with a ranked world and no record', () => {
    const s = start();
    expect(s.year).toBe(1);
    expect(s.swing).toBe(0);
    expect(s.user.player.age).toBe(14);
    expect(s.user.stage).toBe('junior');
    expect(s.reports).toEqual([]);
    expect(Object.values(s.points).filter((p) => total(p) > 0).length).toBeGreaterThan(120);
    expect(Object.keys(s.juniorPoints).length).toBeGreaterThan(40);
  });

  it('plays a swing: junior events for a 14-year-old, a report, the clock moves on', () => {
    const s = start();
    const { state, report } = advanceSwing(s, plan(s));
    expect(state.swing).toBe(1);
    expect(report.events.length).toBeGreaterThan(0);
    for (const e of report.events) expect(['jr', 'jrMajor']).toContain(e.tier);
    expect(report.events.every((e) => e.matches.length > 0)).toBe(true);
    expect(state.reports).toHaveLength(1);
    expect(state.stats.wins + state.stats.losses).toBe(report.events.reduce((a, e) => a + e.matches.length, 0));
  });

  it('ages the user and the world after four swings', () => {
    let s: JourneyState = start();
    for (let i = 0; i < 4; i++) s = answerAll(advanceSwing(s, plan(s)).state);
    expect(s.year).toBe(2);
    expect(s.swing).toBe(0);
    expect(s.user.player.age).toBe(15);
  });

  it('is deterministic for the same seed and choices', () => {
    const run = () => {
      let s = start(4);
      for (let i = 0; i < 3; i++) s = answerAll(advanceSwing(s, plan(s)).state);
      return s;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it('plays a swing quickly', () => {
    const s = start(2);
    const t0 = performance.now();
    advanceSwing(s, autoPlan(s, 'busy', ['serve']));
    expect(performance.now() - t0).toBeLessThan(400);
  });
});
