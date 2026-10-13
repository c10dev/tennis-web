import { describe, expect, it } from 'vitest';
import { fingerprint, replayMatch } from '@tennis/engine';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { aiChoice } from '../src/season/ai.ts';
import { pendingUserMatch, playRound, quickRecipe } from '../src/season/round.ts';
import { simulateSeason } from '../src/season/run.ts';
import { newSeason, type SeasonState } from '../src/season/state.ts';
import { beginWeek, closeWeek } from '../src/season/week.ts';
import { fromSave, SAVE_VERSION, toSave } from '../src/save/format.ts';
import { MemoryStore, SLOTS } from '../src/save/store.ts';

const start = () => newSeason(12, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, 12));
function week(s: SeasonState): SeasonState {
  s = beginWeek(s, aiChoice(s, USER_ID));
  while (s.tournament && !s.tournament.done) {
    const p = pendingUserMatch(s);
    s = playRound(s, p ? quickRecipe(p) : undefined);
  }
  return closeWeek(s);
}
const weeks = (s: SeasonState, n: number) => Array.from({ length: n }).reduce<SeasonState>((acc) => week(acc), s);

describe('save format', () => {
  const mid = weeks(start(), 6);

  it('comes back exactly as it was saved, through JSON', () => {
    const file = toSave(mid, '2026-10-13T09:00:00Z');
    expect(file.saveVersion).toBe(SAVE_VERSION);
    expect(file.summary).toEqual({ name: 'Alex Kim', week: mid.week, savedAt: '2026-10-13T09:00:00Z' });
    expect(fromSave(JSON.parse(JSON.stringify(file)))).toEqual(mid);
  });

  it('carries on after loading exactly as it would have without saving', () => {
    const loaded = fromSave(JSON.parse(JSON.stringify(toSave(mid, 'now'))));
    expect(weeks(loaded, 3)).toEqual(weeks(mid, 3));
  });

  it('refuses other save versions and things that are not saves', () => {
    const file = JSON.parse(JSON.stringify(toSave(mid, 'now'))) as Record<string, unknown>;
    expect(() => fromSave({ ...file, saveVersion: 2 })).toThrow(/save version 2/);
    expect(() => fromSave({ saveVersion: 1 })).toThrow(/not a TennisSim save/);
    expect(() => fromSave('hello')).toThrow(/not a TennisSim save/);
  });

  it('keeps the user\'s matches as recipes that replay to the same match, and stays small', () => {
    const season = simulateSeason(start(), (s) => aiChoice(s, USER_ID));
    const matches = season.history.flatMap((h) => h.userMatches);
    expect(matches.length).toBeGreaterThan(5);
    const loaded = fromSave(JSON.parse(JSON.stringify(toSave(season, 'now'))));
    const again = loaded.history.flatMap((h) => h.userMatches);
    matches.forEach((m, i) => expect(fingerprint(replayMatch(again[i]!.recipe!))).toBe(fingerprint(replayMatch(m.recipe!))));
    expect(JSON.stringify(toSave(season, 'now')).length).toBeLessThan(400_000);
  });
});

describe('MemoryStore', () => {
  it('keeps three slots and an autosave, lists what is saved, loads and removes', async () => {
    const store = new MemoryStore();
    expect(SLOTS).toEqual(['auto', 'slot1', 'slot2', 'slot3']);
    expect(await store.list()).toEqual([]);
    const s = start();
    await store.save('slot2', toSave(s, 't1'));
    await store.save('auto', toSave(s, 't2'));
    expect((await store.list()).map((x) => x.slot)).toEqual(['auto', 'slot2']);
    expect(fromSave(await store.load('slot2'))).toEqual(s);
    expect(await store.load('slot1')).toBeNull();
    await store.remove('slot2');
    expect((await store.list()).map((x) => x.slot)).toEqual(['auto']);
    await expect(store.save('slot9' as never, toSave(s, 't'))).rejects.toThrow(/slot/);
  });
});
