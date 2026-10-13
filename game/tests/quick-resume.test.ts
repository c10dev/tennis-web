import { describe, expect, it } from 'vitest';
import type { Card } from '@tennis/engine';
import { finishQuick } from '../src/quick/ladder.ts';
import { autoPlay, decide, matchOver, resumeQuick, startQuick, withLive } from '../src/quick/match.ts';
import { fromQuickSave, toQuickSave } from '../src/quick/save.ts';
import { freshLadder } from './quick-helpers.ts';

// A quick match left in the middle (Back, reload) resumes at the same point: leaving cannot dodge a loss.
const CYCLE: Card[] = ['attack', 'defend', 'counter'];

describe('resumeQuick', () => {
  it('rebuilds the match left after some decisions exactly, from the plan and the cards chosen', () => {
    const s0 = freshLadder(2);
    const m = startQuick(s0, 'aggressive');
    autoPlay(m);
    decide(m, 'defend');
    autoPlay(m);
    if (!matchOver(m)) decide(m, 'counter');
    autoPlay(m);
    const s = withLive(s0, m);
    const back = resumeQuick(fromQuickSave(JSON.parse(JSON.stringify(toQuickSave(s, 'now')))))!;
    expect(back.live.events).toEqual(m.live.events);
    expect(back.decisions).toEqual(m.decisions);
    expect(back.pending?.card).toEqual(m.pending?.card);
    expect(back.plan).toBe('aggressive');
  });

  it('has nothing to resume on a fresh ladder, and nothing after the match is finished', () => {
    const s0 = freshLadder(2);
    expect(resumeQuick(s0)).toBeNull();
    const m = startQuick(s0);
    let i = 0;
    for (autoPlay(m); !matchOver(m); autoPlay(m)) decide(m, CYCLE[i++ % 3]!);
    const done = finishQuick(withLive(s0, m), m);
    expect(done.live).toBeUndefined();
    expect(resumeQuick(done)).toBeNull();
  });
});
