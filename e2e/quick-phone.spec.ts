import { expect, test, type Locator, type Page } from '@playwright/test';
import { startLadder, watchErrors } from './helpers.ts';

// Quick screens on a small phone (375×667, the smallest common portrait screen): nothing overlaps or falls off screen.
test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

const box = async (l: Locator) => (await l.boundingBox())!;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function toFirstDecision(page: Page) {
  await startLadder(page, 3);
  await page.locator('#quick-play').tap();
  await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 60_000 }).toBe('choose');
  await page.waitForTimeout(700);
}

test.describe('quick screens on a phone', () => {
  test.setTimeout(120_000);

  test('keeps the sound toggle clear of the header links', async ({ page }) => {
    await startLadder(page, 3);
    expect(overlaps(await box(page.locator('#sound-toggle')), await box(page.locator('#nav-quick')))).toBe(false);
    // Narrow screens show the icon only; the name stays for screen readers, the state is aria-pressed.
    await expect(page.locator('#sound-toggle')).toHaveAccessibleName('Sound');
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
    const header = await box(page.locator('header.top'));
    const pill = await box(page.locator('#sound-toggle'));
    expect(pill.y + pill.height).toBeLessThanOrEqual(header.y + header.height);
  });

  test('keeps the three game plans on one row', async ({ page }) => {
    await startLadder(page, 3);
    const plans = await Promise.all(['aggressive', 'balanced', 'defensive'].map((p) => box(page.locator(`#plan-${p}`))));
    expect(Math.abs(plans[0]!.y - plans[2]!.y)).toBeLessThan(4);
  });

  test('fits the whole decision panel on screen, the three cards side by side, with no empty sound box', async ({ page }) => {
    const errors = watchErrors(page);
    await toFirstDecision(page);
    const panel = await box(page.locator('#quick-panel'));
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.y + panel.height).toBeLessThanOrEqual(667);
    const cards = await Promise.all(['attack', 'defend', 'counter'].map((c) => box(page.locator(`#card-${c}`))));
    expect(Math.abs(cards[0]!.y - cards[2]!.y)).toBeLessThan(20);
    // The broadcast's own sound panel stays off quick matches, which share the page's sound (ADR-023).
    await expect(page.locator('#sound')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('does not leave a tapped-over card lifted: touch screens have no hover', async ({ page }) => {
    await toFirstDecision(page);
    await page.locator('#card-defend').hover();
    await page.waitForTimeout(300);
    expect(await page.locator('#card-defend').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test('stacks the revealed cards with the "v" between them', async ({ page }) => {
    await toFirstDecision(page);
    await page.locator('#card-attack').tap();
    await expect(page.locator('#reveal .verdict.is-popped')).toBeVisible();
    const yours = await box(page.locator('#reveal .flip.yours'));
    const vs = await box(page.locator('#reveal .vs'));
    const theirs = await box(page.locator('#reveal .flip.theirs'));
    expect(vs.y).toBeGreaterThanOrEqual(yours.y + yours.height - 2);
    expect(theirs.y).toBeGreaterThanOrEqual(vs.y + vs.height - 2);
  });
});
