// The room server (ADR-033) on Cloudflare: the Worker sends `/rooms/:code/...` to that room's Durable Object; a new
// room gets a random invite code first. The room never simulates; devices fold its log (lockstep).
import { roomRules } from '@tennis/game';
import { RoomObject } from './room-object.ts';

export { RoomObject };

export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-member, x-token',
  'access-control-max-age': '86400',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

function randomCode(): string {
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return roomRules.inviteCode(n[0]! * 4096 + (n[1]! % 4096));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'rooms') return json({ error: '알 수 없는 요청이에요' }, 404);
    if (parts.length === 1 && request.method === 'POST') {
      const body = await request.text();
      for (let i = 0; i < 5; i++) {
        const code = randomCode();
        const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(`https://room/init`, {
          method: 'POST', headers: request.headers, body: JSON.stringify({ ...JSON.parse(body || '{}'), code }),
        }));
        if (res.status !== 409) return withCors(res);
      }
      return json({ error: '방 코드를 만들지 못했어요' }, 503);
    }
    const code = parts[1] ?? '';
    if (!roomRules.isInviteCode(code)) return json({ error: '초대 코드가 올바르지 않아요' }, 400);
    const rest = parts.slice(2).join('/');
    const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(`https://room/${rest}${url.search}`, request));
    return res.webSocket ? res : withCors(res);
  },
} satisfies ExportedHandler<Env>;

function withCors(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}
