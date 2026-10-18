import { describe, expect, it } from 'vitest';
import { autoPlan } from '../src/journey/plan.ts';
import { mismatches, RoomClient } from '../src/journey/room-sync.ts';
import { DEADLINE_MS, MemoryRoomServer } from '../src/journey/server.ts';
import type { Member } from '../src/journey/room.ts';

const member = (name: string, talents: Member['talents']): Omit<Member, 'id'> => ({ name, nation: 'KOR', style: 'baseliner', hand: 'right', talents, focus: ['forehand'] });

describe('room sync (lockstep)', () => {
  let now = 1_000_000;
  const server = new MemoryRoomServer(() => now);

  it('lets three devices create, join, plan, make ready and see the same room', async () => {
    const [a, b, c] = ['u1', 'u2', 'u3'].map((u) => server.as(u));
    const info = await a!.createRoom(member('가나다', { serve: 10 }), 77);
    await b!.joinRoom(info.code, member('라마바', { return: 10 }));
    await c!.joinRoom(info.code, member('사아자', { mental: 10 }));
    await expect(b!.start(info.code)).rejects.toThrow('방장');
    await a!.start(info.code);
    await expect(server.as('u4').joinRoom(info.code, member('늦은이', {}))).rejects.toThrow('시작된');
    const clients = [a!, b!, c!].map((s) => new RoomClient(s, info.code));

    for (const client of clients) {
      const mine = (await client.mine())!;
      expect(mine.synced.info.swing).toBe(0);
      await client.submit({ answers: [], plan: autoPlan(mine.state, 'smart', ['forehand']) }, true);
    }
    expect((await clients[0]!.status(now)).due).toBe(true);
    expect(await clients[1]!.advanceIfDue(now)).toBe(true);
    expect(await clients[2]!.advanceIfDue(now)).toBe(false);
    const after = await Promise.all(clients.map((x) => x.load()));
    expect(new Set(after.map((x) => x!.hash)).size).toBe(1);
    expect(after[0]!.room.swing).toBe(1);
    expect(mismatches(await a!.room(info.code))).toEqual([]);

    // Swing 1: only one member submits; nothing moves until the deadline, then the others play their defaults.
    const first = (await clients[0]!.mine())!;
    await clients[0]!.submit({ answers: [], plan: autoPlan(first.state, 'busy', []) }, true);
    expect(await clients[0]!.advanceIfDue(now)).toBe(false);
    expect((await clients[0]!.status(now)).ready).toEqual({ u1: true, u2: false, u3: false });
    now += DEADLINE_MS;
    expect(await clients[2]!.advanceIfDue(now)).toBe(true);
    const later = await Promise.all(clients.map((x) => x.load()));
    expect(new Set(later.map((x) => x!.hash)).size).toBe(1);
    for (const x of later) expect(Object.keys(x!.reports)).toHaveLength(3);

    // A device that disagrees shows up.
    await server.as('u3').postHash(info.code, 1, 'bad0bad0');
    expect(mismatches(await a!.room(info.code))).toEqual([{ swing: 1, hashes: { [later[0]!.hash]: ['u1', 'u2'], bad0bad0: ['u3'] } }]);
  });
});
