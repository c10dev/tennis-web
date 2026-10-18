import { describe, expect, it } from 'vitest';
import { playCareer } from '../src/journey/autoplay.ts';
import { reached, shortName } from '../src/journey/facts.ts';
import { press } from '../src/journey/news.ts';
import { MILESTONES } from '../src/journey/news-ko.ts';
import { candidates } from '../src/journey/ratings.ts';
import { newJourney } from '../src/journey/start.ts';
import type { SwingReport } from '../src/journey/types.ts';

describe('journey news', () => {
  const s = newJourney({ seed: 8, player: candidates(8, { name: '박서브', nation: 'KOR', style: 'big_server' })[0]!, hand: 'right', focus: ['serve'] });
  const { state, reports } = playCareer(s, { load: 'heavy', focus: ['serve', 'physical'] });

  it('writes headlines and comments for every swing, every placeholder filled', () => {
    for (const r of reports) {
      const p = press(r, state);
      expect(p.headlines.length).toBeGreaterThan(0);
      expect(p.comments.length).toBeGreaterThan(1);
      for (const t of [...p.headlines.map((h) => h.text), ...p.comments.map((c) => c.text)]) expect(t).not.toMatch(/[{}]|undefined|NaN/);
    }
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
