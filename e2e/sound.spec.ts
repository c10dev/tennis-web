import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Sound in the quick match (ADR-022, M7 step 6; ADR-029): one on/off setting, remembered; sound starts on the first
// tap, stops when the page goes to the background and comes back on return. The generated samples (ADR-027) load on
// that tap, never with the first screen, and the game plays on (synthesised) when they are missing.

/** The samples on disk: until the generated files land, only the notice, and the loader is expected to fail quietly. */
const samplesOnDisk = readdirSync(new URL('../ui/public/audio/', import.meta.url)).filter((f) => f.endsWith('.ogg'));

async function startLadder(page: Page) {
  await page.goto('/#/quick');
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await expect(page.locator('#quick-play')).toBeVisible();
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.describe('quick-match sound', () => {
  test('has one sound switch, on by default, remembered after a reload', async ({ page }) => {
    await startLadder(page);
    const toggle = page.locator('#sound-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('Sound on');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sound-toggle')).toContainText('Sound off');
  });

  test('starts on Play, pauses in the background and resumes on return; no mixer panel in the match', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startLadder(page);
    await page.locator('#quick-play').click();
    await expect(page.locator('#quick-panel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('running');
    await expect(page.locator('#sound .sliders')).toHaveCount(0);
    await expect(page.locator('#sound-toggle')).toBeVisible();
    await setHidden(page, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('suspended');
    await setHidden(page, false);
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('running');
    // Off in the match: silent, and stays silent after a return from the background.
    await page.locator('#sound-toggle').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('off');
    await setHidden(page, true);
    await setHidden(page, false);
    await expect.poll(() => page.evaluate(() => document.body.dataset.audio)).toBe('off');
    expect(errors).toEqual([]);
  });

  test('loads the samples on the first tap, not with the first screen, one Opus file each', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const requests: string[] = [];
    page.on('request', (r) => {
      const path = new URL(r.url()).pathname;
      if (/\/audio\/[^/]+\.(ogg|m4a)$/.test(path)) requests.push(path);
    });
    // The audio (and with it the samples) opens on the first tap or key press anywhere (ADR-029), never with the page.
    await page.goto('/#/quick');
    await expect(page.locator('#quick-start')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.body.dataset.audioSamples ?? 'none')).toBe('none');
    expect(requests).toEqual([]);
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.audioSamples), { timeout: 15_000 })
      .toMatch(samplesOnDisk.length === 12 ? /^ready$/ : /^(partial|failed)$/);
    expect(requests).toHaveLength(12);
    for (const r of requests) expect(r).toMatch(/\/audio\/[a-z-]+\.ogg$/);
    expect(errors).toEqual([]);
  });
});
