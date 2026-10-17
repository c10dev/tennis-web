import type { PlayerId, PointEvent, PointTag, ShotEvent, ShotType, Wing } from '@tennis/engine';
import { describe, expect, it } from 'vitest';
import { decide, matchOver, autoPlay } from '../src/quick/match.ts';
import { en } from '../src/text/en.ts';
import { ko } from '../src/text/ko.ts';
import { captionAfter, captionBefore, pointCaptions } from '../src/views/quick-captions.ts';
import { freshLadder, toDecision } from './quick-helpers.ts';

// Presentation spec E5 (TD-075): a lower-third before a point that matters, a one-line result after it.

const shot = (hitter: PlayerId, kind: ShotType, wing?: Wing): ShotEvent => ({ hitter, shot: kind, ...(wing ? { wing } : {}) }) as ShotEvent;

interface Fixture {
  points?: [number, number];
  games?: [number, number];
  tiebreak?: boolean;
  server?: PlayerId;
  winner?: PlayerId;
  tags?: PointTag[];
  endedBy?: PointEvent['endedBy'];
  shots?: ShotEvent[];
  cards?: boolean;
}

function point({ points = [0, 0], games = [0, 0], tiebreak = true, server = 'A', winner = 'A', tags = ['tiebreak'], endedBy = 'winner', shots, cards }: Fixture = {}): PointEvent {
  const score = { sets: [], games, points, tiebreak, server };
  return {
    type: 'point', index: 0, server, winner, serveNumber: 1, rallyLength: 3, endedBy, tags, durationSec: 5,
    shots: shots ?? [shot(server, 'serve'), shot(server === 'A' ? 'B' : 'A', 'return', 'backhand'), shot(winner, 'drive', 'forehand')],
    scoreBefore: score, scoreAfter: score, ...(cards ? { cards: { A: 'attack', B: 'defend' } } : {}),
  } as PointEvent;
}
const won = (...winners: PlayerId[]) => winners.map((winner) => point({ winner }));

describe('captionBefore', () => {
  it('names a match point from the user\'s side', () => {
    expect(captionBefore(point({ points: [6, 5], tags: ['set_point', 'match_point', 'tiebreak'] }), [], ko)).toBe('매치 포인트');
    expect(captionBefore(point({ points: [5, 6], tags: ['set_point', 'match_point', 'tiebreak'] }), [], ko)).toBe('매치 포인트 위기');
    expect(captionBefore(point({ points: [6, 5], tags: ['set_point', 'match_point', 'tiebreak'] }), [], en)).toBe('MATCH POINT');
    expect(captionBefore(point({ points: [5, 6], tags: ['set_point', 'match_point', 'tiebreak'] }), [], en)).toBe('MATCH POINT DOWN');
  });

  it('names a set point by who leads the set (games outside a tiebreak)', () => {
    const fx = { points: [1, 3] as [number, number], games: [5, 4] as [number, number], tiebreak: false, tags: ['set_point'] as PointTag[] };
    expect(captionBefore(point(fx), [], ko)).toBe('세트 포인트');
    expect(captionBefore(point({ ...fx, games: [4, 5] }), [], ko)).toBe('세트 포인트 위기');
    expect(captionBefore(point(fx), [], en)).toBe('SET POINT');
    expect(captionBefore(point({ ...fx, games: [4, 5] }), [], en)).toBe('SET POINT DOWN');
  });

  it('names a break point for the returner', () => {
    const fx = { points: [3, 2] as [number, number], tiebreak: false, tags: ['break_point'] as PointTag[] };
    expect(captionBefore(point({ ...fx, server: 'B' }), [], ko)).toBe('브레이크 포인트');
    expect(captionBefore(point({ ...fx, server: 'A' }), [], ko)).toBe('브레이크 포인트 위기');
    expect(captionBefore(point({ ...fx, server: 'B' }), [], en)).toBe('BREAK POINT');
    expect(captionBefore(point({ ...fx, server: 'A' }), [], en)).toBe('BREAK POINT DOWN');
  });

  it('names a run of three or more points from the user\'s side', () => {
    expect(captionBefore(point(), won('A', 'B', 'B', 'B'), ko)).toBe('3연속 실점');
    expect(captionBefore(point(), won('A', 'A', 'A', 'A'), ko)).toBe('4연속 득점');
    expect(captionBefore(point(), won('A', 'B', 'B', 'B'), en)).toBe('3 POINTS LOST IN A ROW');
    expect(captionBefore(point(), won('A', 'A', 'A', 'A'), en)).toBe('4 POINTS IN A ROW');
  });

  it('says nothing before an ordinary point: the tiebreak tag alone, a run of two', () => {
    expect(captionBefore(point(), [], ko)).toBeNull();
    expect(captionBefore(point(), won('A', 'B', 'B'), en)).toBeNull();
  });

  it('puts the match point ahead of a run', () => {
    expect(captionBefore(point({ points: [6, 3], tags: ['set_point', 'match_point', 'tiebreak'] }), won('A', 'A', 'A'), ko)).toBe('매치 포인트');
  });

  it('always names a decision point: the stop\'s moment when nothing else applies', () => {
    expect(captionBefore(point({ points: [4, 5], cards: true }), won('A', 'B'), ko)).toBe('승부처');
    expect(captionBefore(point({ points: [5, 5], cards: true }), won('A', 'B'), ko)).toBe('5-5 동점');
    expect(captionBefore(point({ points: [5, 5], cards: true }), won('A', 'B'), en)).toBe('5-ALL');
    expect(captionBefore(point({ points: [3, 5], cards: true }), won('B', 'B', 'B'), ko)).toBe('3연속 실점');
  });
});

describe('captionAfter', () => {
  it('says who ended the point and with what', () => {
    const fh = point({ winner: 'B', endedBy: 'winner' });
    expect(captionAfter(fh, ko)).toBe('상대 포핸드 위너');
    expect(captionAfter(fh, en)).toBe('Their forehand winner');
    const ace = point({ server: 'A', winner: 'A', endedBy: 'ace', shots: [shot('A', 'serve')] });
    expect(captionAfter(ace, ko)).toBe('내 에이스');
    expect(captionAfter(ace, en)).toBe('Your ace');
    const err = point({ winner: 'A', endedBy: 'unforced_error', shots: [shot('A', 'serve'), shot('B', 'return', 'backhand')] });
    expect(captionAfter(err, ko)).toBe('상대 백핸드 실수');
    expect(captionAfter(err, en)).toBe('Their backhand error');
  });
});

describe('pointCaptions', () => {
  it('gives a result line only after a point that had a caption before it', () => {
    const points = [...won('B', 'B', 'B'), point({ winner: 'B' }), point({ winner: 'A' })];
    expect(pointCaptions(points, ko)).toEqual([
      { before: null, after: null }, { before: null, after: null }, { before: null, after: null },
      { before: '3연속 실점', after: '상대 포핸드 위너' }, { before: '4연속 실점', after: '내 포핸드 위너' },
    ]);
  });

  it('captions every decision point of real quick matches, in both languages', () => {
    for (const seed of [1, 3, 7]) {
      const m = toDecision(freshLadder(seed));
      for (; !matchOver(m); autoPlay(m)) decide(m, 'attack');
      const points = m.live.events.filter((e): e is PointEvent => e.type === 'point');
      for (const t of [en, ko]) {
        pointCaptions(points, t).forEach((c, i) => {
          if (points[i]!.cards) expect(c.before, `seed ${seed} point ${i}`).toBeTruthy();
          expect(!!c.after).toBe(!!c.before);
        });
      }
    }
  });
});
