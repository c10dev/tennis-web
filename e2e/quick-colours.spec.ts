import { expect, test } from '@playwright/test';

// Rally Pop phase 0 (ADR-018): cards and verdicts never rely on colour alone, and the three card colours stay apart
// for colour-blind players.
test('marks every card with an icon and its key, uses the colour-blind-safe trio, and words the verdict with a symbol', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('#quick-match').click();
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await page.locator('#fast-mode').check();
  await page.locator('#quick-play').click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 20_000 }).toBe('choose');
  for (const [card, colour] of [['attack', 'rgb(255, 122, 69)'], ['defend', 'rgb(74, 163, 255)'], ['counter', 'rgb(63, 211, 176)']] as const) {
    const btn = page.locator(`#card-${card}`);
    await expect(btn.locator('svg.icon')).toHaveCount(1);
    await expect(btn.locator('svg.icon')).toHaveAttribute('aria-hidden', 'true');
    await expect(btn).toHaveCSS('color', colour);
  }
  await page.locator('#card-attack').click();
  await expect(page.locator('#reveal .chip svg.icon')).toHaveCount(2);
  await expect(page.locator('#reveal .verdict')).toHaveText(/^(✓ You read it!|✗ They read you|= Same card)$/);
});

// Rally Pop phase 1a (ADR-020): the self-hosted faces load (a wrong path would only fall back silently).
test('loads the self-hosted Rally Pop fonts', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#quick-match')).toBeVisible();
  const loaded = await page.evaluate(async () => {
    const faces: [string, string][] = [['Lilita One', '400'], ['Nunito', '600'], ['Nunito', '800'], ['Barlow Condensed', '600'], ['Barlow Condensed', '700']];
    await Promise.all(faces.map(([f, w]) => document.fonts.load(`${w} 16px "${f}"`)));
    return faces.filter(([f, w]) => [...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.weight === w && x.status === 'loaded'));
  });
  expect(loaded).toHaveLength(5);
  await expect(page.locator('.title h1')).toHaveCSS('font-family', /Lilita One/);
  await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/);
});
