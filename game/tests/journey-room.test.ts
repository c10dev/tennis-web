import { describe, expect, it } from 'vitest';
import { answerAll } from '../src/journey/autoplay.ts';
import { autoPlan, type Plan } from '../src/journey/plan.ts';
import { ovr } from '../src/journey/ratings.ts';
import { total } from '../src/journey/ranking.ts';
import { assign, humanId, stateHash, view, type Member } from '../src/journey/room.ts';
import { createRoom } from '../src/journey/start.ts';
import { advanceRoom } from '../src/journey/swing.ts';
import type { RoomState } from '../src/journey/types.ts';

const members: Member[] = [
  { id: 'a', name: '김서브', nation: 'KOR', style: 'big_server', hand: 'right', talents: { serve: 6, forehand: 4 }, focus: ['serve'] },
  { id: 'b', name: '이리턴', nation: 'KOR', style: 'counter_puncher', hand: 'left', talents: { return: 5, physical: 5 }, focus: ['return'] },
  { id: 'c', name: '박멘탈', nation: 'JPN', style: 'all_court', hand: 'right', talents: { mental: 4, backhand: 3, serve: 3 }, focus: ['mental'] },
];
/** Everyone in the same lower-tier events, so they meet. */
const together = (r: RoomState): Record<string, Plan> => Object.fromEntries(r.order.map((id) => [id, { ...autoPlan(view(r, id), 'busy', []), focus: [] }]));
const settleChoices = (r: RoomState) => r.order.reduce((x, id) => assign(x, id, answerAll(view(x, id))), r);
const play = (r: RoomState, swings: number, plans = together) => {
  let room = r;
  for (let i = 0; i < swings; i++) room = settleChoices(advanceRoom(room, plans(room)).room);
  return room;
};

describe('season rooms', () => {
  const room = createRoom(21, members);

  it('starts every member at 18 with the same OVR and points, shaped differently', () => {
    expect(room.order).toEqual(['h:a', 'h:b', 'h:c']);
    const players = room.order.map((id) => room.humans[id]!.user.player);
    expect(new Set(players.map(ovr)).size).toBe(1);
    expect(new Set(players.map((p) => p.age))).toEqual(new Set([18]));
    expect(new Set(room.order.map((id) => total(room.points[id])))).toEqual(new Set([total(room.points['h:a'])]));
    expect(total(room.points['h:a'])).toBeGreaterThan(0);
    expect(players[0]!.attributes.servePower).toBeGreaterThan(players[1]!.attributes.servePower);
    expect(humanId('a')).toBe('h:a');
  });

  it('plays a swing for everyone, and friends meet in the room cup, one match seen from both sides', () => {
    const out = advanceRoom(room, together(room));
    const met: [string, string, string, string][] = [];
    for (const id of room.order) {
      const rep = out.reports[id]!;
      expect(rep.events.length + rep.skipped.length).toBeGreaterThan(0);
      for (const m of rep.cup!.matches) met.push([id, m.opponent, `cup${m.round}`, m.score]);
      for (const e of rep.events) for (const m of e.matches) if (m.opponent.startsWith('h:')) met.push([id, m.opponent, e.id + m.round, m.score]);
    }
    expect(room.order.filter((id) => out.reports[id]!.cup!.champion)).toHaveLength(1);
    expect(met.length).toBeGreaterThanOrEqual(4);
    for (const [a, b, at, score] of met) {
      const other = met.find(([x, y, w]) => x === b && y === a && w === at)!;
      expect(other[3]).toBe(score.split(' ').map((set) => set.split('-').reverse().join('-')).join(' '));
    }
  });

  it('gives the same room, byte for byte, from the same plan log on two devices', () => {
    const one = play(createRoom(21, members), 2);
    const two = play(createRoom(21, members), 2);
    expect(stateHash(one)).toBe(stateHash(two));
    expect(stateHash(one)).not.toBe(stateHash(play(createRoom(22, members), 2)));
  });

  it('runs into the next season with everyone a year older', () => {
    const r = play(room, 4);
    expect(r.year).toBe(2);
    expect(r.swing).toBe(0);
    for (const id of r.order) expect(r.humans[id]!.user.player.age).toBe(19);
    expect(r.order.every((id) => r.humans[id]!.reports.length === 4)).toBe(true);
  });
});

describe('room report', () => {
  it('ranks friends, lists every match between them once, names the MVP and the cup winner', async () => {
    const { roomReport } = await import('../src/journey/room-report.ts');
    const r = createRoom(31, members);
    const out = advanceRoom(r, together(r));
    const rep = roomReport(out.room, out.reports);
    expect(rep.standings.map((s) => s.id).sort()).toEqual([...r.order].sort());
    const ranks = rep.standings.map((s) => s.rank ?? 1e9);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(rep.meetings.length).toBeGreaterThanOrEqual(2);
    for (const m of rep.meetings) expect(m.winner).not.toBe(m.loser);
    expect(rep.cupWinner).not.toBeNull();
    expect(rep.feed[0]).toContain('룸 컵 우승');
    for (const line of rep.feed) expect(line).not.toMatch(/undefined|NaN/);
  });
});
