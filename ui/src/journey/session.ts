// Who this device is and which room it is in (ADR-033). Practice seasons stay in this browser; rooms with friends use
// the Cloudflare room server when the build has one (VITE_ROOM_SERVER), else this browser too. `?as=<id>` makes a tab
// act as another member (dev builds only, for development and e2e).
import { RoomClient, type RoomServer, type Submission } from '@tennis/game';
import { CloudRoomServer } from './cloud-server.ts';
import { LocalRoomServer } from './local-server.ts';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeStorage(): Store {
  try {
    localStorage.setItem('journey:probe', '1');
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

export const store: Store = safeStorage();

function randomId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

/** `?as=<id>`: act as another member (dev builds only: its token is predictable). */
const devAs = (): string | null => (import.meta.env.DEV ? new URLSearchParams(location.search).get('as') : null);

/** This device's member id: `?as=` first (dev), then a stored one, else a new one. */
export function me(): string {
  const as = devAs();
  if (as) return as;
  let id = store.getItem('journey:me');
  if (!id) {
    id = randomId();
    store.setItem('journey:me', id);
  }
  return id;
}

export const randomSeed = (): number => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! >>> 1;
};

export type ServerKind = 'local' | 'cloud';

/** The room server's address (VITE_ROOM_SERVER at build time); `?server=local` keeps rooms in this browser. */
const CLOUD = (import.meta.env.VITE_ROOM_SERVER as string | undefined) ?? '';
export const roomsKind = (): ServerKind => (CLOUD && new URLSearchParams(location.search).get('server') !== 'local' ? 'cloud' : 'local');

/** This device's secret for the room server (with `?as=`, a fixed one per test member). */
function token(): string {
  const as = devAs();
  if (as) return `dev-token-${as}`.padEnd(20, '0');
  let t = store.getItem('journey:token');
  if (!t) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    t = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    store.setItem('journey:token', t);
  }
  return t;
}

const servers = new Map<ServerKind, RoomServer>();
export function roomServer(kind: ServerKind = activeKind() ?? roomsKind()): RoomServer {
  let s = servers.get(kind);
  if (!s) {
    s = kind === 'cloud' ? new CloudRoomServer(CLOUD, me(), token()) : new LocalRoomServer(store, me());
    servers.set(kind, s);
  }
  return s;
}

const ACTIVE = () => `journey:active:${me()}`;
interface Active {
  code: string;
  kind: ServerKind;
}
function readActive(): Active | null {
  const text = store.getItem(ACTIVE());
  if (!text) return null;
  return text.startsWith('{') ? (JSON.parse(text) as Active) : { code: text, kind: 'local' };
}
export const activeRoom = (): string | null => readActive()?.code ?? null;
export const activeKind = (): ServerKind | null => readActive()?.kind ?? null;
export const setActiveRoom = (code: string | null, kind: ServerKind = 'local'): void =>
  (code ? store.setItem(ACTIVE(), JSON.stringify({ code, kind })) : store.removeItem(ACTIVE()));

const clients = new Map<string, RoomClient>();
export function clientFor(code: string): RoomClient {
  let c = clients.get(code);
  if (!c) {
    c = new RoomClient(roomServer(), code);
    clients.set(code, c);
  }
  return c;
}

/** The plan being written for a swing, kept between visits until it is sent. */
const DRAFT = (code: string, swing: number) => `journey:draft:${me()}:${code}:${swing}`;
export function loadDraft(code: string, swing: number): Submission | null {
  const text = store.getItem(DRAFT(code, swing));
  return text ? (JSON.parse(text) as Submission) : null;
}
export const saveDraft = (code: string, swing: number, s: Submission): void => store.setItem(DRAFT(code, swing), JSON.stringify(s));

/** The last swing whose report this device has opened. */
const SEEN = (code: string) => `journey:seen:${me()}:${code}`;
export const reportSeen = (code: string): number => Number(store.getItem(SEEN(code)) ?? '0');
export const markReportSeen = (code: string, swings: number): void => store.setItem(SEEN(code), String(swings));
