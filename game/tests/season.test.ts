import { describe, expect, it } from 'vitest';
import { advance, DEFAULT_TACTIC, finish, isOver, replayMatch, setTactic, startMatch, type MatchRecipe } from '@tennis/engine';
import { CALENDAR } from '../src/calendar/schedule.ts';
import { pointsFor, TIERS } from '../src/calendar/tiers.ts';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { aiChoice } from '../src/season/ai.ts';
import { pendingUserMatch, playOut, playRound, quickRecipe } from '../src/season/round.ts';
import { simulateSeason } from '../src/season/run.ts';
import { currentRanking, newSeason, type SeasonState } from '../src/season/state.ts';
import { beginWeek, closeWeek, weekPreview } from '../src/season/week.ts';

const user = (seed: number) => createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, seed);
const fresh = (seed = 4) => newSeason(seed, user(seed));

/** Rests until a week whose tournament would take the user. */
function toAcceptedWeek(seed = 4): SeasonState {
  let s = fresh(seed);
  while (!weekPreview(s).entry?.accepted) s = closeWeek(finishTournament(beginWeek(s, { kind: 'rest' })));
  return s;
}

/** Plays out the current tournament, resolving the user's matches with quick results. */
function finishTournament(s: SeasonState): SeasonState {
  while (s.tournament && !s.tournament.done) {
    const pending = pendingUserMatch(s);
    s = playRound(s, pending ? quickRecipe(pending) : undefined);
  }
  return s;
}

describe('newSeason', () => {
  it('is the same season for the same seed, ranked at the start by level', () => {
    expect(fresh()).toEqual(fresh());
    const s = fresh();
    expect(s.week).toBe(1);
    expect(currentRanking(s)).toEqual(s.startRanking);
    expect(s.startRanking).toHaveLength(64);
  });
});

