import { expect, test, type Page } from '@playwright/test';
import { readingHint, STYLE_BLURB, type GamePlan } from '@tennis/game';
import { css, CYCLE, nodeLadder, nodePlayNext, startLadder, watchErrors } from './helpers.ts';

const SEED = 3;

/** The same first match in Node. */
const nodeFirstMatch = (plan: GamePlan = 'balanced') => nodePlayNext(nodeLadder(SEED), plan).history[0]!;

/** Picks cards in the CYCLE order at every decision point until the match ends; `keys` uses 1/2/3 instead of clicks. */
async function playThrough(page: Page, keys = false, limit = Infinity) {
  let i = 0;
  while (!page.url().includes('#/quick/result') && i < limit) {
    const ready = await page.evaluate(() => document.body.dataset.quickPhase === 'choose' && !!document.querySelector('#card-attack'));
    if (ready) {
      // Every stop is named on the banner, over a pip for each point played so far.
      await expect(page.locator('#moment')).toHaveText(/^(MATCH POINT|MATCH POINT DOWN|\d+-ALL|BIG POINT)$/);
      expect(await page.locator('#point-pips .pip').count()).toBe(Number(await page.evaluate(() => document.body.dataset.quickPoints)));
      const card = CYCLE[i % 3]!;
      if (keys) await page.keyboard.press(`Digit${i % 3 + 1}`);
      else await page.locator(`#card-${card}`).click();
      i++;
      await expect.poll(() => page.evaluate(() => document.body.dataset.quickDecisions)).toBe(String(i));
    } else await page.waitForTimeout(30);
  }
  return i;
}

/** Records when the picked card lifts, the reveal appears face-down, flips, and the verdict pops (ms, page clock), and
 *  at the pop: the cards that flipped, the matchup and which side kicked. */
async function watchReveal(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __reveal: Record<string, number>; __pop: { flips: number; matchup: string; winners: string[] } };
    w.__reveal = {};
    const mark = (k: string) => {
      w.__reveal[k] ??= performance.now();
    };
    new MutationObserver(() => {
      if (document.querySelector('.card-btn.is-selected')) mark('selected');
      if (document.querySelector('#reveal.is-facedown')) mark('facedown');
      if (document.querySelector('#reveal.is-flipped')) mark('flipped');
      if (document.querySelector('#reveal .verdict.is-popped') && !w.__reveal.popped) {
        mark('popped');
        w.__pop = {
          flips: document.querySelectorAll('#reveal .flip').length,
          matchup: document.querySelector('#reveal')!.className.match(/won|lost|even/)![0],
          winners: [...document.querySelectorAll('#reveal .flip.is-winner')].map((x) => (x.classList.contains('yours') ? 'yours' : 'theirs')),
        };
      }
    }).observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  });
}
const ms = (s: string) => s.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000));

