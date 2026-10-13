import { expect, test } from '@playwright/test';
import { readingHint, STYLE_BLURB } from '@tennis/game';
import { startLadder, watchErrors } from './helpers.ts';

// Getting into a quick match: the start form, the one-time reading tip (TD-027), and the 3D code fetched while the
// ladder waits for Play.
const SEED = 3;

test.describe('quick start', () => {
  test.setTimeout(180_000);

  test('explains the chosen style on the start form and keeps the seed under Advanced', async ({ page }) => {
    await page.goto('/#/');
    await page.locator('#quick-match').click();
    await expect(page.locator('#style-blurb')).toHaveText(STYLE_BLURB.big_server);
    await page.locator('#quick-style').selectOption('counter_puncher');
    await expect(page.locator('#style-blurb')).toHaveText(STYLE_BLURB.counter_puncher);
    await expect(page.locator('#quick-seed')).toBeHidden();
    await page.locator('#quick-advanced summary').click();
    await expect(page.locator('#quick-seed')).toBeVisible();
  });

  test('fetches the 3D code while the ladder waits for Play', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => scripts.push(r.url()));
    await startLadder(page, SEED);
    await expect.poll(() => scripts.some((u) => /replay\/broadcast/.test(u)), { timeout: 5000 }).toBe(true);
  });

  test('leaves the 3D code alone on the ladder in fast mode', async ({ browser }) => {
    // A fresh context: no cached modules, fast mode already on.
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL! });
    await context.addInitScript(() => localStorage.setItem('tennis-fast-mode', '1'));
    const page = await context.newPage();
    const scripts: string[] = [];
    page.on('request', (r) => scripts.push(r.url()));
    await startLadder(page, SEED);
    await expect(page.locator('#fast-mode')).toBeChecked();
    await page.waitForTimeout(1500);
    expect(scripts.some((u) => /replay\/broadcast/.test(u))).toBe(false);
    await context.close();
  });

  test('shows the reading tip at the first decision until dismissed, then never again (TD-027)', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await expect(page.locator('#hint')).toContainText(readingHint());
    await page.locator('#hint-dismiss').click();
    await expect(page.locator('#hint')).toHaveCount(0);
    await expect(page.locator('#quick-panel')).toBeFocused();
    await page.keyboard.press('Digit1');
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickDecisions)).toBe('1');
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await expect(page.locator('#hint')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('tennis-hints'))).toBe('seen');
    expect(errors).toEqual([]);
  });

  test('retires the reading tip when a card is picked without dismissing it', async ({ page }) => {
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(page.locator('#hint')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Digit2');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tennis-hints'))).toBe('seen');
  });
});
