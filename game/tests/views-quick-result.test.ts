import { replayMatch, type PointEvent } from '@tennis/engine';
import { describe, expect, it } from 'vitest';
import { highlightOf } from '../src/quick/highlight.ts';
import { pointsToNext, type QuickRecord } from '../src/quick/ladder.ts';
import { displayRating } from '../src/quick/rewards.ts';
import { nextGoal } from '../src/quick/standing.ts';
import { quickResultView } from '../src/views/quick-result.ts';
import { freshLadder, ladderWithDecision, playLadderMatch } from './quick-helpers.ts';

describe('quickResultView', () => {
  const { next } = playLadderMatch(ladderWithDecision(freshLadder()));
  const v = quickResultView(next);
  const rec = next.history.at(-1)!;

  it('sums up the match: result, points, rank change, next place', () => {
    expect(v.won).toBe(rec.won);
    expect(v.headline).toBe(rec.won ? `You won ${rec.score}` : `You lost ${rec.score}`);
    expect(v.delta).toBe(rec.pointsDelta);
    expect([v.rankBefore, v.rankAfter]).toEqual([rec.rankBefore, rec.rankAfter]);
    expect(v.toNext).toBe(pointsToNext(next));
  });

  it('replays the decisive moment with a play-by-play ending on who won the point', () => {
    expect(v.decisive).toEqual(highlightOf(rec));
    const point = replayMatch(rec.recipe).events.find((e): e is PointEvent => e.type === 'point' && e.index === v.decisive!.point)!;
    expect(v.playByPlay[0]).toBe(`${v.decisive!.score} · ${point.server === 'A' ? 'You serve' : 'They serve'}`);
    expect(v.playByPlay.at(-1)).toMatch(point.winner === 'A' ? /^Your point/ : /^Their point/);
    expect(v.playByPlay.join(' ')).toContain(point.winner === 'A' ? 'Your point' : 'Their point');
  });

  it('shows one rating per trained rating as whole numbers on the 0-100 scale, the rises first', () => {
    expect(v.ratings).toHaveLength(rec.progress.length);
    for (const r of v.ratings) {
      const p = rec.progress.find((x) => x.key === r.key)!;
      expect([r.before, r.after]).toEqual([displayRating(p.before), displayRating(p.after)]);
      expect(r.rose).toBe(r.after > r.before);
      expect(r.fill).toBeGreaterThanOrEqual(0);
      expect(r.fill).toBeLessThan(1);
      expect(r.fillBefore).toBeLessThanOrEqual(r.fill);
      if (r.rose) expect(r.fillBefore).toBe(0);
    }
    const rose = v.ratings.map((r) => r.rose);
    expect(rose).toEqual([...rose].sort((a, b) => Number(b) - Number(a)));
    if (rec.won) expect(rose).toContain(true);
  });

  it('names the players passed and the next goal', () => {
    expect(v.overtakes).toEqual(rec.overtakes ?? []);
    expect(v.goal).toEqual(nextGoal(next));
    expect(v.goalLine).toBe(v.goal.winsNeeded === 0 ? 'Stay #1' : `${v.goal.winsNeeded} ${v.goal.winsNeeded === 1 ? 'win' : 'wins'} to ${v.goal.label}`);
  });

  it('reads a result without overtakes or decisions (an M5 record)', () => {
    const m5: QuickRecord = { ...rec };
    delete m5.overtakes;
    delete m5.decisions;
    const old = { ...next, history: [m5] };
    const w = quickResultView(old);
    expect(w.overtakes).toEqual([]);
    expect(w.decisive!.user).toBeNull();
  });
});

describe('play-by-play of a point without cards', () => {
  it('says the game plan played it (every match point is a decision now, so only records without decisions)', () => {
    const { next } = playLadderMatch(freshLadder(11));
    const rec = next.history.at(-1)!;
    const v = quickResultView({ ...next, history: [{ ...rec, decisions: [] }] });
    expect(v.playByPlay[1]).toBe('No cards: your game plan');
    expect(v.decisive!.line).toBe(rec.won ? 'Your plan carried it' : 'They closed it out');
  });
});
