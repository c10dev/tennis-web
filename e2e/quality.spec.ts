import { expect, test } from '@playwright/test';

// Render quality tiers (M7 step 9, ADR-022): the match shows its tier; `?quality=low` forces the low one.
test('plays a 3D match on the forced low tier without errors, and reports the tier', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?quality=low#/quick');
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await page.locator('#quick-play').click();
  await expect(page.locator('#view')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.dataset.quality)).toBe('low');
  await expect(page.locator('#card-attack')).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});
