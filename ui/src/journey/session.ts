// Who this device is and which room it is in (ADR-033). On the web build the room server is this browser's storage
// until Supabase lands (R8); `?as=<id>` makes a tab act as another member (development and e2e).
import { RoomClient, type RoomServer, type Submission } from '@tennis/game';
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

/** This device's member id: `?as=` first, then a stored one, else a new one. */
export function me(): string {
  const as = new URLSearchParams(location.search).get('as');
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

let server: RoomServer | null = null;
export function roomServer(): RoomServer {
  server ??= new LocalRoomServer(store, me());
  return server;
}

const ACTIVE = () => `journey:active:${me()}`;
export const activeRoom = (): string | null => store.getItem(ACTIVE());
export const setActiveRoom = (code: string | null): void => (code ? store.setItem(ACTIVE(), code) : store.removeItem(ACTIVE()));

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
