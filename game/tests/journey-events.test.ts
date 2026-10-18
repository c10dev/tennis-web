import { describe, expect, it } from 'vitest';
import { answerAll, playCareer } from '../src/journey/autoplay.ts';
import { choose, currentChoice, queueChoices } from '../src/journey/events.ts';
import { EVENTS } from '../src/journey/events-data.ts';
import { junior } from './journey-helpers.ts';
import { newJourney } from '../src/journey/start.ts';
import { summarize } from '../src/journey/summary.ts';
import { autoPlan } from '../src/journey/plan.ts';
import { advanceSwing } from '../src/journey/swing.ts';
import type { JourneyState } from '../src/journey/types.ts';

const start = (seed = 1) => newJourney({ seed, player: junior('김테니', 'all_court'), hand: 'right', focus: ['serve'] });
const at = (s: JourneyState, age: number, stage = s.user.stage): JourneyState => ({ ...s, user: { ...s.user, stage, player: { ...s.user.player, age } } });

describe('journey choices', () => {
  it('has unique ids and Korean text with every placeholder filled', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    let s = start(2);
    for (let i = 0; i < 40 && s.user.stage !== 'retired'; i++) {
      const v = currentChoice(s);
      if (v) for (const t of [v.title, v.text, ...v.options.flatMap((o) => [o.label, o.detail])]) expect(t).not.toMatch(/[{}]|undefined/);
      s = s.pending.length ? choose(s, v!.options[0]!.id).state : advanceSwing(s, autoPlan(s, 'smart', ['serve'])).state;
    }
  });

  it('asks an 18-year-old junior to choose a path, and the choice changes the stage', () => {
    const s = queueChoices(at(start(), 18));
    expect(currentChoice(s)!.id).toBe('turn-pro');
    expect(choose(s, 'pro').state.user.stage).toBe('pro');
    const college = choose(s, 'college').state.user;
    expect(college.stage).toBe('college');
    expect(college.college).toBeGreaterThan(0);
    expect(college.coach).toBe(1);
  });

  it('ends the career at the forced age and sums it up', () => {
    const s = queueChoices(at(start(), 38, 'pro'));
    expect(currentChoice(s)!.id).toBe('retire-forced');
    const done = choose(s, 'retire').state;
    expect(done.user.stage).toBe('retired');
    expect(() => advanceSwing(done, { events: [], focus: [] })).toThrow();
    expect(summarize(done).retiredAt).toBe(38);
  });

  it('blocks the next swing until choices are answered, and draws gambles from the seed', () => {
    const s = queueChoices(at(start(), 18));
    expect(() => advanceSwing(s, { events: [], focus: [] })).toThrow();
    expect(JSON.stringify(answerAll(s))).toBe(JSON.stringify(answerAll(s)));
  });

  it('plays a whole career to retirement with notes, milestones and a summary', () => {
    const { state, swings } = playCareer(start(5), 'smart', ['serve', 'forehand']);
    expect(state.user.stage).toBe('retired');
    expect(swings).toBeGreaterThan(50);
    expect(swings).toBeLessThan(110);
    expect(state.reports.flatMap((r) => r.milestones)).toContain('first-win');
    const sum = summarize(state);
    expect(sum.wins + sum.losses).toBeGreaterThan(100);
    expect(sum.grade.length).toBeGreaterThan(0);
  });
});
