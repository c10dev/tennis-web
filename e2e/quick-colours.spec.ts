import { expect, test } from '@playwright/test';

// Rally Pop phase 0 (ADR-018): cards and verdicts never rely on colour alone, and the three card colours stay apart
// for colour-blind players.
test('marks every card with an icon and its key, uses the colour-blind-safe trio, and words the verdict with a symbol', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('#quick-match').click();
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await page.locator('#fast-mode').check();
  await page.locator('#quick-play').click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 20_000 }).toBe('choose');
  for (const [card, colour] of [['attack', 'rgb(255, 122, 69)'], ['defend', 'rgb(74, 163, 255)'], ['counter', 'rgb(63, 211, 176)']] as const) {
    const btn = page.locator(`#card-${card}`);
    await expect(btn.locator('svg.icon')).toHaveCount(1);
    await expect(btn.locator('svg.icon')).toHaveAttribute('aria-hidden', 'true');
    await expect(btn).toHaveCSS('color', colour);
  }
  await page.locator('#card-attack').click();
  await expect(page.locator('#reveal .chip svg.icon')).toHaveCount(2);
  await expect(page.locator('#reveal .verdict')).toHaveText(/^(✓ You read it!|✗ They read you|= Same card)$/);
});
