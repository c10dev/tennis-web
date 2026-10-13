import { expect, test } from '@playwright/test';
import { playToResult, watchErrors } from './helpers.ts';

// Result-screen details fixed on 2026-10-14: the next goal's padding inside its lock ring, and a 3D replay that starts
// on its first frame (TD-037).
test.describe('quick result details', () => {
  test.setTimeout(180_000);

  test('keeps the next goal\'s label and line inside its gold lock ring', async ({ page }) => {
    await playToResult(page, 3, true);
    await page.keyboard.press('Enter');
    await expect(page.locator('#next-goal')).toHaveClass(/is-locked/);
    const gap = await page.locator('#next-goal').evaluate((el) => {
      const box = el.getBoundingClientRect();
      const label = el.querySelector('.kicker')!.getBoundingClientRect();
      const line = el.querySelector('strong')!.getBoundingClientRect();
      return { top: label.top - box.top, bottom: box.bottom - line.bottom };
    });
    // The ring is a 2 px inset shadow; text needs clear space inside it, not just the ring's width.
    expect(gap.top).toBeGreaterThanOrEqual(8);
    expect(gap.bottom).toBeGreaterThanOrEqual(8);
  });

  test('starts the 3D replay on its first frame instead of skipping what a slow first frame took (TD-037)', async ({ page }) => {
    const errors = watchErrors(page);
    // Every drawn frame writes data-t; record it with the result phase and the window the clip starts from.
    await page.addInitScript(() => {
      const w = window as unknown as { __frames: { t: string; from: string | undefined; phase: string | undefined }[] };
      w.__frames = [];
      new MutationObserver(() => {
        const d = document.body?.dataset;
        if (d?.t && w.__frames.at(-1)?.t !== d.t) w.__frames.push({ t: d.t, from: d.clipFrom, phase: d.resultPhase });
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-t'] });
    });
    await playToResult(page, 3, false);
    await expect(page.locator('#decisive-replay #view')).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __frames: { phase?: string }[] }).__frames.filter((f) => f.phase === 'replay-3d').length)).toBeGreaterThan(3);
    const first = await page.evaluate(() => (window as unknown as { __frames: { t: string; from: string | undefined; phase: string | undefined }[] }).__frames.find((f) => f.phase === 'replay-3d'));
    expect(first!.from).toMatch(/^\d+\.\d\d$/);
    expect(first!.t).toBe(first!.from);
    expect(errors).toEqual([]);
  });
});
