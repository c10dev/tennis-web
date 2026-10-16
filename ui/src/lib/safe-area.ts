// Safe-area tokens (ADR-022): `--safe-top/right/bottom/left` default to the CSS env() insets (theme.css); in Toss the
// platform reports them (SafeArea), and these overrides follow every change.
import type { Insets, Platform } from '../platform/index.ts';

export function insetVars(i: Insets): Record<string, string> {
  const px = (n: number) => `${Math.max(0, Math.round(n))}px`;
  return { '--safe-top': px(i.top), '--safe-right': px(i.right), '--safe-bottom': px(i.bottom), '--safe-left': px(i.left) };
}

/** Keeps the root's safe-area tokens on the platform's insets; the web platform reports none (env() stays). */
export function followSafeArea(platform: Platform, root: HTMLElement): () => void {
  return platform.safeArea((insets) => {
    for (const [k, v] of Object.entries(insetVars(insets))) root.style.setProperty(k, v);
  });
}
