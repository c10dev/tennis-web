// What the game needs from where it runs (ADR-022): a plain browser (web.ts) or the Toss app (toss.ts). Screens
// talk to this interface only, so the web build never loads the Apps in Toss SDK.

/** Small string settings (fast mode, game plan, sound). Never throws: refused storage reads as empty. */
export interface Kv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The haptic patterns the game uses (a subset of the SDK's `Device.triggerHaptic` types). */
export type Haptic = 'tap' | 'success' | 'error' | 'confetti' | 'basicMedium';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Platform {
  readonly kind: 'web' | 'toss';
  /** A stable per-user key for this game (Toss), or null where there is none (web). */
  userKey(): Promise<string | null>;
  readonly kv: Kv;
  haptic(type: Haptic): void;
  /** Handles the hardware back button; while subscribed the default back is blocked. Returns an unsubscribe. */
  onBack(handler: () => void): () => void;
  /** Leaves the game (Toss) or goes back to the title (web). */
  close(): Promise<void>;
  /** Calls `handler` with the safe-area insets whenever they change; returns an unsubscribe. */
  safeArea(handler: (insets: Insets) => void): () => void;
  lockPortrait(): Promise<void>;
}