describe('a tournament week', () => {
  it('draws the best-ranked entrants, the user included exactly when the preview says they make the cut', () => {
    let s = fresh();
    for (let w = 1; w <= 6; w++) {
      const preview = weekPreview(s);
      s = beginWeek(s, { kind: 'enter' });
      const t = s.tournament;
      if (t) {
        const entrants = t.bracket.rounds[0]!.filter((x): x is string => x !== null);
        expect(entrants.length).toBeLessThanOrEqual(TIERS[t.tournament.tier].draw);
        expect(new Set(entrants).size).toBe(entrants.length);
        expect(entrants.includes(USER_ID)).toBe(preview.entry!.accepted);
        expect(preview.entry!.position).toBeGreaterThan(0);
      }
      s = closeWeek(finishTournament(s));
    }
  });

  it('takes a 40th-ranked newcomer into most events below the Masters', () => {
    let s = fresh();
    let accepted = 0;
    let offered = 0;
    while (s.week <= 12) {
      const p = weekPreview(s);
      if (p.tournament && p.tournament.tier !== 'masters') {
        offered++;
        if (p.entry!.accepted) accepted++;
      }
      s = closeWeek(finishTournament(beginWeek(s, { kind: 'rest' })));
    }
    expect(accepted / offered).toBeGreaterThan(0.5);
  });

  it('asks for the user\'s match each round they are still in, as user = A with the week\'s conditions', () => {
    const s = beginWeek(toAcceptedWeek(), { kind: 'enter' });
    const pending = pendingUserMatch(s)!;
    expect(pending.config.players[0].name).toBe('Alex Kim');
    expect(pending.config.surface).toBe(s.tournament!.tournament.surface);
    expect(pending.config.rules.bestOf).toBe(TIERS[s.tournament!.tournament.tier].bestOf);
    expect(pending.config.condition!.fatigue[0]).toBeGreaterThanOrEqual(0);
    expect(() => playRound(s, undefined)).toThrow(/user's match/);
    const recipe = quickRecipe(pending);
    const next = playRound(s, recipe);
    const record = next.tournament!.matches.find((m) => m.a === USER_ID || m.b === USER_ID)!;
    expect(record.winner === USER_ID ? 'A' : 'B').toBe(replayMatch(recipe).winner);
    expect(record.recipe).toEqual(recipe);
  });

  it('crowns one champion and pays every entrant by rounds won', () => {
    let s = finishTournament(beginWeek(fresh(), { kind: 'enter' }));
    const t = s.tournament!;
    expect(t.done).toBe(true);
    s = closeWeek(s);
    const record = s.history[0]!;
    expect(record.champion).toBeTruthy();
    for (const [id, won] of Object.entries(record.roundsWon)) expect(s.standings[id]!.season).toBe(pointsFor(record.tier, won));
    expect(s.week).toBe(2);
    expect(s.tournament).toBeNull();
  });

  it('will not close a week with matches still to play', () => {
    expect(() => closeWeek(beginWeek(fresh(), { kind: 'enter' }))).toThrow(/still/);
  });
});

describe('watching the user\'s match', () => {
  it('records the match the user watched set by set, tactic changes and all, from its recipe', () => {
    const s = beginWeek(toAcceptedWeek(), { kind: 'enter' });
    const pending = pendingUserMatch(s)!;
    const live = startMatch(pending.config, pending.seed);
    const changes: MatchRecipe['tacticChanges'] = [];
    let sets = 0;
    while (!isOver(live)) {
      advance(live, 'set');
      sets++;
      if (!isOver(live) && sets === 1) {
        const tactic = { ...DEFAULT_TACTIC, aggression: 0.9, serveTarget: 'wide' as const };
        setTactic(live, 'A', tactic);
        changes.push({ afterSet: 1, player: 'A', tactic });
      }
    }
    const watched = finish(live);
    const next = playRound(s, { config: pending.config, seed: pending.seed, tacticChanges: changes });
    const record = next.tournament!.matches.find((m) => m.a === USER_ID)!;
    expect(record.winner === USER_ID ? 'A' : 'B').toBe(watched.winner);
    expect(replayMatch(record.recipe!)).toEqual(watched);
  });
});

describe('playOut', () => {
  it('plays the AI rounds of a tournament the user is not in, so the week can close', () => {
    const s = beginWeek(fresh(), { kind: 'train', focus: 'serve', intensity: 'normal' });
    expect(s.tournament!.done).toBe(false);
    const done = playOut(s);
    expect(done.tournament!.done).toBe(true);
    expect(() => closeWeek(done)).not.toThrow();
  });

  it('stops at the user\'s next match', () => {
    const s = playOut(beginWeek(toAcceptedWeek(), { kind: 'enter' }));
    expect(pendingUserMatch(s)).not.toBeNull();
  });
});

describe('a week without a tournament', () => {
  it('trains the user as chosen and moves on', () => {
    let s = fresh();
    for (let w = 1; w < 4; w++) s = closeWeek(finishTournament(beginWeek(s, { kind: 'rest' })));
    expect(s.week).toBe(4);
    const before = s.world.players.find((p) => p.id === USER_ID)!;
    s = closeWeek(beginWeek(s, { kind: 'train', focus: 'serve', intensity: 'hard' }));
    const after = s.world.players.find((p) => p.id === USER_ID)!;
    expect(after.fatigue).not.toBe(before.fatigue);
    expect(s.week).toBe(5);
    expect(() => beginWeek(s, { kind: 'train', focus: 'serve', intensity: 'hard' })).not.toThrow();
  });
});

describe('simulateSeason', () => {
  const a = simulateSeason(fresh(9), (s) => aiChoice(s, USER_ID));

  it('plays all 24 weeks and 14 tournaments, each with a champion', () => {
    expect(a.week).toBe(CALENDAR.weeks + 1);
    expect(a.history).toHaveLength(14);
    for (const h of a.history) expect(h.champion).toBeTruthy();
  });

  it('gives each player exactly the points of their results', () => {
    for (const [id, st] of Object.entries(a.standings)) {
      const earned = a.history.reduce((sum, h) => sum + (id in h.roundsWon ? pointsFor(h.tier, h.roundsWon[id]!) : 0), 0);
      expect(st.season).toBe(earned);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(simulateSeason(fresh(9), (s) => aiChoice(s, USER_ID)))).toBe(JSON.stringify(a));
  });
});
