import { expect, test } from '@playwright/test';
import { newCareer, watchErrors } from './helpers.ts';

// Season mode when things go wrong or get unusual (2026-10-14 bug hunts): blocked or failing storage, double clicks,
// stale notes, malformed links, phones, and audio left behind by a match screen.
test.describe('career robustness', () => {
  test('closes the match screen\'s audio when it leaves, even with sound turned back off', async ({ page }) => {
    await page.addInitScript(() => {
      const Real = window.AudioContext;
      const made: AudioContext[] = [];
      (window as unknown as { __audio: AudioContext[] }).__audio = made;
      window.AudioContext = class extends Real {
        constructor(...args: ConstructorParameters<typeof AudioContext>) {
          super(...args);
          made.push(this);
        }
      };
    });
    await newCareer(page);
    await page.locator('#enter').click();
    await page.locator('#watch').click();
    await expect(page.locator('#view')).toBeVisible();
    await page.locator('#sound .sound-toggle').click();
    await page.locator('#sound .sound-toggle').click();
    await expect(page.locator('#sound .sound-toggle')).toContainText('Sound off');
    await page.goBack();
    await expect(page.locator('#view')).toHaveCount(0);
    const open = () => page.evaluate(() => (window as unknown as { __audio: AudioContext[] }).__audio.map((c) => c.state));
    expect((await open()).length).toBeGreaterThan(0);
    await expect.poll(async () => (await open()).every((st) => st === 'closed')).toBe(true);
  });

  test('opens every screen at the top, not where the last one was scrolled to', async ({ page }) => {
    await newCareer(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await page.locator('#nav-rankings').click();
    await expect(page.locator('#rankings')).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('keeps the header to two short rows on a phone, every link reachable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await newCareer(page);
    const header = (await page.locator('header.top').boundingBox())!;
    expect(header.height).toBeLessThan(100);
    await page.locator('#nav-saves').scrollIntoViewIfNeeded();
    await page.locator('#nav-saves').click();
    await expect(page).toHaveURL(/#\/saves/);
  });

  test('confirms a save on the Saves screen, and marks My player in the header', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await page.locator('#nav-saves').click();
    await page.locator('tr[data-slot="slot1"] button.save').click();
    await expect(page.locator('#saves-message')).toHaveText('Saved to Slot 1.');
    await page.waitForTimeout(500);
    await expect(page.locator('#saves-message')).toHaveText('Saved to Slot 1.');
    await page.locator('#nav-player').click();
    await expect(page.locator('#nav-player')).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('says a save was loaded on the screen it opens, mid-tournament too, and only there', async ({ page }) => {
    await newCareer(page);
    await page.locator('#enter').click();
    await expect(page.locator('#draw')).toBeVisible();
    await page.locator('#nav-saves').click();
    await page.locator('tr[data-slot="slot2"] button.save').click();
    await expect(page.locator('#saves-message')).toHaveText('Saved to Slot 2.');
    await page.locator('tr[data-slot="slot2"] button.load').click();
    await expect(page.locator('#draw')).toBeVisible();
    await expect(page.locator('#note')).toHaveText('Loaded Alex Kim, week 1.');
    await page.locator('#nav-home').click();
    await expect(page.locator('#note')).toHaveCount(0);
  });

  test('sends a malformed history link home instead of crashing', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await page.goto('/#/history/0.5');
    await expect(page).toHaveURL(/#\/home/);
    expect(errors).toEqual([]);
  });

  test('keeps playing when the autosave fails: the week closes, the page stays usable and says so', async ({ page }) => {
    await newCareer(page);
    // Storage breaks after the career started: every later write fails.
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = () => { throw new Error('quota exceeded'); };
    });
    await page.locator('#rest').click();
    await expect(page.locator('#note')).toContainText('Autosave failed');
    await expect(page.locator('#status')).toContainText('Week 2 of 24');
    expect(await page.evaluate(() => document.getElementById('app')!.inert)).toBe(false);
    await page.locator('#nav-rankings').click();
    await expect(page.locator('#rankings')).toBeVisible();
  });

  test('still opens the title screen when the browser refuses save storage', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { get: () => { throw new Error('storage blocked'); } });
    });
    await page.goto('/#/');
    await expect(page.locator('#quick-match')).toBeVisible();
    await expect(page.locator('#new-career')).toBeVisible();
  });

  test('names the training choices and reads the draw match by match, winners included', async ({ page }) => {
    await newCareer(page);
    await expect(page.getByRole('combobox', { name: 'Training focus' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Training intensity' })).toBeVisible();
    await page.locator('#enter').click();
    await page.locator('#quick').click();
    const rounds = page.getByRole('list', { name: /Round of 32/ });
    await expect(rounds.getByRole('listitem')).toHaveCount(16);
    await expect(rounds.getByRole('listitem').filter({ hasText: 'Alex Kim' })).toHaveAccessibleName(/^(Alex Kim beat|.+ beat Alex Kim) .+ \d/);
  });
});

