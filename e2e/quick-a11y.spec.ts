import { expect, test } from '@playwright/test';
import { startLadder, watchErrors } from './helpers.ts';

// Quick screens without sight: a polite live region tells the score and the stakes, and focus lands where the keys are.
test.describe('quick screens for keyboard and screen-reader players', () => {
  test.setTimeout(120_000);

  test('announces the points, the big point with the choice, and the outcome; focus moves to the decision panel', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, 3);
    const announcer = page.locator('#announcer');
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(announcer).toHaveAttribute('aria-live', 'polite');
    await expect(announcer).toHaveText(/^\d+-\d+\. (Your|Their) point/);
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await expect(announcer).toHaveText(/(BIG POINT|MATCH POINT|MATCH POINT DOWN|\d+-ALL), \d+-\d+\. .* Choose 1 Attack, 2 Defend or 3 Counter\.$/);
    await expect(page.locator('#quick-panel')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#card-attack')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#outcome')).toBeVisible();
    await expect(announcer).toHaveText(/(your|their) point · \d+-\d+$/);
    expect(errors).toEqual([]);
  });
});
