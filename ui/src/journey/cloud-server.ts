// The room server on Cloudflare (ADR-033) from the browser: plain fetch with this device's member id and secret token,
// and a websocket per watched room that says "changed" (reconnecting, with a slow poll as a fallback).
import type { Member, RoomInfo, RoomServer, Submission, SubmissionRecord } from '@tennis/game';

export class CloudRoomServer implements RoomServer {
  constructor(private readonly base: string, private readonly id: string, private readonly token: string) {}

  me = async (): Promise<string> => this.id;

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-member': this.id, 'x-token': this.token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(data.error ?? `서버 오류 (${res.status})`);
    return data;
  }

  createRoom = (host: Omit<Member, 'id'>, seed: number) => this.call<RoomInfo>('POST', '/rooms', { host, seed });
  joinRoom = (code: string, member: Omit<Member, 'id'>) => this.call<RoomInfo>('POST', `/rooms/${code}/join`, { member });
  room = (code: string) => this.call<RoomInfo>('GET', `/rooms/${code}`);
  start = (code: string) => this.call<RoomInfo>('POST', `/rooms/${code}/start`, {});
  submit = async (code: string, swing: number, submission: Submission, ready: boolean) => void (await this.call('POST', `/rooms/${code}/submit`, { swing, submission, ready }));
  submissions = (code: string, swing: number) => this.call<Record<string, SubmissionRecord>>('GET', `/rooms/${code}/submissions/${swing}`);
  advance = async (code: string, swing: number) => (await this.call<{ moved: boolean }>('POST', `/rooms/${code}/advance`, { swing })).moved;
  postHash = async (code: string, swing: number, hash: string) => void (await this.call('POST', `/rooms/${code}/hash`, { swing, hash }));

  subscribe(code: string, onChange: () => void): () => void {
    let socket: WebSocket | null = null;
    let closed = false;
    let retry = 1000;
    const open = () => {
      if (closed) return;
      socket = new WebSocket(`${this.base.replace(/^http/, 'ws')}/rooms/${code}/ws`);
      socket.onmessage = () => onChange();
      socket.onopen = () => (retry = 1000);
      socket.onclose = () => {
        if (closed) return;
        window.setTimeout(open, retry);
        retry = Math.min(30_000, retry * 2);
      };
    };
    open();
    const poll = window.setInterval(onChange, 60_000);
    return () => {
      closed = true;
      window.clearInterval(poll);
      socket?.close();
    };
  }
}
