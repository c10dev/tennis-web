import { expect, test, type Page } from '@playwright/test';
import type { Card } from '@tennis/engine';
import { createPlayer, defaultAllocation, finishQuick, matchOver, newLadder, playPoint, startQuick } from '@tennis/game';

const SEED = 3;
const CYCLE: Card[] = ['attack', 'defend', 'counter'];

/** The same first match in Node: the default style on the start form is the first option, big server. */
function nodeFirstMatch() {
  const s = newLadder(SEED, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, SEED));
  const qm = startQuick(s);
  let i = 0;
  while (!matchOver(qm)) playPoint(qm, CYCLE[i++ % 3]!);
  return finishQuick(s, qm).history[0]!;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function startLadder(page: Page) {
  await page.goto('/#/');
  await page.locator('#quick-match').click();
  await page.locator('#quick-seed').fill(String(SEED));
  await page.locator('#quick-start').click();
  await expect(page.locator('#quick-play')).toBeVisible();
}

/** Picks cards in the CYCLE order until the match ends; `keys` uses 1/2/3 instead of clicks. */
async function playThrough(page: Page, keys = false, limit = Infinity) {
  let i = 0;
  while (!page.url().includes('#/quick/result') && i < limit) {
    const ready = await page.evaluate(() => document.body.dataset.quickPhase === 'choose' && !!document.querySelector('#card-attack'));
    if (ready) {
      const card = CYCLE[i % 3]!;
      if (keys) await page.keyboard.press(`Digit${i % 3 + 1}`);
      else await page.locator(`#card-${card}`).click();
      i++;
      await expect.poll(() => page.evaluate(() => document.body.dataset.quickPoints)).toBe(String(i));
    } else await page.waitForTimeout(30);
  }
  return i;
}

test.describe('quick match', () => {
  test.setTimeout(180_000);

  test('plays a fast-mode match with cards and lands on the result the engine computes in Node', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(page.locator('#situation')).toContainText('· 0-0 · Games 0-0');
    const points = await playThrough(page);
    const expected = nodeFirstMatch();
    expect(points).toBe(expected.recipe.cards!.length);
    await expect(page.locator('#quick-result h1')).toHaveText(`${expected.won ? 'You won' : 'You lost'} ${expected.score}`);
    await expect(page.locator('#points-delta')).toContainText(`${expected.pointsDelta >= 0 ? '+' : ''}${expected.pointsDelta}`);
    await expect(page.locator('#rank-change')).toContainText(`#${expected.rankBefore} → #${expected.rankAfter}`);
    await expect(page.locator('#rating-gains .rating-gain')).toHaveCount(8);
    expect(errors).toEqual([]);
  });

  test('plays again against the next opponent, and keeps the ladder after a reload', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await playThrough(page, true);
    const rank = (await page.locator('#rank-change strong').textContent())!.split('→ ')[1]!.trim();
    await page.locator('#play-again').click();
    await expect(page.locator('#situation')).toContainText('Games 0-0');
    await page.reload();
    await page.goto('/#/quick');
    await expect(page.locator('#quick-rank')).toHaveText(rank);
    await expect(page.locator('#recent li')).toHaveCount(1);
    await page.goto('/#/');
    await expect(page.locator('#quick-match')).toContainText(`${rank} · 1 played`);
    expect(errors).toEqual([]);
  });

  test('shows each point in 3D: reveal, then a clip on a sized canvas', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page);
    await page.locator('#quick-play').click();
    await playThrough(page, false, 3);
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase)).toMatch(/clip|outcome|choose/);
    await expect.poll(() => page.locator('#view').evaluate((c) => (c as HTMLCanvasElement).width >= c.clientWidth && c.clientWidth > 300)).toBe(true);
    await expect(page.locator('#score .score-bug')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('keeps the season mode one click away', async ({ page }) => {
    await page.goto('/#/');
    await page.locator('#new-career').click();
    await expect(page.locator('#start')).toBeVisible();
  });
});
