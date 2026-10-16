import { expect, test, type Page } from '@playwright/test';

// Sound in the quick match (ADR-022, M7 step 6): one on/off setting, remembered; sound starts on the Play tap,
// stops when the page goes to the background and comes back on return.

async function startLadder(page: Page) {
  await page.goto('/#/quick');
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await expect(page.locator('#quick-play')).toBeVisible();
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.describe('quick-match sound', () => {
  test('has one sound switch, on by default, remembered after a reload', async ({ page }) => {
    await startLadder(page);
    const toggle = page.locator('#sound-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('Sound on');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sound-toggle')).toContainText('Sound off');
  });

  test('starts on Play, pauses in the background and resumes on return; no mixer panel in the match', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startLadder(page);
    await page.locator('#quick-play').click();
    await expect(page.locator('#quick-panel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('running');
    await expect(page.locator('#sound .sliders')).toHaveCount(0);
    await expect(page.locator('#sound-toggle')).toBeVisible();
    await setHidden(page, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('suspended');
    await setHidden(page, false);
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('running');
    // Off in the match: silent, and stays silent after a return from the background.
    await page.locator('#sound-toggle').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('off');
    await setHidden(page, true);
    await setHidden(page, false);
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('off');
    expect(errors).toEqual([]);
  });
});
