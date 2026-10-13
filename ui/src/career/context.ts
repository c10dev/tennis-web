// What every career screen gets: the season, the save store, navigation and the actions that change the season.
import type { SaveStore, SeasonState, Slot } from '@tennis/game';
import type { Tactic } from '@tennis/engine';

export interface Screen {
  element: HTMLElement;
  /** Full-screen screens (the match) skip the header. */
  bare?: boolean;
  dispose?(): void;
}

export interface Ctx {
  readonly state: SeasonState | null;
  readonly store: SaveStore;
  /** One-line message for the next screen ("Week 4: trained serve"). */
  readonly note: string | null;
  /** The tactic the user set for their next match. */
  tactic: Tactic;
  go(path: string): void;
  /** Replace the season (and re-render); optionally leave a note. */
  set(state: SeasonState, note?: string): void;
  /** Close the week, autosave, and go home with a note. */
  finishWeek(state: SeasonState, note: string): Promise<void>;
  loadSlot(slot: Slot): Promise<void>;
  saveSlot(slot: Slot): Promise<void>;
}
