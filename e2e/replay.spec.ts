import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { exhibitionConfig, fingerprint, simulateMatch, type Surface } from '@tennis/engine';
import { buildProgramme, buildTimeline, type CameraId } from '@tennis/renderer';

/** Fails the test on any page error or console error. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function seek(page: Page, t: number) {
  await page.evaluate((to) => {
    const s = document.querySelector<HTMLInputElement>('.seek')!;
    s.value = String(to);
    s.dispatchEvent(new Event('input'));
  }, t);
  await expect(page.locator('body')).toHaveAttribute('data-t', (Math.round(t * 10) / 10).toFixed(2));
}

const dataset = (page: Page) => page.evaluate(() => ({ ...document.body.dataset }));

/** The replay page loads its code after the document: wait until a match is on screen. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('#fingerprint')).toHaveText(/^[0-9a-f]{8}$/);
  await expect(page.locator('body')).toHaveAttribute('data-t', /\d/);
}

test.describe('replay page', () => {
  for (const [surface, seed] of [['hard', 123], ['clay', 42], ['grass', 7]] as [Surface, number][]) {
    test(`plays ${surface} seed ${seed} with the same events as Node (TD-005)`, async ({ page }) => {
      const errors = watchErrors(page);
      await open(page, `/?seed=${seed}&surface=${surface}`);
      const expected = fingerprint(simulateMatch(exhibitionConfig(surface), seed));
      await expect(page.locator('#fingerprint')).toHaveText(expected);
      await expect(page.locator('.score-bug tr')).toHaveCount(2);
      expect(errors).toEqual([]);
    });
  }

  test('plays, speeds up and jumps between points', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=42&surface=clay');
    await page.keyboard.press('Space');
    await page.locator('[data-speed="4"]').click();
    await page.waitForTimeout(1500);
    const t1 = Number((await dataset(page)).t);
    expect(t1).toBeGreaterThan(3);
    await page.keyboard.press('Space');
    await seek(page, 100);
    const before = Number((await dataset(page)).point);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number((await dataset(page)).point)).toBe(before + 1);
    expect(errors).toEqual([]);
  });

  test('cuts between all five TV cameras where the director says (the M7 look, ?rig=mannequin)', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=42&surface=clay&rig=mannequin');
    const programme = buildProgramme(buildTimeline(simulateMatch(exhibitionConfig('clay'), 42)), 'full');
    const seen = new Set<CameraId>();
    for (const camera of ['main', 'serve', 'reaction', 'side', 'hawkeye'] as CameraId[]) {
      const clip = programme.clips.find((c) => c.camera === camera && c.duration > 1)!;
      await seek(page, clip.start + clip.duration / 2);
      expect((await dataset(page)).camera).toBe(camera);
      seen.add(camera);
    }
    expect(seen.size).toBe(5);
    expect(errors).toEqual([]);
  });

  test('holds the fixed TV view by default: the main camera all through (2026-10-17)', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=42&surface=clay');
    const programme = buildProgramme(buildTimeline(simulateMatch(exhibitionConfig('clay'), 42)), 'full', undefined, { style: 'tv' });
    const live = programme.clips.filter((c) => c.kind === 'live' && c.duration > 0.5);
    for (const clip of live.slice(0, 4)) {
      await seek(page, clip.start + clip.duration / 2);
      expect((await dataset(page)).camera).toBe('main');
    }
    expect(errors).toEqual([]);
  });

  test('cuts between the game cameras where the game director says (?cams=game, ADR-024)', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=42&surface=clay&cams=game');
    const programme = buildProgramme(buildTimeline(simulateMatch(exhibitionConfig('clay'), 42)), 'full', undefined, { style: 'game' });
    const cameras = [...new Set(programme.clips.filter((c) => c.duration > 0.5).map((c) => c.camera))];
    expect(cameras).toContain('chase');
    expect(cameras).not.toContain('main');
    for (const camera of cameras) {
      const clip = programme.clips.find((c) => c.camera === camera && c.duration > 0.5)!;
      await seek(page, clip.start + clip.duration / 2);
      expect((await dataset(page)).camera).toBe(camera);
    }
    expect(errors).toEqual([]);
  });

  test('switches viewing modes, ending on the result and the match stats', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=42&surface=clay');
    await page.locator('[data-mode="highlights"]').click();
    await expect(page.locator('[data-mode="highlights"]')).toHaveClass(/active/);
    await page.locator('[data-mode="result"]').click();
    await expect(page.locator('.ov-stats')).toBeVisible();
    await expect(page.locator('.ov-stats')).toContainText('MATCH STATS');
    await expect(page.locator('.ov-lower')).toContainText('GAME, SET AND MATCH');
    expect((await dataset(page)).clip).toBe('result');
    expect(errors).toEqual([]);
  });

  test('loads replay JSON without the engine, and refuses an old schema', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=1&surface=hard');
    const result = simulateMatch(exhibitionConfig('grass'), 99);
    const good = join(tmpdir(), `replay-${process.pid}.json`);
    const old = join(tmpdir(), `replay-v1-${process.pid}.json`);
    writeFileSync(good, JSON.stringify(result));
    writeFileSync(old, JSON.stringify({ ...result, schemaVersion: 1 }));
    await page.locator('input[type=file]').setInputFiles(old);
    await expect(page.locator('#panel .error')).toContainText('schema version 1');
    await page.locator('input[type=file]').setInputFiles(good);
    await expect(page.locator('#fingerprint')).toHaveText(fingerprint(result));
    await expect(page.locator('#panel .meta')).toContainText('grass');
    expect(errors).toEqual([]);
  });

  test('turns sound on and plays with it without errors', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '/?seed=42&surface=clay');
    await page.locator('.sound-toggle').click();
    await expect(page.locator('.sound-toggle')).toContainText('Sound on');
    await expect(page.locator('#sound .sliders input')).toHaveCount(4);
    await page.keyboard.press('Space');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
});
