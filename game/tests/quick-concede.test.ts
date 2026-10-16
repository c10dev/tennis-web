import { liveStatus } from '@tennis/engine';
import { describe, expect, it } from 'vitest';
import { decisiveMoment, highlightOf } from '../src/quick/highlight.ts';
import { concedeQuick, finishQuick, rankOf } from '../src/quick/ladder.ts';
import { autoPlay, decide, matchOver, startQuick } from '../src/quick/match.ts';
import { USER_ID } from '../src/player/create.ts';
import { ko } from '../src/text/ko.ts';
import { QUICK } from '../src/tuning.ts';
import { quickResultView } from '../src/views/quick-result.ts';
import { freshLadder, ladderWithDecision, toDecision } from './quick-helpers.ts';

/** A match stopped at its first decision point, one card played, then on to the next stop. */
function midMatch() {
  const s = ladderWithDecision(freshLadder());
  const m = toDecision(s);
  decide(m, 'attack');
  if (!matchOver(m)) autoPlay(m);
  return { s, m };
}

describe('concedeQuick (M7 step 8)', () => {
  it('records a loss at the score it stopped at, flagged as conceded, with the decisions so far', () => {
    const { s, m } = midMatch();
    const [a, b] = liveStatus(m.live).score.points;
    const next = concedeQuick(s, m);
    const r = next.history.at(-1)!;
    expect(r.conceded).toBe(true);
    expect(r.won).toBe(false);
    expect(r.score).toBe(`${a}-${b}`);
    expect(r.decisions).toEqual(m.decisions);
    expect(r.matchNo).toBe(s.matchNo);
    expect(next.matchNo).toBe(s.matchNo + 1);
  });

  it('costs what a loss costs and counts as a loss against that rival', () => {
    const { s, m } = midMatch();
    const next = concedeQuick(s, m);
    const r = next.history.at(-1)!;
    expect(r.pointsDelta).toBe(-QUICK.loss);
    expect(next.points[USER_ID]).toBe(Math.max(0, s.points[USER_ID]! - QUICK.loss));
    expect(r.rankBefore).toBe(rankOf(s));
    expect(r.rankAfter).toBe(rankOf(next));
    const rival = next.rivals[m.opponent]!;
    expect(rival.losses).toBe((s.rivals[m.opponent]?.losses ?? 0) + 1);
  });

  it('is deterministic', () => {
    const one = midMatch();
    const two = midMatch();
    expect(JSON.stringify(concedeQuick(one.s, one.m))).toBe(JSON.stringify(concedeQuick(two.s, two.m)));
  });

  it('works before the first point too', () => {
    const s = freshLadder();
    const r = concedeQuick(s, startQuick(s)).history.at(-1)!;
    expect(r.score).toBe('0-0');
    expect(r.decisions).toEqual([]);
  });

  it('refuses a finished match (that one is finished, not conceded)', () => {
    const s = freshLadder();
    const m = startQuick(s);
    for (autoPlay(m); !matchOver(m); autoPlay(m)) decide(m, 'defend');
    expect(() => concedeQuick(s, m)).toThrow();
    expect(() => finishQuick(s, m)).not.toThrow();
  });

  it('has no decisive point to replay; the result says it was conceded', () => {
    const { s, m } = midMatch();
    const next = concedeQuick(s, m);
    const r = next.history.at(-1)!;
    expect(decisiveMoment(r)).toBeNull();
    expect(highlightOf(r)).toBeNull();
    const v = quickResultView(next);
    expect(v.decisive).toBeNull();
    expect(v.playByPlay).toEqual([]);
    expect(v.headline).toBe(`You conceded ${r.score}`);
    expect(quickResultView(next, ko).headline).toBe(`기권패 ${r.score}`);
  });
});
