import { describe, expect, it } from 'vitest';
import { createRng } from '@tennis/engine';
import { SWINGS } from '../src/journey/calendar.ts';
import { afterEvent, endSwing, restUntil, startCondition } from '../src/journey/condition.ts';
import { fatigueForecast, forecast } from '../src/journey/forecast.ts';
import { autoPlan } from '../src/journey/plan.ts';
import { newJourney } from '../src/journey/start.ts';
import { advanceSwing } from '../src/journey/swing.ts';
import { answerAll } from '../src/journey/autoplay.ts';
import { pro } from './journey-helpers.ts';

const ev = (id: string) => SWINGS.flatMap((s) => s.events).find((e) => e.id === id)!;

describe('journey condition and schedule', () => {
  const p = pro();

  it('tires with events, more back to back and across regions, and recovers in free weeks', () => {
    const rng = createRng(1);
    let c = afterEvent(startCondition(0), ev('brisbane'), 3, p, rng);
    const one = c.fatigue;
    c = afterEvent(c, ev('canberra-c'), 3, p, rng);
    const backToBack = c.fatigue - one;
    const apart = afterEvent(restUntil(afterEvent(startCondition(0), ev('brisbane'), 3, p, rng), 6), ev('manila-f'), 3, p, rng);
    expect(backToBack).toBeGreaterThan(one);
    expect(apart.fatigue).toBeLessThan(c.fatigue);
    const end = endSwing(c);
    expect(end.trainWeeks).toBe(10);
    expect(end.matches).toBe(6);
    expect(end.fatigue).toBeLessThan(c.fatigue);
  });

  it('forecasts entry, points to defend and fatigue for a plan', () => {
    let s = newJourney({ seed: 6, player: p, hand: 'right', focus: ['serve'], stage: 'pro' });
    const f = forecast(s);
    expect(f.find((x) => x.event.id === 'perth-f')!.entry).toBe('direct');
    expect(f.find((x) => x.event.id === 'brisbane-jr')!.allowed).toBe(false);
    expect(f.some((x) => x.entry === 'out' || x.entry === 'qualifying')).toBe(true);
    const busy = fatigueForecast(s, autoPlan(s, 'busy', []));
    const light = fatigueForecast(s, autoPlan(s, 'light', []));
    expect(busy.byWeek).toHaveLength(12);
    expect(busy.peak).toBeGreaterThan(light.peak);
    for (let i = 0; i < 4; i++) s = answerAll(advanceSwing(s, autoPlan(s, 'smart', ['serve'])).state);
    const played = s.reports[0]!.events.map((e) => e.id);
    const again = forecast(s).filter((x) => played.includes(x.event.id));
    expect(again.length).toBeGreaterThan(0);
    for (const x of again) expect(x.defending).toBe(s.reports[0]!.events.find((e) => e.id === x.event.id)!.points);
  });

  it('plays only the planned events it gets into, and says which it missed', () => {
    const s = newJourney({ seed: 7, player: p, hand: 'right', focus: ['serve'], stage: 'pro' });
    const { report } = advanceSwing(s, { events: ['perth-f', 'canberra-c', 'melbourne', 'doha', 'indian-wells'], focus: ['serve'] });
    const played = report.events.map((e) => e.id);
    for (const id of played) expect(['perth-f', 'canberra-c', 'melbourne', 'doha', 'indian-wells', 'finals']).toContain(id);
    expect(played).toContain('perth-f');
    expect(played.length + report.skipped.length).toBeGreaterThanOrEqual(4);
    expect(report.trainWeeks).toBe(12 - report.events.reduce((a, e) => a + ev(e.id).weeks, 0));
  });
});
