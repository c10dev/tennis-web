// One device's view of a room on a server (ADR-033): it folds the submission log into the room (only the swings it has
// not folded yet), sends this member's submission, moves the swing on when it is due, and posts its state hash so
// devices that disagree are found.
import { fold, foldSwing, type Folded, type Submission, type SwingLog } from './fold.ts';
import { humanId, stateHash, view } from './room.ts';
import { due, type RoomInfo, type RoomServer } from './server.ts';
import type { JourneyState } from './types.ts';

export interface Synced extends Folded {
  info: RoomInfo;
  /** This device's member id and player id. */
  me: string;
  playerId: string;
}

export class RoomClient {
  private cache: (Folded & { swings: number }) | null = null;

  constructor(private readonly server: RoomServer, readonly code: string) {}

  /** The room as of the server's swing pointer (a lobby has no room yet: `null`). */
  async load(): Promise<Synced | null> {
    const [info, me] = await Promise.all([this.server.room(this.code), this.server.me()]);
    if (info.phase !== 'season') return null;
    const memberIds = Object.fromEntries(info.members.map((m) => [humanId(m.id), m.id]));
    if (!this.cache || this.cache.swings > info.swing) this.cache = { ...fold(info.seed, info.members, []), swings: 0 };
    while (this.cache.swings < info.swing) {
      const log: SwingLog = await this.server.submissions(this.code, this.cache.swings);
      const out = foldSwing(this.cache.room, log, memberIds);
      this.cache = { room: out.room, reports: out.reports, hash: stateHash(out.room), swings: this.cache.swings + 1 };
      if (info.hashes[this.cache.swings - 1]?.[me] !== this.cache.hash) await this.server.postHash(this.code, this.cache.swings - 1, this.cache.hash);
    }
    return { ...this.cache, info, me, playerId: humanId(me) };
  }

  /** This member's view of the room. */
  async mine(): Promise<{ synced: Synced; state: JourneyState } | null> {
    const synced = await this.load();
    return synced ? { synced, state: view(synced.room, synced.playerId) } : null;
  }

  async submit(submission: Submission, ready: boolean): Promise<void> {
    const info = await this.server.room(this.code);
    await this.server.submit(this.code, info.swing, submission, ready);
  }

  /** Who has made ready for the open swing, and whether it is due at `now`. */
  async status(now: number): Promise<{ ready: Record<string, boolean>; due: boolean; closesAt: number }> {
    const info = await this.server.room(this.code);
    const subs = await this.server.submissions(this.code, info.swing);
    return { ready: Object.fromEntries(info.members.map((m) => [m.id, !!subs[m.id]?.ready])), due: due(info, subs, now), closesAt: info.openedAt + info.deadlineMs };
  }

  /** Asks the server to move on (it checks again); true if the swing was played. */
  async advanceIfDue(now: number): Promise<boolean> {
    const info = await this.server.room(this.code);
    if (!due(info, await this.server.submissions(this.code, info.swing), now)) return false;
    return this.server.advance(this.code, info.swing);
  }
}

/** Swings whose posted hashes disagree, with the members on each side. */
export function mismatches(info: RoomInfo): { swing: number; hashes: Record<string, string[]> }[] {
  const out: { swing: number; hashes: Record<string, string[]> }[] = [];
  for (const [swing, byMember] of Object.entries(info.hashes)) {
    const groups: Record<string, string[]> = {};
    for (const [member, hash] of Object.entries(byMember)) (groups[hash] ??= []).push(member);
    if (Object.keys(groups).length > 1) out.push({ swing: Number(swing), hashes: groups });
  }
  return out;
}
