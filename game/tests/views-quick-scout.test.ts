import { describe, expect, it } from 'vitest';
import { decide, startQuick } from '../src/quick/match.ts';
import { HABITS } from '../src/quick/persona.ts';
import { TELL_TEXTS } from '../src/quick/tells.ts';
import { habitLine, opponentRead, opponentScouting, rivalLine } from '../src/views/quick-scout.ts';
import { freshLadder, ladderWithDecision, playLadderMatch, toDecision } from './quick-helpers.ts';

describe('opponentRead', () => {
  it('names the opponent and lists their cards at this match\'s earlier decisions, with the score', () => {
    const m = toDecision(ladderWithDecision(freshLadder()));
    const before = opponentRead(m);
    expect(before.scouting).toContain(m.recipe.config.players[1].name);
    expect(before.history).toEqual([]);
    const score = `${m.live.state.scoring.score.points[0]}-${m.live.state.scoring.score.points[1]}`;
    const { cards } = decide(m, 'defend');
    expect(opponentRead(m).history).toEqual([{ score, card: cards.B }]);
  });

  it('names the habit in plain words on the scouting line, and shows the tell at a decision', () => {
    const m = toDecision(ladderWithDecision(freshLadder()));
    const name = m.recipe.config.players[1].name;
    const read = opponentRead(m);
    expect(read.scouting).toContain(habitLine(name, m.persona.habit));
    expect(read.tell).toBe(TELL_TEXTS[m.pending!.tell!.card][m.pending!.tell!.index]);
    expect(read.rival).toBeNull();
  });
});

describe('habitLine', () => {
  it('says each habit in a short sentence about the player, by surname', () => {
    const lines = HABITS.map((h) => habitLine('Min-jun Kim', h));
    expect(new Set(lines).size).toBe(HABITS.length);
    for (const l of lines) {
      expect(l.startsWith('Kim ')).toBe(true);
      expect(l.length).toBeLessThan(60);
    }
    expect(habitLine('Min-jun Kim', 'big_point_attack')).toBe('Kim goes for broke on match points');
  });
});

describe('rivalLine', () => {
  it('gives the head to head from the user\'s side and the card they played most at big points', () => {
    expect(rivalLine({ met: 3, wins: 2, losses: 1, seen: ['attack', 'attack', 'defend', 'attack'] })).toBe('Head to head 2-1 to you; they attacked 3 of 4 big points');
    expect(rivalLine({ met: 2, wins: 0, losses: 2, seen: ['counter'] })).toBe('Head to head 0-2 to them; they countered 1 of 1 big point');
    expect(rivalLine({ met: 2, wins: 1, losses: 1, seen: [] })).toBe('Head to head 1-1');
  });
});

describe('opponentScouting', () => {
  it('gives the ladder home the next opponent\'s habit line and, after a meeting, the rival line', () => {
    let s = freshLadder(5);
    const first = opponentScouting(s, startQuick(s).opponent);
    expect(first.rival).toBeNull();
    for (let i = 0; i < 40 && !s.rivals[startQuick(s).opponent]; i++) s = playLadderMatch(s).next;
    const m = startQuick(s);
    const again = opponentScouting(s, m.opponent);
    expect(opponentRead(m).scouting).toContain(again.habit);
    expect(again.habit).toBe(habitLine(m.recipe.config.players[1].name, m.persona.habit));
    expect(again.rival).toBe(rivalLine(s.rivals[m.opponent]!));
    expect(opponentRead(m).rival).toBe(again.rival);
  });
});
