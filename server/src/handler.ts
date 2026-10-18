// One room's API (ADR-033), over a small key-value store: the Durable Object gives it storage and a clock, tests give
// it a map. Members prove who they are with a secret token whose hash the room keeps from their first call.
import { roomRules as rules, RoomError, type Member, type RoomInfo, type Submission, type SubmissionRecord } from '@tennis/game';

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

export interface Caller {
  id: string;
  token: string;
}

export interface Reply {
  status: number;
  body: unknown;
}

const ok = (body: unknown): Reply => ({ status: 200, body });

export async function tokenHash(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class RoomHandler {
  constructor(private readonly store: Store, private readonly clock: () => number, private readonly changed: () => void = () => undefined) {}

  private async info(): Promise<RoomInfo> {
    const r = await this.store.get<RoomInfo>('room');
    if (!r) throw new RoomError('방을 찾을 수 없어요', 404);
    return r;
  }

  private async save(r: RoomInfo): Promise<void> {
    await this.store.put('room', r);
    this.changed();
  }

  /** Binds the caller's token on their first call; afterwards it must match. */
  private async who(caller: Caller | null, bind = false): Promise<string> {
    if (!caller || !caller.id || caller.token.length < 16) throw new RoomError('로그인 정보가 없어요', 401);
    const key = `auth:${caller.id}`;
    const hash = await tokenHash(caller.token);
    const known = await this.store.get<string>(key);
    if (!known && bind) await this.store.put(key, hash);
    else if (known !== hash) throw new RoomError('다른 기기의 참가자예요', 403);
    return caller.id;
  }

  async handle(method: string, route: string, body: unknown, caller: Caller | null): Promise<Reply> {
    try {
      return await this.route(method, route, (body ?? {}) as Record<string, unknown>, caller);
    } catch (e) {
      if (e instanceof RoomError) return { status: e.status, body: { error: e.message } };
      throw e;
    }
  }

  private async route(method: string, route: string, b: Record<string, unknown>, caller: Caller | null): Promise<Reply> {
    const [action, arg] = route.split('/').filter(Boolean);
    if (method === 'POST' && action === 'init') {
      if (await this.store.get('room')) throw new RoomError('이미 있는 방이에요', 409);
      const id = await this.who(caller, true);
      const room = rules.newRoom(String(b.code), { ...(b.host as Omit<Member, 'id'>), id }, Number(b.seed) >>> 0, this.clock());
      await this.save(room);
      return ok(room);
    }
    if (method === 'POST' && action === 'join') {
      const room = await this.info();
      const id = await this.who(caller, true);
      const next = rules.join(room, { ...(b.member as Omit<Member, 'id'>), id });
      if (next !== room) await this.save(next);
      return ok(next);
    }
    const id = await this.who(caller);
    const room = await this.info();
    if (!room.members.some((m) => m.id === id)) throw new RoomError('이 방의 참가자가 아니에요', 403);
    const subsKey = (n: number) => `subs:${n}`;
    if (method === 'GET' && !action) return ok(room);
    if (method === 'POST' && action === 'start') {
      const next = rules.start(room, id, this.clock());
      if (next !== room) await this.save(next);
      return ok(next);
    }
    if (method === 'POST' && action === 'submit') {
      const swing = Number(b.swing);
      const subs = rules.submit(room, (await this.store.get<Record<string, SubmissionRecord>>(subsKey(swing))) ?? {}, id, swing, b.submission as Submission, b.ready === true);
      await this.store.put(subsKey(swing), subs);
      this.changed();
      return ok({ ok: true });
    }
    if (method === 'GET' && action === 'submissions') return ok((await this.store.get(subsKey(Number(arg)))) ?? {});
    if (method === 'POST' && action === 'advance') {
      const swing = Number(b.swing);
      const next = rules.advance(room, (await this.store.get<Record<string, SubmissionRecord>>(subsKey(swing))) ?? {}, swing, this.clock());
      if (next) await this.save(next);
      return ok({ moved: next !== null });
    }
    if (method === 'POST' && action === 'hash') {
      await this.save(rules.postHash(room, id, Number(b.swing), String(b.hash)));
      return ok({ ok: true });
    }
    throw new RoomError('알 수 없는 요청이에요', 404);
  }
}
