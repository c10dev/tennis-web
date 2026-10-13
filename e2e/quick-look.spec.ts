import { expect, test, type Page } from '@playwright/test';
import { playToResult, startLadder } from './helpers.ts';

// The Rally Pop look of the DOM screens (TD-045): screenshot comparisons of the quick ladder, a fast-mode decision and
// the result's end state. No 3D (fast mode), animations off, fonts loaded first. The renders are identical run to run,
// so the tolerance is a few pixels: a one-letter change fails (a ratio like 1% let whole changed lines pass). After a deliberate visual change,
// refresh the baselines with `npx playwright test e2e/quick-look.spec.ts --update-snapshots` and review the PNGs.
const shot = { animations: 'disabled', caret: 'hide', maxDiffPixels: 10 } as const;

async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

test.describe('quick screens look', () => {
  test.setTimeout(120_000);
  test.beforeEach(async ({ page }) => {
    // The reading tip has its own test; these pictures show the screens a returning player sees.
    await page.addInitScript(() => localStorage.setItem('tennis-hints', 'seen'));
  });

  test('ladder home', async ({ page }) => {
    await startLadder(page, 3);
    await fontsReady(page);
    await expect(page).toHaveScreenshot('home.png', shot);
  });

  test('decision panel (fast mode)', async ({ page }) => {
    await startLadder(page, 3);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await page.mouse.move(0, 0);
    await fontsReady(page);
    await expect(page.locator('#quick-panel')).toHaveScreenshot('decision.png', shot);
  });

  test('result end state', async ({ page }) => {
    // Tall enough for the whole result, so the fixed header does not cover a scrolled element.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await playToResult(page, 3, true);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    await fontsReady(page);
    await expect(page.locator('#quick-result')).toHaveScreenshot('result.png', shot);
  });
});
