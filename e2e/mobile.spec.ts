import { expect, test, type Locator, type Page } from '@playwright/test';

// The toss build on a phone (ADR-022, M7 step 4): portrait, touch, safe area, and the top-right corner left to Toss's
// close and more buttons. Runs in the `mobile` project (Pixel 7, touch) against the toss server.

type Box = { x: number; y: number; width: number; height: number };
const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The page's tokens, in pixels. */
async function tokens(page: Page) {
  return page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const px = (name: string) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name})`;
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    return { safeTop: px('--safe-top'), safeBottom: px('--safe-bottom'), navReserve: px('--nav-reserve'), width: innerWidth, height: innerHeight, raw: css.getPropertyValue('--nav-reserve') };
  });
}

/** The area Toss draws its buttons in: the top-right corner. */
const tossCorner = (t: { width: number; safeTop: number; navReserve: number }): Box => ({ x: t.width - t.navReserve, y: 0, width: t.navReserve, height: t.safeTop + 52 });

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
}

async function startLadder(page: Page) {
  await page.goto('/');
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').tap();
  await expect(page.locator('#quick-play')).toBeVisible();
}

test.describe('phone layout (toss build)', () => {
  test('ladder: fits the width, leaves the Toss corner free, big touch targets', async ({ page }) => {
    await startLadder(page);
    const t = await tokens(page);
    expect(t.navReserve).toBeGreaterThan(0);
    await noSideScroll(page);
    for (const id of ['#quick-play', '#plan-aggressive', '#plan-balanced', '#plan-defensive']) {
      expect((await box(page.locator(id))).height).toBeGreaterThanOrEqual(44);
    }
    for (const el of await page.locator('header.top a, header.top nav').all()) expect(overlaps(await box(el), tossCorner(t))).toBe(false);
  });

  test('decision point: the court on top, the cards in one row below, nothing over the score or the Toss corner', async ({ page }) => {
    test.setTimeout(120_000);
    await startLadder(page);
    await page.locator('#quick-play').tap();
    await expect(page.locator('#card-attack')).toBeVisible({ timeout: 90_000 });
    const t = await tokens(page);
    const view = await box(page.locator('#view'));
    const panel = await box(page.locator('#quick-panel'));
    const bug = await box(page.locator('#score .score-bug'));
    expect(view.y).toBe(0);
    expect(view.height).toBeLessThan(t.height * 0.62);
    expect(view.height).toBeGreaterThan(t.height * 0.35);
    expect(panel.y + panel.height).toBeLessThanOrEqual(t.height - t.safeBottom + 1);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(t.width);
    const cards = await Promise.all(['attack', 'defend', 'counter'].map((c) => box(page.locator(`#card-${c}`))));
    expect(new Set(cards.map((c) => Math.round(c.y))).size).toBe(1);
    for (const c of cards) expect(c.x + c.width).toBeLessThanOrEqual(t.width);
    expect(bug.y).toBeGreaterThanOrEqual(t.safeTop);
    expect(overlaps(bug, panel)).toBe(false);
    expect(overlaps(bug, tossCorner(t))).toBe(false);
    const sound = await box(page.locator('#sound-toggle'));
    expect(sound.height).toBeGreaterThanOrEqual(44);
    for (const other of [panel, bug, tossCorner(t)]) expect(overlaps(sound, other)).toBe(false);
    await noSideScroll(page);
    // A tap picks the card; no hover lift sticks on a touch screen.
    await page.locator('#card-defend').tap();
    await expect(page.locator('#reveal')).toBeVisible();
  });

  test('cards do not lift on touch screens (no hover)', async ({ page }) => {
    await startLadder(page);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').tap();
    await expect(page.locator('#card-attack')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    await page.waitForTimeout(700);
    // A touch browser keeps :hover on the last tapped element; the lift must not depend on it.
    await page.locator('#card-attack').hover();
    await page.waitForTimeout(300);
    await expect(page.locator('#card-attack')).toHaveCSS('transform', 'none');
  });

  test('result: fits the width, says tap to skip', async ({ page }) => {
    test.setTimeout(120_000);
    await startLadder(page);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').tap();
    while (!page.url().includes('#/quick/result')) {
      const card = page.locator('#card-counter');
      if (await card.isVisible()) await card.tap();
      await page.waitForTimeout(200);
    }
    await expect(page.locator('#quick-result .skip-hint')).toHaveText('탭해서 건너뛰기');
    await page.locator('#quick-result').tap({ position: { x: 10, y: 10 } });
    await expect(page.locator('#play-again')).toBeVisible();
    await noSideScroll(page);
    expect((await box(page.locator('#play-again'))).height).toBeGreaterThanOrEqual(44);
  });
});
