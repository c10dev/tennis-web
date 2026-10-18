import { describe, expect, it } from 'vitest';
import { autoPlan, validatePlan } from '../src/journey/plan.ts';
import { trueLevel } from '../src/journey/ratings.ts';
import { agency, care, changeTeam, coaching, market, payTeam, salaryOf } from '../src/journey/staff.ts';
import { newJourney } from '../src/journey/start.ts';
import { advanceSwing } from '../src/journey/swing.ts';
import { answerAll } from '../src/journey/autoplay.ts';
import type { JourneyState } from '../src/journey/types.ts';
import { pro } from './journey-helpers.ts';

const room = (seed = 2) => newJourney({ seed, player: pro(), hand: 'right', focus: ['serve'], stage: 'pro' });
const best = (s: JourneyState, role: 'coach' | 'physio' | 'agent') => market(s).filter((x) => x.role === role).sort((a, b) => b.quality - a.quality)[0]!;

describe('journey team', () => {
  it('offers the same market to everyone in a swing, four of each role, dearer as quality rises', () => {
    const s = room();
    expect(market(s)).toEqual(market(s));
    expect(market(s)).not.toEqual(market({ ...s, swing: 1 }));
    for (const role of ['coach', 'physio', 'agent'] as const) expect(market(s).filter((x) => x.role === role)).toHaveLength(4);
    expect(salaryOf('coach', 5) / salaryOf('coach', 1)).toBeGreaterThan(10);
    expect(market(s).filter((x) => x.role === 'coach').every((c) => c.style)).toBe(true);
  });

  it('hires from the plan, pays wages each swing, and lets contracts run out', () => {
    const s = room();
    const coach = best(s, 'coach');
    const out = advanceSwing(s, { ...autoPlan(s, 'smart', ['serve']), hire: [coach.id] });
    expect(out.state.user.team.coach?.id).toBe(coach.id);
    expect(out.report.wages).toBe(coach.salary);
    let t = { coach: { ...coach, swingsLeft: 1 } };
    const paid = payTeam(t);
    expect(paid.team.coach).toBeUndefined();
    expect(paid.left[0]!.id).toBe(coach.id);
    t = { coach: { ...coach, swingsLeft: 3 } };
    const released = changeTeam({ ...s.user, team: t }, s, [], ['coach']);
    expect(released.team.coach).toBeUndefined();
    expect(released.money).toBe(s.user.money - coach.salary);
  });

  it('refuses hires that are not on the market, twice a role, or beyond the money', () => {
    const s = room();
    const [a, b] = market(s).filter((x) => x.role === 'physio');
    expect(validatePlan(s, { events: [], focus: [], hire: ['nobody'] })).toContain('hire:nobody');
    expect(validatePlan(s, { events: [], focus: [], hire: [a!.id, b!.id] })).toContain('hire-twice:physio');
    expect(validatePlan({ ...s, user: { ...s.user, money: 10 } }, { events: [], focus: [], hire: [a!.id] })).toContain('money');
    expect(validatePlan(s, { events: [], focus: [], release: ['agent'] })).toContain('release:agent');
  });

  it('makes each role matter: coaches grow, physios recover, agents bring money', () => {
    const s = room(3);
    const c = best(s, 'coach');
    expect(coaching({ coach: { ...c, swingsLeft: 4 } }).mult).toBeGreaterThan(1);
    expect(care({ physio: { ...best(s, 'physio'), swingsLeft: 4 } }).rest).toBeGreaterThan(1);
    expect(agency({ agent: { ...best(s, 'agent'), swingsLeft: 4 } }, 40).sponsor).toBeGreaterThan(0);
    const grow = (hire: string[]) => {
      let x = { ...s, user: { ...s.user, money: 1e7 } };
      x = answerAll(advanceSwing(x, { ...autoPlan(x, 'smart', ['serve']), hire }).state);
      for (let i = 0; i < 3; i++) x = answerAll(advanceSwing(x, autoPlan(x, 'smart', ['serve'])).state);
      return trueLevel(x.user.player);
    };
    expect(grow([c.id])).toBeGreaterThan(grow([]));
  });

  it('lets the dearest staff go when the money runs out', () => {
    const s = room(4);
    const poor = { ...s, user: { ...s.user, money: best(s, 'coach').salary } };
    const out = advanceSwing(poor, { events: [], focus: [], hire: [best(s, 'coach').id] });
    expect(out.state.user.team.coach).toBeUndefined();
    expect(out.report.staffLeft.length).toBeGreaterThan(0);
  });
});
