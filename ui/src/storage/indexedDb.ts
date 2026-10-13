// SaveStore on the browser's IndexedDB: one object store keyed by slot (ADR-012). Covered by the e2e tests.
import { checkSlot, SLOTS, type SaveFile, type SaveStore, type Slot, type SlotSummary } from '@tennis/game';

const DB = 'tennis-sim';
const STORE = 'saves';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

export class IndexedDbStore implements SaveStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('Cannot open the save database'));
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async list(): Promise<SlotSummary[]> {
    const out: SlotSummary[] = [];
    for (const slot of SLOTS) {
      const file = await this.load(slot);
      if (file) out.push({ slot, ...file.summary });
    }
    return out;
  }

  async load(slot: Slot): Promise<SaveFile | null> {
    checkSlot(slot);
    const text = (await request((await this.store('readonly')).get(slot))) as string | undefined;
    return text ? (JSON.parse(text) as SaveFile) : null;
  }

  async save(slot: Slot, file: SaveFile): Promise<void> {
    checkSlot(slot);
    await request((await this.store('readwrite')).put(JSON.stringify(file), slot));
  }

  async remove(slot: Slot): Promise<void> {
    checkSlot(slot);
    await request((await this.store('readwrite')).delete(slot));
  }
}
