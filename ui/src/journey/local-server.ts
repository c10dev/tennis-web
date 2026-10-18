// A room server in this browser's localStorage (ADR-033): for the practice season, development and e2e (two tabs of
// one browser are two members). The same rules as the real server; `storage` events tell the other tabs.
import { DEADLINE_MS, due, inviteCode, MAX_MEMBERS, type Member, type RoomInfo, type RoomServer, type Submission, type SubmissionRecord } from '@tennis/game';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const ROOM = (code: string) => `journey:room:${code}`;
const SUBS = (code: string, swing: number) => `journey:subs:${code}:${swing}`;

export class LocalRoomServer implements RoomServer {
  constructor(private readonly store: Store, private readonly userId: string, private readonly clock: () => number = () => Date.now()) {}

  me = async (): Promise<string> => this.userId;

  private read<T>(key: string): T | null {
    const text = this.store.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  }

  private write(key: string, value: unknown): void {
    this.store.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('journey-change', { detail: key }));
  }

  async room(code: string): Promise<RoomInfo> {
    const r = this.read<RoomInfo>(ROOM(code));
    if (!r) throw new Error('방을 찾을 수 없어요');
    return r;
  }

  async createRoom(host: Omit<Member, 'id'>, seed: number): Promise<RoomInfo> {
    let code = inviteCode(seed);
    for (let i = 1; this.read(ROOM(code)); i++) code = inviteCode(seed + i * 7);
    const r: RoomInfo = { code, host: this.userId, seed, phase: 'lobby', members: [{ ...host, id: this.userId }], swing: 0, openedAt: this.clock(), deadlineMs: DEADLINE_MS, hashes: {} };
    this.write(ROOM(code), r);
    return r;
  }

  async joinRoom(code: string, member: Omit<Member, 'id'>): Promise<RoomInfo> {
    const r = await this.room(code);
    if (r.members.some((m) => m.id === this.userId)) return r;
    if (r.phase !== 'lobby') throw new Error('이미 시즌이 시작된 방이에요');
    if (r.members.length >= MAX_MEMBERS) throw new Error('방이 가득 찼어요');
    const next = { ...r, members: [...r.members, { ...member, id: this.userId }] };
    this.write(ROOM(code), next);
    return next;
  }

  async start(code: string): Promise<RoomInfo> {
    const r = await this.room(code);
    if (r.host !== this.userId) throw new Error('방장만 시즌을 시작할 수 있어요');
    const next = { ...r, phase: 'season' as const, openedAt: this.clock() };
    this.write(ROOM(code), next);
    return next;
  }

  async submit(code: string, swing: number, submission: Submission, ready: boolean): Promise<void> {
    const r = await this.room(code);
    if (r.phase !== 'season' || r.swing !== swing) throw new Error('이 구간은 이미 진행됐어요');
    const subs = this.read<Record<string, SubmissionRecord>>(SUBS(code, swing)) ?? {};
    this.write(SUBS(code, swing), { ...subs, [this.userId]: { ...submission, ready } });
  }

  async submissions(code: string, swing: number): Promise<Record<string, SubmissionRecord>> {
    return this.read<Record<string, SubmissionRecord>>(SUBS(code, swing)) ?? {};
  }

  async advance(code: string, swing: number): Promise<boolean> {
    const r = await this.room(code);
    if (r.phase !== 'season' || r.swing !== swing || !due(r, await this.submissions(code, swing), this.clock())) return false;
    this.write(ROOM(code), { ...r, swing: swing + 1, openedAt: this.clock() });
    return true;
  }

  async postHash(code: string, swing: number, hash: string): Promise<void> {
    const r = await this.room(code);
    this.write(ROOM(code), { ...r, hashes: { ...r.hashes, [swing]: { ...(r.hashes[swing] ?? {}), [this.userId]: hash } } });
  }

  subscribe(code: string, onChange: () => void): () => void {
    const local = (e: Event) => String((e as CustomEvent).detail).includes(code) && onChange();
    const other = (e: StorageEvent) => (e.key ?? '').includes(code) && onChange();
    window.addEventListener('journey-change', local);
    window.addEventListener('storage', other);
    return () => {
      window.removeEventListener('journey-change', local);
      window.removeEventListener('storage', other);
    };
  }
}
