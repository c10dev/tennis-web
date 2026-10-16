// Carries out the back button (ADR-022, M7 step 8): Toss's Android back (platform.onBack) and, on the web, Escape in
// a match. lib/back.ts decides; this asks, concedes, goes to the ladder or leaves the game.
import { U } from '../i18n/index.ts';
import { backAction } from '../lib/back.ts';
import { closeDialog, confirmDialog, dialogOpen } from '../lib/confirm.ts';
import { currentRoute, go } from '../lib/router.ts';
import type { Platform } from '../platform/index.ts';
import type { Screen } from './context.ts';

export function installBack(platform: Platform, screen: () => Screen | null): void {
  async function back() {
    switch (backAction(currentRoute(), dialogOpen())) {
      case 'close-modal':
        closeDialog();
        return;
      case 'ladder':
        go('#/quick');
        return;
      case 'confirm-concede':
        if (await confirmDialog(U.concede)) screen()?.concede?.();
        return;
      case 'confirm-exit':
        if (await confirmDialog(U.leave)) await platform.close();
        return;
      case 'none':
        return;
    }
  }
  platform.onBack(() => void back());
  // The web has no back event of its own for a match; Escape asks to concede (an open dialog handles its own Escape).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialogOpen() && backAction(currentRoute(), false) === 'confirm-concede') void back();
  });
}
