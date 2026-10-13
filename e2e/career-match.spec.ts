import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_TACTIC, fingerprint, replayMatch } from '@tennis/engine';
import { beginWeek, createPlayer, defaultAllocation, newSeason, pendingUserMatch, quickRecipe } from '@tennis/game';
import { newCareer, watchErrors } from './helpers.ts';

// The season's match screen (2026-10-14 bug hunt): set breaks, Skip, Leave and Back.
const SEED = 4;
const aggressive = { ...DEFAULT_TACTIC, aggression: 0.9 };

function firstMatch() {
  const s = newSeason(SEED, createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, SEED));
  return pendingUserMatch(beginWeek(s, { kind: 'enter' }))!;
}

/** Into the first match and on to the end of its first set. */
async function toSetBreak(page: Page, seed = SEED) {
  await newCareer(page, seed);
  await page.locator('#enter').click();
  await page.locator('#watch').click();
  await expect(page.locator('body')).toHaveAttribute('data-t', /\d/);
  await page.evaluate(() => {
    const s = document.querySelector<HTMLInputElement>('.seek')!;
    s.value = s.max;
    s.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('#set-break')).toBeVisible();
}

const t = async (page: Page) => Number(await page.locator('body').getAttribute('data-t'));

test.describe('career match screen', () => {
  test('carries on from the set break after Space, instead of replaying the match from the start', async ({ page }) => {
    const errors = watchErrors(page);
    await toSetBreak(page);
    const paused = await t(page);
    await page.locator('body').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.locator('#next-set').click();
    await expect.poll(() => t(page)).toBeGreaterThan(paused);
    expect(errors).toEqual([]);
  });

  test('keeps the tactics picked at the set break when the match is skipped to its result', async ({ page }) => {
    await toSetBreak(page);
    await page.locator('#aggression').fill('0.9');
    await page.locator('#skip').click();
    await expect(page.locator('#match-result')).toBeVisible();
    const expected = replayMatch({ ...quickRecipe(firstMatch(), DEFAULT_TACTIC), tacticChanges: [{ afterSet: 1, player: 'A', tactic: aggressive }] });
    await expect(page.locator('body')).toHaveAttribute('data-fingerprint', fingerprint(expected));
  });

  test('hides Leave once the result is shown, and gives Space back to the broadcast after a mouse click on Skip', async ({ page }) => {
    await toSetBreak(page);
    await page.locator('#skip').click();
    await expect(page.locator('#match-result')).toBeVisible();
    await expect(page.locator('#leave')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('skip');
  });

  test('does not open the next round on Back after Back to the tournament', async ({ page }) => {
    // Seed 9: the user wins the first match, so there is a next round to open.
    await toSetBreak(page, 9);
    await page.locator('#skip').click();
    await page.locator('#back-to-tournament').click();
    await expect(page.locator('#draw')).toBeVisible();
    await page.goBack();
    await page.waitForTimeout(500);
    expect(page.url()).not.toMatch(/#\/match/);
    await expect(page.locator('#view')).toHaveCount(0);
  });

  test('forgets the set-break tactics when the match is left unplayed', async ({ page }) => {
    await toSetBreak(page);
    await page.locator('#aggression').fill('0.9');
    await page.locator('#leave').click();
    await expect(page.locator('#draw')).toBeVisible();
    await expect(page.locator('#aggression')).toHaveValue(String(DEFAULT_TACTIC.aggression));
  });

  test('does not come back to a replay on Back after its Back button', async ({ page }) => {
    await newCareer(page, SEED);
    await page.locator('#enter').click();
    await expect(page.locator('#draw')).toBeVisible();
    for (let i = 0; i < 20 && !(await page.locator('#finish-week').isVisible()); i++) {
      if (await page.locator('#quick').isVisible()) await page.locator('#quick').click();
      else await page.locator('#play-all').click();
    }
    await page.locator('#finish-week').click();
    await page.locator('#calendar a').first().click();
    await page.locator('#replay-0').click();
    await expect(page.locator('#view')).toBeVisible();
    await page.locator('#leave').click();
    await expect(page.locator('#history')).toBeVisible();
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page.locator('#view')).toHaveCount(0);
  });
});
