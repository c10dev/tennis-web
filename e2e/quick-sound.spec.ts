import { expect, test, type Page } from '@playwright/test';
import { quickResultView } from '@tennis/game';
import { nodeLadder, nodePlayNext, playToResult, startLadder, watchErrors } from './helpers.ts';

// UI sounds (ADR-023): which cues play, in what order, and none while muted. Dev builds log each cue in window.__sfx.
const sfx = (page: Page) => page.evaluate(() => ((window as unknown as { __sfx?: { kind: string }[] }).__sfx ?? []).map((c) => c.kind));
const nodeResult = (seed: number) => quickResultView(nodePlayNext(nodeLadder(seed)));

test.describe('quick sounds', () => {
  test.setTimeout(180_000);

  test('sounds the decision point: three deals, the pick, the face-down hold, the flip and the clash (ADR-023)', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, 3);
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await expect.poll(() => sfx(page)).toEqual(['deal', 'deal', 'deal']);
    await page.keyboard.press('Digit1');
    // The next decision can follow 0.6 s after the outcome in fast mode: compare the first decision's cues only.
    await expect.poll(async () => (await sfx(page)).slice(0, 7)).toEqual(['deal', 'deal', 'deal', 'pick', 'hold', 'flip', 'clash']);
    expect(errors).toEqual([]);
  });

  test('mutes from the sound toggle, remembers it after a reload, and then plays nothing', async ({ page }) => {
    await startLadder(page, 3);
    await page.locator('#sound-toggle').click();
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sound-toggle')).toContainText('Sound off');
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await page.keyboard.press('Digit2');
    await expect(page.locator('#outcome')).toBeVisible();
    expect(await sfx(page)).toEqual([]);
  });

  test('ticks the points up on climbing notes, chimes each rating that rose and stamps the goal (ADR-023)', async ({ page }) => {
    const errors = watchErrors(page);
    await playToResult(page, 3, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase), { timeout: 15_000 }).toBe('done');
    const v = nodeResult(3);
    const cues = await page.evaluate(() => (window as unknown as { __sfx: { kind: string; i?: number; n?: number; down?: boolean }[] }).__sfx);
    const after = cues.slice(cues.findLastIndex((c) => c.kind === 'clash') + 1);
    const ticks = after.filter((c) => c.kind === 'tick');
    expect(ticks.length).toBeGreaterThan(2);
    for (const t of ticks) expect(t).toMatchObject({ n: Math.abs(v.delta), down: v.delta < 0 });
    for (let k = 1; k < ticks.length; k++) expect(ticks[k]!.i!).toBeGreaterThan(ticks[k - 1]!.i!);
    expect(after.filter((c) => c.kind === 'rise')).toHaveLength(v.ratings.filter((r) => r.rose).length);
    expect(after.at(-1)!.kind).toBe('stamp');
    expect(errors).toEqual([]);
  });

  test('skipping the reveal plays the stamp alone', async ({ page }) => {
    await playToResult(page, 3, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('replay');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    const cues = await page.evaluate(() => (window as unknown as { __sfx: { kind: string }[] }).__sfx.map((c) => c.kind));
    expect(cues.slice(cues.lastIndexOf('clash') + 1)).toEqual(['stamp']);
  });
});