test.describe('quick match', () => {
  test.setTimeout(180_000);

  test('plays a fast-mode match, stopping for cards only at decision points, and lands on the result the engine computes in Node', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase)).toBe('auto');
    await expect(page.locator('#ticker #score-line')).toHaveText(/^\d+-\d+$/);
    await expect(page.locator('#ticker')).toContainText('Plan · Balanced');
    await expect(page.locator('#situation')).toHaveText(/(Your|Their) serve · \d+-\d+/, { timeout: 15_000 });
    await expect(page.locator('#opponent-read #scouting')).toBeVisible();
    const decisions = await playThrough(page);
    const expected = nodeFirstMatch();
    expect(decisions).toBe(expected.decisions!.length);
    expect(decisions).toBeLessThan(expected.recipe.cards!.length);
    await expect(page.locator('#quick-result h1')).toHaveText(`${expected.won ? 'You won' : 'You lost'} ${expected.score}`);
    await expect(page.locator('#points-delta')).toContainText(`${expected.pointsDelta >= 0 ? '+' : ''}${expected.pointsDelta}`);
    await expect(page.locator('#rank-change')).toContainText(`#${expected.rankBefore} → #${expected.rankAfter}`);
    await expect(page.locator('#rating-gains .rating-gain')).toHaveCount(expected.progress.length);
    expect(errors).toEqual([]);
  });

  test('deals the cards in with a stagger, lifts them on hover, then flips both cards at once before the verdict (ADR-021)', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    expect(await css(page, '.moment-banner', 'animation-name')).toBe('banner-wipe');
    const delays = await Promise.all(['attack', 'defend', 'counter'].map(async (c) => ms(await css(page, `#card-${c}`, 'animation-delay'))[0]!));
    expect(await css(page, '#card-attack', 'animation-name')).toBe('card-deal');
    for (const gap of [delays[1]! - delays[0]!, delays[2]! - delays[1]!]) expect(gap >= 50 && gap <= 70, `stagger ${gap} ms`).toBe(true);
    await page.locator('#card-defend').hover();
    await expect.poll(() => css(page, '#card-defend', 'transform')).toBe('matrix(1.05, 0, 0, 1.05, 0, -12)');
    await watchReveal(page);
    await page.keyboard.press('Digit1');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __reveal: Record<string, number> }).__reveal.popped ?? 0)).toBeGreaterThan(0);
    const t = await page.evaluate(() => (window as unknown as { __reveal: Record<string, number> }).__reveal);
    expect(t.selected).toBeLessThan(t.facedown!);
    expect(t.flipped! - t.facedown!).toBeGreaterThanOrEqual(400);
    expect(t.flipped! - t.facedown!).toBeLessThan(1200);
    expect(t.popped! - t.flipped!).toBeGreaterThanOrEqual(380);
    const pop = await page.evaluate(() => (window as unknown as { __pop: { flips: number; matchup: string; winners: string[] } }).__pop);
    expect(pop.flips).toBe(2);
    expect(pop.winners).toEqual(pop.matchup === 'won' ? ['yours'] : pop.matchup === 'lost' ? ['theirs'] : []);
    expect(errors).toEqual([]);
  });

  test('plays the game plan picked next to Play, and remembers it', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await expect(page.locator('#plan-balanced')).toHaveClass(/selected/);
    // The choice is announced, not shown by fill alone (TD-044): a named group of toggle buttons.
    await expect(page.getByRole('group', { name: 'Game plan' })).toBeVisible();
    await expect(page.locator('#plan-balanced')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#plan-aggressive')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#plan-aggressive').click();
    await expect(page.locator('#plan-aggressive')).toHaveClass(/selected/);
    await expect(page.locator('#plan-aggressive')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#plan-balanced')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#plan-line')).toContainText('winners');
    await page.reload();
    await expect(page.locator('#plan-aggressive')).toHaveClass(/selected/);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await playThrough(page);
    const expected = nodeFirstMatch('aggressive');
    await expect(page.locator('#quick-result h1')).toHaveText(`${expected.won ? 'You won' : 'You lost'} ${expected.score}`);
    expect(errors).toEqual([]);
  });

  test('plays again against the next opponent, and keeps the ladder after a reload', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await playThrough(page, true);
    const rank = (await page.locator('#rank-change strong').textContent())!.split('→ ')[1]!.trim();
    await page.locator('#play-again').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase)).toMatch(/auto|choose/);
    await page.reload();
    await page.goto('/#/quick');
    await expect(page.locator('#quick-rank')).toHaveText(rank);
    await expect(page.locator('#recent li')).toHaveCount(1);
    await page.goto('/#/');
    await expect(page.locator('#quick-match')).toContainText(`${rank} · 1 played`);
    expect(errors).toEqual([]);
  });

  test('shows a decision point in 3D: reveal, then a clip on a sized canvas', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await page.locator('#quick-play').click();
    await playThrough(page, false, 1);
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase)).toMatch(/clip|outcome|choose/);
    await expect.poll(() => page.locator('#view').evaluate((c) => (c as HTMLCanvasElement).width >= c.clientWidth && c.clientWidth > 300)).toBe(true);
    await expect(page.locator('#score .score-bug')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('plays the next match from Play again on the plan picked on the ladder', async ({ page }) => {
    await startLadder(page, SEED);
    await page.locator('#plan-defensive').click();
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(page.locator('#ticker')).toContainText('Plan · Defensive', { timeout: 30_000 });
    await playThrough(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#play-again')).toBeFocused();
    await page.locator('#play-again').click();
    await expect(page.locator('#ticker')).toContainText('Plan · Defensive', { timeout: 30_000 });
  });

  test('explains the chosen style on the start form and keeps the seed under Advanced', async ({ page }) => {
    await page.goto('/#/');
    await page.locator('#quick-match').click();
    await expect(page.locator('#style-blurb')).toHaveText(STYLE_BLURB.big_server);
    await page.locator('#quick-style').selectOption('counter_puncher');
    await expect(page.locator('#style-blurb')).toHaveText(STYLE_BLURB.counter_puncher);
    await expect(page.locator('#quick-seed')).toBeHidden();
    await page.locator('#quick-advanced summary').click();
    await expect(page.locator('#quick-seed')).toBeVisible();
  });

  test('fetches the 3D code while the ladder waits for Play', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => scripts.push(r.url()));
    await startLadder(page, SEED);
    await expect.poll(() => scripts.some((u) => /replay\/broadcast/.test(u)), { timeout: 5000 }).toBe(true);
  });

  test('leaves the 3D code alone on the ladder in fast mode', async ({ browser }) => {
    // A fresh context: no cached modules, fast mode already on.
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL! });
    await context.addInitScript(() => localStorage.setItem('tennis-fast-mode', '1'));
    const page = await context.newPage();
    const scripts: string[] = [];
    page.on('request', (r) => scripts.push(r.url()));
    await startLadder(page, SEED);
    await expect(page.locator('#fast-mode')).toBeChecked();
    await page.waitForTimeout(1500);
    expect(scripts.some((u) => /replay\/broadcast/.test(u))).toBe(false);
    await context.close();
  });

  test('shows the reading tip at the first decision until dismissed, then never again (TD-027)', async ({ page }) => {
    const errors = watchErrors(page);
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await expect(page.locator('#hint')).toContainText(readingHint());
    await page.locator('#hint-dismiss').click();
    await expect(page.locator('#hint')).toHaveCount(0);
    await expect(page.locator('#quick-panel')).toBeFocused();
    await page.keyboard.press('Digit1');
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickDecisions)).toBe('1');
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    await expect(page.locator('#hint')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('tennis-hints'))).toBe('seen');
    expect(errors).toEqual([]);
  });

  test('retires the reading tip when a card is picked without dismissing it', async ({ page }) => {
    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(page.locator('#hint')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Digit2');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tennis-hints'))).toBe('seen');
  });

  test('keeps the season mode one click away', async ({ page }) => {
    await page.goto('/#/');
    await page.locator('#new-career').click();
    await expect(page.locator('#start')).toBeVisible();
  });
});
