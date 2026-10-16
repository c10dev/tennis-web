import { describe, expect, it } from 'vitest';
import type { Card } from '@tennis/engine';
import { startQuick } from '../src/quick/match.ts';
import { recordRival } from '../src/quick/rivals.ts';
import { fromQuickSave, QUICK_VERSION, toQuickSave } from '../src/quick/save.ts';
import { QUICK_PERSONA } from '../src/tuning.ts';
import { freshLadder, playLadderMatch } from './quick-helpers.ts';

const meeting = (ai: Card[], won: boolean) => ({ opponent: 'p9', won, aiCards: ai });

describe('recordRival', () => {
  it('starts a record at the first meeting and adds to it at the next, keeping their big-point cards', () => {
    const one = recordRival({}, meeting(['attack', 'defend'], true));
    expect(one).toEqual({ p9: { met: 1, wins: 1, losses: 0, seen: ['attack', 'defend'] } });
    const two = recordRival(one, meeting(['attack'], false));
    expect(two.p9).toEqual({ met: 2, wins: 1, losses: 1, seen: ['attack', 'defend', 'attack'] });
    expect(one.p9!.met).toBe(1);
  });

  it('keeps only the latest big-point cards', () => {
    const many = Array<Card>(QUICK_PERSONA.rivalSeen + 5).fill('counter');
    const r = recordRival({}, meeting(['attack', ...many], true));
    expect(r.p9!.seen).toHaveLength(QUICK_PERSONA.rivalSeen);
    expect(r.p9!.seen).not.toContain('attack');
  });
});

describe('rival memory on the ladder', () => {
  it('records every finished match against its opponent and brings the record to the next meeting', () => {
    let s = freshLadder(5);
    expect(s.rivals).toEqual({});
    for (let i = 0; i < 40 && !s.rivals[startQuick(s).opponent]; i++) {
      const { m, next } = playLadderMatch(s);
      const before = s.rivals[m.opponent];
      expect(next.rivals[m.opponent]!.met).toBe((before?.met ?? 0) + 1);
      expect(next.rivals[m.opponent]!.seen).toEqual([...(before?.seen ?? []), ...m.decisions.map((d) => d.ai)].slice(-QUICK_PERSONA.rivalSeen));
      s = next;
    }
    const m = startQuick(s);
    expect(s.rivals[m.opponent]).toBeDefined();
    expect(m.rival).toEqual(s.rivals[m.opponent]);
  });
});

describe('quick save v2', () => {
  it('saves and loads the rival records', () => {
    const s = playLadderMatch(freshLadder(4)).next;
    const file = toQuickSave(s, '2026-10-13 10:00');
    expect(file.quickVersion).toBe(QUICK_VERSION);
    expect(QUICK_VERSION).toBeGreaterThanOrEqual(2);
    expect(fromQuickSave(JSON.parse(JSON.stringify(file))).rivals).toEqual(s.rivals);
  });

  it('loads a v1 save with no rival records yet', () => {
    const s = playLadderMatch(freshLadder(4)).next;
    const v1state: Partial<typeof s> = JSON.parse(JSON.stringify(s)) as typeof s;
    delete v1state.rivals;
    const loaded = fromQuickSave({ quickVersion: 1, summary: { name: 'Alex Kim', rank: 40, matches: 1, savedAt: '' }, state: v1state });
    expect(loaded.rivals).toEqual({});
    expect(loaded.matchNo).toBe(s.matchNo);
    expect(loaded.history).toEqual(s.history);
  });
});
