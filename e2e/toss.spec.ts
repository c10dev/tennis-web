import { expect, test } from '@playwright/test';

// The toss build (`vite --mode toss`, ADR-022): the quick match only, no season mode, no dev replay page.
test.describe('toss target', () => {
  test('lands on the ladder start form and plays from there, without errors on the mocked SDK', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/quick$/);
    await expect(page.locator('#quick-start')).toBeVisible();
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await expect(page.locator('#quick-play')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('sends season routes and the title to the ladder', async ({ page }) => {
    for (const path of ['/#/', '/#/new', '/#/saves', '/#/home', '/#/nowhere']) {
      await page.goto(path);
      await expect(page).toHaveURL(/#\/quick$/);
      await expect(page.locator('#new-career')).toHaveCount(0);
    }
  });

  test('ignores ?seed= (no dev replay page)', async ({ page }) => {
    await page.goto('/?seed=42&surface=clay');
    await expect(page).toHaveURL(/#\/quick$/);
    await expect(page.locator('#controls')).toHaveCount(0);
  });
});
