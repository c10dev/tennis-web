import { describe, expect, it } from 'vitest';
import { playCareer } from '../src/journey/autoplay.ts';
import { reached, shortName } from '../src/journey/facts.ts';
import { press } from '../src/journey/news.ts';
import { staffLines } from '../src/journey/staff-voice.ts';
import { MILESTONES } from '../src/journey/news-ko.ts';
import { junior } from './journey-helpers.ts';
import { newJourney } from '../src/journey/start.ts';
import type { SwingReport } from '../src/journey/types.ts';

describe('journey news', () => {
  const s = newJourney({ seed: 8, player: junior('박서브', 'big_server'), hand: 'right', focus: ['serve'] });
  const { state, reports } = playCareer(s, 'busy', ['serve', 'physical']);

  it('writes headlines and a word from the team (or the diary) for every swing, every placeholder filled', () => {
    for (const r of reports) {
      const p = press(r, state);
      expect(p.headlines.length).toBeGreaterThan(0);
      expect(p.staff.length).toBeGreaterThan(0);
      for (const t of [...p.headlines.map((h) => h.text), ...p.staff.map((c) => c.text)]) expect(t).not.toMatch(/[{}]|undefined|NaN/);
    }
  });

  it('lets each hired member speak in their own lane', () => {
    const r = reports[5]!;
    const hired = { id: 'x', name: '코치', quality: 3, salary: 1, swingsLeft: 2 };
    const lines = staffLines(r, { coach: { ...hired, role: 'coach', style: 'attack' }, physio: { ...hired, role: 'physio', name: '피지오' }, agent: { ...hired, role: 'agent', name: '에이전트' } }, 1);
    expect(lines.map((l) => l.who)).toEqual(['coach', 'physio', 'agent']);
    expect(staffLines(r, {}, 1).map((l) => l.who)).toEqual(['self']);
  });

  it('leads with the biggest thing and reads the same twice', () => {
    const titled = reports.find((r) => r.events.some((e) => e.champion));
    if (titled) expect(['big', 'good']).toContain(press(titled, state).headlines[0]!.tone);
    expect(press(reports[3]!, state)).toEqual(press(reports[3]!, state));
  });

  it('names every milestone and every round', () => {
    for (const m of reports.flatMap((r: SwingReport) => r.milestones)) expect(MILESTONES[m]).toBeTruthy();
    expect(reached({ champion: true, roundsWon: 5, rounds: 5 })).toBe('우승');
    expect(reached({ champion: false, roundsWon: 4, rounds: 5 })).toBe('준우승');
    expect(reached({ champion: false, roundsWon: 3, rounds: 5 })).toBe('4강');
    expect(reached({ champion: false, roundsWon: 0, rounds: 7 })).toBe('128강');
    expect(shortName('박서브')).toBe('서브');
    expect(shortName('잭 스톤웰')).toBe('스톤웰');
  });
});
