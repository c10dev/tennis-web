import { describe, expect, it } from 'vitest';
import { junior } from './journey-helpers.ts';
import { fromJourneySave, JOURNEY_VERSION, sortHall, toJourneySave, type HallEntry } from '../src/journey/save.ts';
import { newJourney } from '../src/journey/start.ts';
import { advanceSwing } from '../src/journey/swing.ts';
import { answerAll } from '../src/journey/autoplay.ts';

describe('journey saves', () => {
  const start = newJourney({ seed: 3, player: junior('이리턴', 'counter_puncher'), hand: 'left', focus: ['return'] });
  const s = answerAll(advanceSwing(start, { load: 'normal', focus: ['return'] }).state);

  it('round-trips through JSON and plays on the same', () => {
    const file = JSON.parse(JSON.stringify(toJourneySave(s, '2026-10-19T00:00:00Z')));
    expect(file.journeyVersion).toBe(JOURNEY_VERSION);
    expect(file.summary).toMatchObject({ name: '이리턴', age: 14, year: 1, stage: 'junior' });
    const loaded = fromJourneySave(file);
    expect(loaded).toEqual(s);
    const plan = { load: 'heavy' as const, focus: ['return' as const] };
    expect(JSON.stringify(advanceSwing(loaded, plan))).toBe(JSON.stringify(advanceSwing(s, plan)));
  });

  it('refuses what is not a career save, a newer version or a damaged state', () => {
    expect(() => fromJourneySave({ quickVersion: 3 })).toThrow('저장 파일이 아니');
    expect(() => fromJourneySave({ journeyVersion: JOURNEY_VERSION + 1, state: s })).toThrow('버전');
    expect(() => fromJourneySave({ journeyVersion: 1, state: { seed: 1 } })).toThrow('손상');
  });

  it('orders the hall of fame by majors, then best rank, then titles', () => {
    const e = (name: string, majors: number, bestRank: number | null, titles: number) => ({ name, majors, bestRank, titles, savedAt: name }) as HallEntry;
    expect(sortHall([e('a', 0, 5, 9), e('b', 1, 20, 2), e('c', 0, 3, 1), e('d', 0, null, 0)]).map((x) => x.name)).toEqual(['b', 'c', 'a', 'd']);
  });
});
