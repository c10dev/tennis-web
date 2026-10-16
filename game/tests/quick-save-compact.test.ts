import { describe, expect, it } from 'vitest';
import { concedeQuick, nextOpponent, type QuickRecord, type QuickState } from '../src/quick/ladder.ts';
import { autoPlay, decide, matchOver } from '../src/quick/match.ts';
import { fromQuickSave, QUICK_VERSION, toQuickSave } from '../src/quick/save.ts';
import { QUICK_SAVE } from '../src/tuning.ts';
import { quickHomeView } from '../src/views/quick-home.ts';
import { quickResultView } from '../src/views/quick-result.ts';
import { freshLadder, ladderWithDecision, playLadderMatch, toDecision } from './quick-helpers.ts';

const N = QUICK_SAVE.recipes;
const SUMMARY = ['matchNo', 'opponent', 'opponentRank', 'won', 'score', 'pointsDelta', 'rankBefore', 'rankAfter', 'fingerprint'];
const summaryOf = (r: QuickRecord) => Object.fromEntries(Object.entries(r).filter(([k]) => SUMMARY.includes(k) || k === 'conceded'));

/** Plays `n` ladder matches, keeping every full record as it was when its match ended. */
function ladder(n: number, seed = 3): { s: QuickState; all: QuickRecord[] } {
  let s = freshLadder(seed);
  const all: QuickRecord[] = [];
  for (let i = 0; i < n; i++) {
    s = playLadderMatch(s).next;
    all.push(structuredClone(s.history.at(-1)!));
  }
  return { s, all };
}

/** The same ladder as an older save had it: every record full, in `history`. */
function oldSave(s: QuickState, all: QuickRecord[], version: 1 | 2) {
  const state: Partial<QuickState> = { ...structuredClone(s), history: structuredClone(all) };
  delete state.past;
  if (version === 1) delete state.rivals;
  return JSON.parse(JSON.stringify({ quickVersion: version, summary: { name: 'Alex Kim', rank: 40, matches: s.matchNo, savedAt: '' }, state })) as unknown;
}

describe('quick history compaction (ADR-026)', () => {
  const { s, all } = ladder(2 * N + 3);

  it('keeps the last N matches whole and the older ones as summaries, oldest first', () => {
    expect(s.history).toEqual(all.slice(-N));
    expect(s.past).toEqual(all.slice(0, -N).map(summaryOf));
    expect([...s.past, ...s.history].map((r) => r.matchNo)).toEqual(all.map((_, i) => i));
    s.past.forEach((r) => expect(Object.keys(r).every((k) => SUMMARY.includes(k) || k === 'conceded')).toBe(true));
  });

  it('shows the last five matches at home and the last match on the result screen', () => {
    expect(quickHomeView(s).recent.map((r) => r.score)).toEqual(all.slice(-5).reverse().map((r) => r.score));
    expect(quickResultView(s).headline).toContain(all.at(-1)!.score);
  });

  it('keeps a conceded match flagged once it is summarised', () => {
    let t = ladderWithDecision(freshLadder(5));
    const m = toDecision(t);
    decide(m, 'attack');
    if (!matchOver(m)) autoPlay(m);
    t = concedeQuick(t, m);
    const no = t.matchNo - 1;
    for (let i = 0; i < N; i++) t = playLadderMatch(t).next;
    const r = t.past.find((p) => p.matchNo === no)!;
    expect(r).toMatchObject({ conceded: true, won: false, fingerprint: '' });
    expect(t.history.every((h) => h.matchNo > no)).toBe(true);
  });

  it('keeps a 200-match save under 100 KB', () => {
    let t = freshLadder(3);
    for (let i = 0; i < 200; i++) t = playLadderMatch(t).next;
    const text = JSON.stringify(toQuickSave(t, '2026-10-16 10:00'));
    expect(text.length).toBeLessThanOrEqual(100_000);
    expect(fromQuickSave(JSON.parse(text))).toEqual(t);
  });
});

describe('quick save v3', () => {
  const { s, all } = ladder(N + 4, 4);

  it('saves the split ladder and loads it as it was', () => {
    expect(QUICK_VERSION).toBe(3);
    expect(fromQuickSave(JSON.parse(JSON.stringify(toQuickSave(s, 'x'))))).toEqual(s);
  });

  it('compacts a v2 save on load, as if it had been played under v3', () => {
    expect(fromQuickSave(oldSave(s, all, 2))).toEqual(s);
  });

  it('compacts a v1 save on load and gives it empty rival records', () => {
    expect(fromQuickSave(oldSave(s, all, 1))).toEqual({ ...s, rivals: {} });
  });

  it('summarises a record with no recipe and every record before it', () => {
    const file = oldSave(s, all, 2) as { state: { history: Partial<QuickRecord>[] } };
    delete file.state.history.at(-2)!.recipe;
    const loaded = fromQuickSave(file);
    expect(loaded.history).toEqual(all.slice(-1));
    expect(loaded.past).toEqual(all.slice(0, -1).map(summaryOf));
    expect(quickHomeView(loaded).recent).toHaveLength(5);
  });

  it('keeps a ladder whose last record has no recipe, with nothing for the result screen', () => {
    const file = oldSave(s, all, 2) as { state: { history: Partial<QuickRecord>[] } };
    delete file.state.history.at(-1)!.recipe;
    const loaded = fromQuickSave(file);
    expect(loaded.history).toEqual([]);
    expect(loaded.past).toEqual(all.map(summaryOf));
    expect(quickHomeView(loaded).recent[0]!.score).toBe(all.at(-1)!.score);
    expect(nextOpponent(loaded)).toBe(nextOpponent(s));
  });
});
