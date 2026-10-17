// Safe-area tokens (ADR-022): `--safe-top/right/bottom/left` default to the CSS env() insets (theme.css); in Toss the
// platform reports them (SafeArea), and these overrides follow every change.
import type { Insets, Platform } from '../platform/index.ts';

export function insetVars(i: Insets): Record<string, string> {
  const px = (n: number) => `${Math.max(0, Math.round(n))}px`;
  return { '--safe-top': px(i.top), '--safe-right': px(i.right), '--safe-bottom': px(i.bottom), '--safe-left': px(i.left) };
}

/** The CSS env() insets the WebView reports, for comparing with the platform's (read from a probe element). */
function envInsets(): string {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.append(probe);
  const c = getComputedStyle(probe);
  const out = `${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft}`;
  probe.remove();
  return out;
}

/**
 * Keeps the root's safe-area tokens on the platform's insets; the web platform reports none (env() stays). In Toss
 * every value is also logged, with the WebView's env() insets, so the web debug tools' Log tab shows what the device
 * gives (the iOS header overlap of the 2026-10-17 device test).
 */
export function followSafeArea(platform: Platform, root: HTMLElement): () => void {
  return platform.safeArea((insets) => {
    for (const [k, v] of Object.entries(insetVars(insets))) root.style.setProperty(k, v);
    if (platform.kind === 'toss') console.info('[safe-area] toss', JSON.stringify(insets), 'env', envInsets(), `viewport ${innerWidth}x${innerHeight}`);
  });
}
