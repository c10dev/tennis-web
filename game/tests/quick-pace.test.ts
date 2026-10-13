import { describe, expect, it } from 'vitest';
import { createRng, simulateMatch, createConfig, averagePlayer, type PointEvent, type Rng } from '@tennis/engine';
import { decisionOdds } from '../src/quick/ai.ts';
import { exploitBot, fixedBot, randomBot, readerBot, tellBot, type BotView } from '../src/quick/bots.ts';
import { broadcastSeconds, clipFor, decisive } from '../src/quick/pace.ts';
import { QUICK_PACE } from '../src/tuning.ts';
import { freshLadder, playLadderMatch } from './quick-helpers.ts';

const fast4 = simulateMatch(createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'fast4' } }), 4)
  .events.filter((e): e is PointEvent => e.type === 'point');
/** A ladder match: points without cards, and decision points with both cards. */
const points = playLadderMatch(freshLadder()).m.live.events.filter((e): e is PointEvent => e.type === 'point');

describe('quick-match pacing (ADR-017)', () => {
  it('marks as decisive the points that win a set or a break', () => {
    const decided = fast4.filter(decisive);
    expect(decided.length).toBeGreaterThan(0);
    for (const p of decided) expect(p.scoreAfter.sets.length > p.scoreBefore.sets.length || (p.tags.includes('break_point') && p.winner !== p.server)).toBe(true);
    expect(decisive(fast4.at(-1)!)).toBe(true);
  });

  it('shows a decision point whole (up to its last seconds), and only the end of a point without cards', () => {
    expect(points.some((p) => p.cards)).toBe(true);
    expect(points.some((p) => !p.cards)).toBe(true);
    for (const p of points) {
      const end = p.durationSec;
      const clip = clipFor(p);
      expect(clip.toTau).toBeCloseTo(end, 9);
      expect(clip.full).toBe(!!p.cards);
      const shown = p.cards ? QUICK_PACE.keyMaxSec : QUICK_PACE.autoClipSec;
      expect(clip.fromTau).toBeCloseTo(Math.max(-QUICK_PACE.tossSec, end - shown), 9);
    }
  });

  it('adds up a match as the UI plays it: a quick clip and a ticker beat per point without cards; reveal, clip and score per decision', () => {
    const expected = points.reduce((a, p) => {
      const c = clipFor(p);
      return a + (p.cards
        ? QUICK_PACE.revealSec + (c.toTau - c.fromTau) / QUICK_PACE.speed + QUICK_PACE.scoreSec
        : (c.toTau - c.fromTau) / QUICK_PACE.autoSpeed + QUICK_PACE.autoSec);
    }, 0);
    expect(broadcastSeconds(points)).toBeCloseTo(expected, 9);
  });

  it('times the reveal as the UI plays it (ADR-021): the pick, the face-down hold, the flip and the verdict', () => {
    const { selectSec, holdSec, flipSec, verdictSec } = QUICK_PACE.reveal;
    expect(QUICK_PACE.revealSec).toBeCloseTo(selectSec + holdSec + flipSec + verdictSec, 9);
    expect(holdSec).toBeGreaterThanOrEqual(0.45);
    expect(holdSec).toBeLessThanOrEqual(0.65);
    expect(flipSec).toBeGreaterThanOrEqual(0.25);
    expect(flipSec).toBeLessThanOrEqual(0.3);
    expect(QUICK_PACE.revealSec + QUICK_PACE.scoreSec).toBeLessThanOrEqual(1.8);
  });

  it('ticks a point without cards by faster than it plays a decision', () => {
    const auto = points.find((p) => !p.cards)!;
    const card = points.find((p) => p.cards)!;
    expect(broadcastSeconds([auto])).toBeLessThan(broadcastSeconds([card]));
    expect(broadcastSeconds([auto])).toBeLessThan(1.5);
  });
});

describe('bots', () => {
  const ai: BotView['ai'] = {
    style: 'big_server', persona: { habit: 'big_point_attack', tellAccuracy: 0.7 }, role: 'serve', score: [5, 5], tags: ['tiebreak'],
    lastPointWinner: null, decisions: [], rival: null, fatigue: 0,
  };
  const view = (rng: Rng, tell: BotView['tell'] = null): BotView => ({ ai, tell, rng });

  it('plays the same card, any card, or the answer to what the AI most likely plays', () => {
    expect(fixedBot('counter')(view(createRng(1)))).toBe('counter');
    const rng = createRng(2);
    const seen = new Set(Array.from({ length: 60 }, () => randomBot(view(rng))));
    expect(seen.size).toBe(3);
    const odds = decisionOdds(ai);
    const likely = (['attack', 'defend', 'counter'] as const)[odds.indexOf(Math.max(...odds))]!;
    const answer = { attack: 'counter', defend: 'attack', counter: 'defend' }[likely];
    expect(exploitBot(view(createRng(3)))).toBe(answer);
  });

  it('believes a tell: plays the card that beats the card it points at', () => {
    expect(tellBot(view(createRng(1), { card: 'defend', text: '' }))).toBe('attack');
  });

  it('reads the AI half of the time as an average user would', () => {
    const rng = createRng(4);
    const cards = Array.from({ length: 4000 }, () => readerBot(view(rng)));
    const answer = exploitBot(view(createRng(5)));
    const share = cards.filter((c) => c === answer).length / cards.length;
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.75);
  });
});
