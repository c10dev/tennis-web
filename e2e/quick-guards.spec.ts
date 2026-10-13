import { expect, test } from '@playwright/test';
import { fillSeed, nodeLadder, nodePlayNext, playToResult, startLadder, watchErrors } from './helpers.ts';

// Quick-match flow guards from a bug hunt (2026-10-14): input in the wrong phase, history, final scores, failing
// storage, long names, and Space on a focused button.
test.describe('quick flow guards', () => {
  test.setTimeout(180_000);

  test('ignores card keys while points tick by: a card is chosen only on the choose screen', async ({ page }) => {
    await startLadder(page, 1);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('auto');
    await page.keyboard.press('Digit1');
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    expect(await page.evaluate(() => document.body.dataset.quickDecisions)).toBe('0');
  });

  test('lets Back leave the ladder after a match instead of trapping it on #/quick', async ({ page }) => {
    await playToResult(page, 3, true);
    for (let i = 0; i < 6 && !(await page.locator('#quick-match').isVisible()); i++) await page.goBack();
    await expect(page.locator('#quick-match')).toBeVisible();
  });

  test('shows the final score on the outcome of a match decided by a card', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __outcomes: string[] };
      w.__outcomes = [];
      new MutationObserver(() => {
        const t = document.querySelector('#outcome')?.textContent;
        if (t && w.__outcomes.at(-1) !== t) w.__outcomes.push(t);
      }).observe(document, { childList: true, subtree: true });
    });
    await playToResult(page, 1, true);
    const record = nodePlayNext(nodeLadder(1)).history[0]!;
    const last = await page.evaluate(() => (window as unknown as { __outcomes: string[] }).__outcomes.at(-1)!);
    if (record.decisions!.at(-1) && record.recipe.cards!.at(-1)) expect(last).toMatch(new RegExp(`· ${record.score.replace('–', '-')}$`));
    expect(last).not.toMatch(/· 0-0$/);
  });

  test('carries on to the result when the save fails, instead of freezing on the last point', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, 3);
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = () => { throw new Error('quota exceeded'); };
    });
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    let i = 0;
    while (!page.url().includes('#/quick/result') && i < 400) {
      if (await page.evaluate(() => document.body.dataset.quickPhase === 'choose')) await page.keyboard.press(`Digit${i % 3 + 1}`);
      await page.waitForTimeout(50);
      i++;
    }
    await expect(page.locator('#quick-result')).toBeVisible();
    expect(errors.filter((e) => !/quota exceeded/.test(e))).toEqual([]);
  });

  test('fits a long one-word name on the phone home without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/#/');
    await page.locator('#quick-match').click();
    await page.locator('#quick-name').fill('A'.repeat(24));
    await fillSeed(page, 3);
    await page.locator('#quick-start').click();
    await expect(page.locator('#quick-play')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('lets Space press a focused button during the result reveal instead of skipping', async ({ page }) => {
    await playToResult(page, 3, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('replay');
    await page.locator('#sound-toggle').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => document.querySelector('#quick-result')!.classList.contains('is-skipped'))).toBe(false);
  });
});

