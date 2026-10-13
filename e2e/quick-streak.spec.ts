import { expect, test } from '@playwright/test';
import { CYCLE, nodeLadder, nodePlayNext, startLadder, watchErrors } from './helpers.ts';

// Proposal P3 option A: a win streak shown on the result and the ladder home, no bonus. Seed 9 wins its first two
// matches with the CYCLE cards.
const SEED = 9;

test('shows the win streak after two wins in a row, on the result and the ladder home', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const node = nodePlayNext(nodePlayNext(nodeLadder(SEED)));
  expect(node.history.map((r) => r.won)).toEqual([true, true]);
  await startLadder(page, SEED);
  await expect(page.locator('#home-streak')).toHaveCount(0);
  await page.locator('#fast-mode').check();
  for (let m = 0; m < 2; m++) {
    await page.locator(m === 0 ? '#quick-play' : '#play-again').click();
    let i = 0;
    while (!page.url().includes('#/quick/result')) {
      if (await page.evaluate(() => document.body.dataset.quickPhase === 'choose' && !!document.querySelector('#card-attack'))) {
        await page.locator(`#card-${CYCLE[i % 3]!}`).click();
        i++;
        await expect.poll(() => page.evaluate(() => document.body.dataset.quickDecisions)).toBe(String(i));
      } else await page.waitForTimeout(30);
    }
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    if (m === 0) await expect(page.locator('#streak')).toHaveCount(0);
  }
  await expect(page.locator('#streak')).toHaveText('2 wins in a row');
  await page.locator('#to-ladder').click();
  await expect(page.locator('#home-streak')).toContainText('2 wins in a row');
  expect(errors).toEqual([]);
});
