import { describe, expect, it } from 'vitest';
import { autoPlan, fold, type Member } from '@tennis/game';
import { RoomHandler, type Caller, type Store } from '../src/handler.ts';

const memory = (): Store => {
  const m = new Map<string, unknown>();
  return { get: async <T>(k: string) => structuredClone(m.get(k)) as T | undefined, put: async (k, v) => void m.set(k, structuredClone(v)) };
};
const member = (name: string): Omit<Member, 'id'> => ({ name, nation: 'KOR', style: 'baseliner', hand: 'right', talents: { serve: 5 }, focus: ['serve'] });
const a: Caller = { id: 'u1', token: 'aaaaaaaaaaaaaaaaaaaa' };
const b: Caller = { id: 'u2', token: 'bbbbbbbbbbbbbbbbbbbb' };

describe('room server handler', () => {
  let now = 1000;
  let changes = 0;
  const room = new RoomHandler(memory(), () => now, () => changes++);

  it('runs a room: create, join, start, submit, advance, hash; with tokens bound on first call', async () => {
    expect((await room.handle('POST', '/init', { code: 'ABCDEF', seed: 9, host: member('가나다') }, a)).status).toBe(200);
    expect((await room.handle('POST', '/init', { code: 'ABCDEF', seed: 9, host: member('가나다') }, a)).status).toBe(409);
    expect((await room.handle('POST', '/join', { member: member('라마바') }, b)).status).toBe(200);
    expect((await room.handle('POST', '/start', {}, { ...a, token: 'zzzzzzzzzzzzzzzzzzzz' })).status).toBe(403);
    expect((await room.handle('POST', '/start', {}, b)).status).toBe(403);
    expect((await room.handle('GET', '/', null, null)).status).toBe(401);
    const started = await room.handle('POST', '/start', {}, a);
    expect(started.body).toMatchObject({ phase: 'season', swing: 0 });

    const info = (await room.handle('GET', '/', null, a)).body as { seed: number; members: Member[] };
    const view0 = fold(info.seed, info.members, []);
    const plan = autoPlan({ ...view0.room, ...view0.room.humans['h:u1']! }, 'smart', ['serve']);
    expect((await room.handle('POST', '/submit', { swing: 0, submission: { answers: [], plan }, ready: true }, a)).status).toBe(200);
    expect((await room.handle('POST', '/advance', { swing: 0 }, b)).body).toEqual({ moved: false });
    now += 12 * 60 * 60 * 1000;
    expect((await room.handle('POST', '/advance', { swing: 0 }, b)).body).toEqual({ moved: true });
    expect((await room.handle('POST', '/advance', { swing: 0 }, a)).body).toEqual({ moved: false });
    const subs = (await room.handle('GET', '/submissions/0', null, b)).body as Record<string, unknown>;
    expect(Object.keys(subs)).toEqual(['u1']);
    expect((await room.handle('POST', '/hash', { swing: 0, hash: '0123abcd' }, b)).status).toBe(200);
    expect((await room.handle('POST', '/hash', { swing: 5, hash: '0123abcd' }, b)).status).toBe(400);
    expect(changes).toBeGreaterThan(4);
  });

  it('refuses malformed members and plans', async () => {
    const r = new RoomHandler(memory(), () => 0);
    expect((await r.handle('POST', '/init', { code: 'ABCDEF', seed: 1, host: { name: '' } }, a)).status).toBe(400);
    await r.handle('POST', '/init', { code: 'ABCDEF', seed: 1, host: member('가') }, a);
    await r.handle('POST', '/start', {}, a);
    expect((await r.handle('POST', '/submit', { swing: 0, submission: { answers: 'x' }, ready: true }, a)).status).toBe(400);
    expect((await r.handle('POST', '/nothing', {}, a)).status).toBe(404);
  });
});
