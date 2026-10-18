// The room server (ADR-033): stores rooms, members and submissions and moves the swing pointer; it never simulates.
// The interface lives here; the in-memory server is for tests (the browser's servers are in ui/). Time comes from an
// injected clock, so the game layer never reads one.
import type { Submission } from './fold.ts';
import type { Member } from './room.ts';

export interface RoomInfo {
  code: string;
  host: string;
  seed: number;
  /** 'lobby' while members join; then the season runs and the member list is fixed. */
  phase: 'lobby' | 'season';
  members: Member[];
  /** Swings played so far (the next one to play has this index). */
  swing: number;
  /** When the current swing opened (ms); it may advance `deadlineMs` later without everyone ready. */
  openedAt: number;
  deadlineMs: number;
  /** State hashes after each swing, by member id. */
  hashes: Record<number, Record<string, string>>;
}

export interface SubmissionRecord extends Submission {
  ready: boolean;
}

export interface RoomServer {
  /** The id this device acts as (anonymous). */
  me(): Promise<string>;
  createRoom(host: Omit<Member, 'id'>, seed: number): Promise<RoomInfo>;
  joinRoom(code: string, member: Omit<Member, 'id'>): Promise<RoomInfo>;
  room(code: string): Promise<RoomInfo>;
  /** The host starts the season: the member list is fixed and swing 0 opens. */
  start(code: string): Promise<RoomInfo>;
  submit(code: string, swing: number, submission: Submission, ready: boolean): Promise<void>;
  submissions(code: string, swing: number): Promise<Record<string, SubmissionRecord>>;
  /** Moves past `swing` if everyone is ready or its deadline has passed (checked by the server); true if it moved. */
  advance(code: string, swing: number): Promise<boolean>;
  postHash(code: string, swing: number, hash: string): Promise<void>;
  /** Calls back when anything in the room changes; returns an unsubscribe. */
  subscribe(code: string, onChange: () => void): () => void;
}

export const DEADLINE_MS = 12 * 60 * 60 * 1000;
export const MAX_MEMBERS = 8;

/** A six-character invite code from a number (no 0/O/1/I). */
export function inviteCode(n: number): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  let v = Math.abs(Math.floor(n)) || 1;
  for (let i = 0; i < 6; i++) {
    out += abc[v % abc.length];
    v = Math.floor(v / abc.length) + (i + 1) * 7919;
  }
  return out;
}

/** True when the swing can be played: everyone ready, or the deadline gone. */
export function due(info: RoomInfo, subs: Readonly<Record<string, SubmissionRecord>>, now: number): boolean {
  return info.members.every((m) => subs[m.id]?.ready) || now >= info.openedAt + info.deadlineMs;
}

/** An in-memory server for tests: several "devices" share one, each with its own user id. */
export class MemoryRoomServer {
  private rooms = new Map<string, RoomInfo>();
  private subs = new Map<string, Record<string, SubmissionRecord>>();
  private listeners = new Map<string, Set<() => void>>();
  private next = 1;

  constructor(private readonly clock: () => number) {}

  /** A client acting as `userId`. */
  as(userId: string): RoomServer {
    return {
      me: async () => userId,
      createRoom: async (host, seed) => this.create({ ...host, id: userId }, seed),
      joinRoom: async (code, member) => this.join(code, { ...member, id: userId }),
      room: async (code) => this.get(code),
      start: async (code) => this.begin(code, userId),
      submit: async (code, swing, submission, ready) => this.put(code, swing, userId, { ...submission, ready }),
      submissions: async (code, swing) => ({ ...(this.subs.get(`${code}/${swing}`) ?? {}) }),
      advance: async (code, swing) => this.move(code, swing),
      postHash: async (code, swing, hash) => this.hash(code, swing, userId, hash),
      subscribe: (code, onChange) => {
        const set = this.listeners.get(code) ?? new Set();
        set.add(onChange);
        this.listeners.set(code, set);
        return () => set.delete(onChange);
      },
    };
  }

  private get(code: string): RoomInfo {
    const r = this.rooms.get(code);
    if (!r) throw new Error(`No room ${code}`);
    return structuredClone(r);
  }

  private save(r: RoomInfo): RoomInfo {
    this.rooms.set(r.code, r);
    for (const f of this.listeners.get(r.code) ?? []) f();
    return structuredClone(r);
  }

  private create(host: Member, seed: number): RoomInfo {
    const code = inviteCode(seed * 31 + this.next++);
    return this.save({ code, host: host.id, seed, phase: 'lobby', members: [host], swing: 0, openedAt: this.clock(), deadlineMs: DEADLINE_MS, hashes: {} });
  }

  private join(code: string, m: Member): RoomInfo {
    const r = this.get(code);
    if (r.phase !== 'lobby') throw new Error('The season has started');
    if (r.members.some((x) => x.id === m.id)) return r;
    if (r.members.length >= MAX_MEMBERS) throw new Error('The room is full');
    return this.save({ ...r, members: [...r.members, m] });
  }

  private begin(code: string, userId: string): RoomInfo {
    const r = this.get(code);
    if (r.host !== userId) throw new Error('Only the host starts the season');
    return this.save({ ...r, phase: 'season', openedAt: this.clock() });
  }

  private put(code: string, swing: number, userId: string, rec: SubmissionRecord): void {
    const r = this.get(code);
    if (r.phase !== 'season' || swing !== r.swing) throw new Error('That swing is not open');
    if (!r.members.some((m) => m.id === userId)) throw new Error('Not a member');
    const key = `${code}/${swing}`;
    this.subs.set(key, { ...(this.subs.get(key) ?? {}), [userId]: structuredClone(rec) });
    this.save(r);
  }

  private move(code: string, swing: number): boolean {
    const r = this.get(code);
    if (r.phase !== 'season' || r.swing !== swing || !due(r, this.subs.get(`${code}/${swing}`) ?? {}, this.clock())) return false;
    this.save({ ...r, swing: swing + 1, openedAt: this.clock() });
    return true;
  }

  private hash(code: string, swing: number, userId: string, hash: string): void {
    const r = this.get(code);
    this.save({ ...r, hashes: { ...r.hashes, [swing]: { ...(r.hashes[swing] ?? {}), [userId]: hash } } });
  }
}
