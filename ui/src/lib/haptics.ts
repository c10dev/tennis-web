// Haptics for the quick match (ADR-022): a tap on a pick, a cheer or a buzz on the verdict, a burst on a win.
// The web platform has none; Toss plays them through Device.triggerHaptic.
import { getPlatform, type Haptic } from '../platform/index.ts';

export type HapticEvent = 'pick' | 'read' | 'misread' | 'same' | 'win' | 'loss';

const PATTERN: Record<HapticEvent, Haptic> = { pick: 'tap', read: 'success', misread: 'error', same: 'tap', win: 'confetti', loss: 'basicMedium' };

export const hapticFor = (event: HapticEvent): Haptic => PATTERN[event];

export function buzz(event: HapticEvent): void {
  void getPlatform().then((p) => p.haptic(hapticFor(event)));
}
