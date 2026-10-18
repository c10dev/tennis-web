// One room as a Durable Object (ADR-033): its storage and clock behind RoomHandler, and the websockets of the devices
// watching it, told "changed" after every write (hibernating sockets, so an idle room costs nothing).
import { DurableObject } from 'cloudflare:workers';
import { RoomHandler, type Caller } from './handler.ts';

export class RoomObject extends DurableObject {
  private readonly handler = new RoomHandler(
    { get: (k) => this.ctx.storage.get(k), put: (k, v) => this.ctx.storage.put(k, v) },
    () => Date.now(),
    () => {
      for (const ws of this.ctx.getWebSockets()) ws.send('changed');
    },
  );

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    const caller: Caller | null = request.headers.get('x-member') ? { id: request.headers.get('x-member')!, token: request.headers.get('x-token') ?? '' } : null;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : null;
    const reply = await this.handler.handle(request.method, url.pathname, body, caller);
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  }

  override webSocketMessage(): void {}
}
