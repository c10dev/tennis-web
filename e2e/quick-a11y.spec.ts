import { expect, test } from '@playwright/test';
import { quickResultView } from '@tennis/game';
import { nodeLadder, nodePlayNext, playToResult, startLadder, watchErrors } from './helpers.ts';

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
    // Each card names how well it suits the player, the strength bar's meaning, for touch and screen readers.
    await expect(page.locator('#card-attack')).toHaveAccessibleName(/Suits you \d+%/);
    // The first decision carries the reading tip (TD-027): its Got it comes first, then the cards.
    await page.keyboard.press('Tab');
    await expect(page.locator('#hint-dismiss')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#card-attack')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#outcome')).toBeVisible();
    await expect(announcer).toHaveText(/(your|their) point · \d+-\d+$/);
    expect(errors).toEqual([]);
  });

  test('sums up the result when its reveal ends: score, points, rank and the next goal', async ({ page }) => {
    await playToResult(page, 3, true);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    const v = quickResultView(nodePlayNext(nodeLadder(3)));
    await expect(page.locator('#announcer')).toHaveText(
      `${v.headline} against ${v.opponent}. ${v.delta >= 0 ? '+' : ''}${v.delta} points, now #${v.rankAfter}. Next goal: ${v.goalLine}.`);
  });
});
