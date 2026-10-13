import { describe, expect, it } from 'vitest';
import { decide } from '../src/quick/match.ts';
import { opponentRead } from '../src/views/quick-scout.ts';
import { freshLadder, ladderWithDecision, toDecision } from './quick-helpers.ts';

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
});
