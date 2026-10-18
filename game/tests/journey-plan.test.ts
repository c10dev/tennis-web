import { describe, expect, it } from 'vitest';
import { SWINGS } from '../src/journey/calendar.ts';
import { autoPlan, validatePlan } from '../src/journey/plan.ts';
import { newJourney } from '../src/journey/start.ts';
import { junior, pro } from './journey-helpers.ts';

const room = () => newJourney({ seed: 4, player: pro(), hand: 'right', focus: ['serve'], stage: 'pro' });

describe('journey plans', () => {
  it('accepts events that fit the calendar and refuses overlaps, unknown, junior or automatic events', () => {
    const s = room();
    expect(validatePlan(s, { events: ['brisbane', 'canberra-c', 'melbourne'], focus: ['serve'] })).toEqual([]);
    expect(validatePlan(s, { events: ['brisbane', 'perth-f'], focus: [] })).toContain('overlap:perth-f');
    expect(validatePlan(s, { events: ['nowhere'], focus: [] })).toContain('unknown:nowhere');
    expect(validatePlan(s, { events: ['brisbane-jr'], focus: [] })).toContain('stage:brisbane-jr');
    expect(validatePlan(s, { events: [], focus: ['serve', 'return', 'mental'] })).toContain('focus');
    const jr = newJourney({ seed: 4, player: junior(), hand: 'right', focus: ['serve'] });
    expect(validatePlan(jr, { events: ['brisbane-jr', 'melbourne-jr'], focus: [] })).toEqual([]);
    expect(validatePlan(jr, { events: ['brisbane'], focus: [] })).toContain('stage:brisbane');
  });

  it('builds valid automatic plans of different shapes', () => {
    const s = room();
    for (const style of ['smart', 'busy', 'light', 'random'] as const) {
      const plan = autoPlan(s, style, ['forehand']);
      expect(validatePlan(s, plan)).toEqual([]);
      expect(plan.events.length).toBeGreaterThan(0);
    }
    expect(autoPlan(s, 'busy', []).events.length).toBeGreaterThan(autoPlan(s, 'light', []).events.length);
    expect(autoPlan(s, 'random', [], 1)).not.toEqual(autoPlan(s, 'random', [], 2));
    expect(SWINGS[0]!.events.some((e) => e.id === 'melbourne' && e.weeks === 2)).toBe(true);
  });
});
