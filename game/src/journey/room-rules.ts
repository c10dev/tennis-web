// A room's rules on the server side (ADR-033), as pure functions over its record, so the in-memory server, the
// browser's local server and the Cloudflare room object all keep the same ones. Errors are Korean for the screens.
import type { Submission } from './fold.ts';
import type { Member } from './room.ts';
import type { RoomInfo, SubmissionRecord } from './server.ts';

export const DEADLINE_MS = 12 * 60 * 60 * 1000;
export const MAX_MEMBERS = 8;

export class RoomError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

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

export const isInviteCode = (code: string): boolean => /^[A-HJ-NP-Z2-9]{6}$/.test(code);

/** True when the swing can be played: everyone ready, or the deadline gone. */
export function due(info: RoomInfo, subs: Readonly<Record<string, SubmissionRecord>>, now: number): boolean {
  return info.members.every((m) => subs[m.id]?.ready) || now >= info.openedAt + info.deadlineMs;
}

export function newRoom(code: string, host: Member, seed: number, now: number): RoomInfo {
  checkMember(host);
  return { code, host: host.id, seed, phase: 'lobby', members: [host], swing: 0, openedAt: now, deadlineMs: DEADLINE_MS, hashes: {} };
}

export function join(info: RoomInfo, m: Member): RoomInfo {
  checkMember(m);
  if (info.members.some((x) => x.id === m.id)) return info;
  if (info.phase !== 'lobby') throw new RoomError('이미 시즌이 시작된 방이에요', 409);
  if (info.members.length >= MAX_MEMBERS) throw new RoomError('방이 가득 찼어요', 409);
  return { ...info, members: [...info.members, m] };
}

export function start(info: RoomInfo, userId: string, now: number): RoomInfo {
  if (info.host !== userId) throw new RoomError('방장만 시즌을 시작할 수 있어요', 403);
  if (info.phase === 'season') return info;
  return { ...info, phase: 'season', openedAt: now };
}

/** The member's submission for the open swing, added to the swing's records. */
export function submit(info: RoomInfo, subs: Readonly<Record<string, SubmissionRecord>>, userId: string, swing: number, s: Submission, ready: boolean): Record<string, SubmissionRecord> {
  if (info.phase !== 'season' || swing !== info.swing) throw new RoomError('이 구간은 이미 진행됐어요', 409);
  if (!info.members.some((m) => m.id === userId)) throw new RoomError('이 방의 참가자가 아니에요', 403);
  checkSubmission(s);
  return { ...subs, [userId]: { answers: s.answers, plan: s.plan, ready } };
}

/** The room moved past `swing` when it is due; null when it is not (or the swing is not the open one). */
export function advance(info: RoomInfo, subs: Readonly<Record<string, SubmissionRecord>>, swing: number, now: number): RoomInfo | null {
  if (info.phase !== 'season' || info.swing !== swing || !due(info, subs, now)) return null;
  return { ...info, swing: swing + 1, openedAt: now };
}

export function postHash(info: RoomInfo, userId: string, swing: number, hash: string): RoomInfo {
  if (!info.members.some((m) => m.id === userId)) throw new RoomError('이 방의 참가자가 아니에요', 403);
  if (!/^[0-9a-f]{8}$/.test(hash) || swing < 0 || swing >= info.swing) throw new RoomError('잘못된 기록이에요');
  return { ...info, hashes: { ...info.hashes, [swing]: { ...(info.hashes[swing] ?? {}), [userId]: hash } } };
}

/** Shape checks for what comes over the wire (the plan's game rules are checked when it is folded, TD-084). */
function checkMember(m: Member): void {
  const ok = typeof m.id === 'string' && m.id.length > 0 && m.id.length <= 40 && typeof m.name === 'string' && m.name.trim().length > 0 && m.name.length <= 12
    && typeof m.nation === 'string' && typeof m.style === 'string' && (m.hand === 'right' || m.hand === 'left') && typeof m.talents === 'object' && Array.isArray(m.focus);
  if (!ok) throw new RoomError('선수 정보가 올바르지 않아요');
}

function checkSubmission(s: Submission): void {
  const ok = s && Array.isArray(s.answers) && s.answers.length <= 10 && s.answers.every((a) => typeof a === 'string' && a.length <= 40)
    && s.plan && Array.isArray(s.plan.events) && s.plan.events.length <= 12 && s.plan.events.every((e) => typeof e === 'string')
    && Array.isArray(s.plan.focus) && s.plan.focus.length <= 2;
  if (!ok) throw new RoomError('계획 형식이 올바르지 않아요');
}
