// The save slots screen.
import { SLOTS, type Slot, type SlotSummary } from '../save/store.ts';

const LABEL: Record<Slot, string> = { auto: 'Autosave', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };

export function savesView(saved: readonly SlotSummary[]) {
  return SLOTS.map((slot) => {
    const s = saved.find((x) => x.slot === slot);
    return { slot, label: LABEL[slot], empty: !s, detail: s ? `${s.name} · week ${s.week} · ${s.savedAt}` : 'Empty' };
  });
}
