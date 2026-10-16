import { expect, test, type Page } from '@playwright/test';

// Back and concede (ADR-022, M7 step 8) on the web build: Escape in a match asks before conceding; a concede is a loss.

async function toMatch(page: Page) {
  await page.goto('/#/quick');
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await page.locator('#fast-mode').check();
  await page.locator('#quick-play').click();
  await expect(page.locator('#quick-panel')).toBeVisible();
}

test.describe('back and concede', () => {
  test('Escape asks before conceding; keep playing closes the dialog and the match goes on', async ({ page }) => {
    await toMatch(page);
    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Concede this match?');
    await expect(page.locator('#confirm-cancel')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/#\/quick\/match$/);
    await expect(page.locator('#card-attack')).toBeVisible({ timeout: 30_000 });
  });

  test('conceding ends the match as a loss with no decisive point', async ({ page }) => {
    await toMatch(page);
    await page.keyboard.press('Escape');
    await page.locator('#confirm-ok').click();
    await expect(page).toHaveURL(/#\/quick\/result$/);
    await expect(page.locator('#quick-result h1')).toHaveText(/^You conceded \d+-\d+$/);
    await expect(page.locator('#decisive')).toHaveCount(0);
    await page.locator('#quick-result').click({ position: { x: 5, y: 5 } });
    await page.locator('#to-ladder').click();
    await expect(page.locator('#recent li').first()).toHaveText(/^L · /);
  });
});
