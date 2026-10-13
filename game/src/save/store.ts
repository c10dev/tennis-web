// Where saves live: the SaveStore interface, with an in-memory store for tests. The browser's IndexedDB store is
// in ui/ (the game layer has no DOM).
import type { SaveFile, SaveSummary } from './format.ts';

export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type Slot = (typeof SLOTS)[number];

export interface SlotSummary extends SaveSummary {
  slot: Slot;
}

export interface SaveStore {
  /** Saved slots in SLOTS order. */
  list(): Promise<SlotSummary[]>;
  load(slot: Slot): Promise<SaveFile | null>;
  save(slot: Slot, file: SaveFile): Promise<void>;
  remove(slot: Slot): Promise<void>;
}

export function checkSlot(slot: string): asserts slot is Slot {
  if (!(SLOTS as readonly string[]).includes(slot)) throw new RangeError(`Unknown save slot ${slot}`);
}

/** Keeps saves as JSON text, so tests see the same round trip a real store makes. */
export class MemoryStore implements SaveStore {
  private readonly saves = new Map<Slot, string>();

  async list(): Promise<SlotSummary[]> {
    return SLOTS.filter((s) => this.saves.has(s)).map((slot) => ({ slot, ...(JSON.parse(this.saves.get(slot)!) as SaveFile).summary }));
  }

  async load(slot: Slot): Promise<SaveFile | null> {
    checkSlot(slot);
    const text = this.saves.get(slot);
    return text ? (JSON.parse(text) as SaveFile) : null;
  }

  async save(slot: Slot, file: SaveFile): Promise<void> {
    checkSlot(slot);
    this.saves.set(slot, JSON.stringify(file));
  }

  async remove(slot: Slot): Promise<void> {
    checkSlot(slot);
    this.saves.delete(slot);
  }
}
