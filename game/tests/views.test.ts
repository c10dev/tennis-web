import { describe, expect, it } from 'vitest';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { pendingUserMatch, playRound, quickRecipe } from '../src/season/round.ts';
import { currentRanking, newSeason, type SeasonState } from '../src/season/state.ts';
import { beginWeek, closeWeek, weekPreview } from '../src/season/week.ts';
import { SLOTS } from '../src/save/store.ts';
import { money, resultLabel, roundName } from '../src/views/format.ts';
import { homeView } from '../src/views/home.ts';
import { playerView } from '../src/views/player.ts';
import { rankingsView } from '../src/views/rankings.ts';
import { savesView } from '../src/views/saves.ts';
import { historyView, tournamentView } from '../src/views/tournament.ts';

const start = () => newSeason(4, createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, 4));
const finish = (s: SeasonState) => {
  while (s.tournament && !s.tournament.done) {
    const p = pendingUserMatch(s);
    s = playRound(s, p ? quickRecipe(p) : undefined);
  }
  return s;
};

describe('format', () => {
  it('names rounds by players left', () => {
    expect([1, 2, 3, 4, 5].map((r) => roundName(32, r))).toEqual(['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final']);
    expect(roundName(16, 1)).toBe('Round of 16');
  });

  it('labels a result by the round lost, or the title', () => {
    expect(resultLabel(32, 0)).toBe('Lost in round of 32');
    expect(resultLabel(32, 3)).toBe('Lost in semifinal');
    expect(resultLabel(32, 4)).toBe('Runner-up');
    expect(resultLabel(32, 5)).toBe('Champion');
  });

  it('writes money with thousands separators', () => {
    expect(money(1234567)).toBe('$1,234,567');
    expect(money(0)).toBe('$0');
  });
});

describe('homeView', () => {
  it('summarises the player and the week, and says why an option is closed', () => {
    const s = start();
    const v = homeView(s);
    expect(v.week).toBe(1);
    expect(v.player.name).toBe('Alex Kim');
    expect(v.player.rank).toBe(currentRanking(s).indexOf(USER_ID) + 1);
    expect(v.thisWeek.tournament!.name).toBe('Harbour Open');
    const entry = weekPreview(s).entry!;
    expect(v.options.enter.enabled).toBe(entry.accepted);
    if (!entry.accepted) expect(v.options.enter.note).toMatch(new RegExp(`${entry.position}.*cut ${entry.cut}`));
    expect(v.options.train.enabled).toBe(true);
    expect(v.calendar).toHaveLength(14);
    expect(v.calendar[0]).toMatchObject({ week: 1, status: 'current' });
  });

  it('closes entry in weeks without a tournament, and everything but rest when injured', () => {
    let s = start();
    for (let w = 1; w < 4; w++) s = closeWeek(finish(beginWeek(s, { kind: 'rest' })));
    expect(homeView(s).options.enter).toEqual({ enabled: false, note: 'No tournament this week' });
    const hurt = { ...s, world: { ...s.world, players: s.world.players.map((p) => (p.id === USER_ID ? { ...p, injuryWeeks: 2 } : p)) } };
    const v = homeView(hurt);
    expect(v.options.enter.enabled).toBe(false);
    expect(v.options.train).toEqual({ enabled: false, note: 'Injured: 2 more weeks' });
    expect(v.options.rest.enabled).toBe(true);
  });

  it('marks past weeks with the user\'s result', () => {
    let s = start();
    s = closeWeek(finish(beginWeek(s, { kind: 'enter' })));
    const row = homeView(s).calendar[0]!;
    expect(row.status).toBe('past');
    expect(row.result).toMatch(/Champion|Runner-up|Lost in|Did not play/);
  });
});

describe('rankingsView', () => {
  it('lists everyone in ranking order with points, level and movement since the start', () => {
    const s = closeWeek(finish(beginWeek(start(), { kind: 'enter' })));
    const v = rankingsView(s);
    expect(v.map((r) => r.id)).toEqual(currentRanking(s));
    expect(v[0]!.rank).toBe(1);
    expect(v.find((r) => r.isUser)!.name).toBe('Alex Kim');
    for (const r of v) expect(r.change).toBe(s.standings[r.id]!.startRank - r.rank);
  });
});

describe('playerView', () => {
  it('groups ratings by area and hides AI potential', () => {
    const s = start();
    const me = playerView(s, USER_ID);
    expect(me.groups.map((g) => g.label)).toEqual(['Serve', 'Groundstrokes', 'Return', 'Movement', 'Mental']);
    expect(me.groups[0]!.ratings.map((r) => r.key)).toEqual(['servePower', 'serveAccuracy', 'secondServe']);
    expect(me.potential).toMatch(/★/);
    expect(playerView(s, s.world.players[1]!.id).potential).toBeNull();
  });
});

describe('tournamentView', () => {
  it('shows the rounds so far and the user\'s next match', () => {
    let s = start();
    while (!weekPreview(s).entry?.accepted) s = closeWeek(finish(beginWeek(s, { kind: 'rest' })));
    s = beginWeek(s, { kind: 'enter' });
    const v = tournamentView(s)!;
    expect(v.pending!.opponent).toBe(s.world.players.find((p) => p.id === pendingUserMatch(s)!.opponent)!.name);
    expect(v.canPlayRound).toBe(false);
    s = playRound(s, quickRecipe(pendingUserMatch(s)!));
    const after = tournamentView(s)!;
    expect(after.rounds[0]!.matches.some((m) => m.isUser && m.winner !== null)).toBe(true);
  });

  it('turns a finished tournament into a history card with replayable user matches', () => {
    let s = start();
    while (!weekPreview(s).entry?.accepted) s = closeWeek(finish(beginWeek(s, { kind: 'rest' })));
    s = closeWeek(finish(beginWeek(s, { kind: 'enter' })));
    const h = historyView(s, s.history.length - 1);
    expect(h.champion).toBe(s.world.players.find((p) => p.id === s.history.at(-1)!.champion)!.name);
    expect(h.userMatches.length).toBeGreaterThan(0);
    expect(h.userMatches.every((m) => m.replayable)).toBe(true);
  });
});

describe('savesView', () => {
  it('shows every slot, empty or not', () => {
    const v = savesView([{ slot: 'slot2', name: 'Alex Kim', week: 7, savedAt: '2026-10-13 09:00' }]);
    expect(v.map((r) => r.slot)).toEqual([...SLOTS]);
    expect(v.find((r) => r.slot === 'slot2')).toMatchObject({ label: 'Slot 2', empty: false, detail: 'Alex Kim · week 7 · 2026-10-13 09:00' });
    expect(v.find((r) => r.slot === 'auto')).toMatchObject({ label: 'Autosave', empty: true });
  });
});
