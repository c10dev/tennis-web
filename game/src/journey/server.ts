// The room server (ADR-033): stores rooms, members and submissions and moves the swing pointer; it never simulates.
// The interface lives here; the in-memory server is for tests (the browser's servers are in ui/). Time comes from an
// injected clock, so the game layer never reads one.
import type { Submission } from './fold.ts';
import type { Member } from './room.ts';
import * as rules from './room-rules.ts';
import { inviteCode } from './room-rules.ts';

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

export { DEADLINE_MS, due, inviteCode, MAX_MEMBERS } from './room-rules.ts';

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
    return this.save(rules.newRoom(inviteCode(seed * 31 + this.next++), host, seed, this.clock()));
  }

  private join(code: string, m: Member): RoomInfo {
    return this.save(rules.join(this.get(code), m));
  }

  private begin(code: string, userId: string): RoomInfo {
    return this.save(rules.start(this.get(code), userId, this.clock()));
  }

  private put(code: string, swing: number, userId: string, rec: SubmissionRecord): void {
    const r = this.get(code);
    const key = `${code}/${swing}`;
    this.subs.set(key, rules.submit(r, this.subs.get(key) ?? {}, userId, swing, rec, rec.ready));
    this.save(r);
  }

  private move(code: string, swing: number): boolean {
    const next = rules.advance(this.get(code), this.subs.get(`${code}/${swing}`) ?? {}, swing, this.clock());
    if (next) this.save(next);
    return next !== null;
  }

  private hash(code: string, swing: number, userId: string, hash: string): void {
    this.save(rules.postHash(this.get(code), userId, swing, hash));
  }
}
