import { expect, test, type Page } from '@playwright/test';
import type { Card } from '@tennis/engine';
import { autoPlay, createPlayer, decide, defaultAllocation, finishQuick, matchOver, newLadder, quickResultView, startQuick } from '@tennis/game';

// The result screen (ADR-017, result workstream): the reveal in order, skipping it, and the texts Node computes.
const CYCLE: Card[] = ['attack', 'defend', 'counter'];

/** The first ladder match in Node, the same cards as the browser picks; the default style is big server. */
function nodeResult(seed: number) {
  const s = newLadder(seed, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, seed));
  const qm = startQuick(s);
  let i = 0;
  for (autoPlay(qm); !matchOver(qm); autoPlay(qm)) decide(qm, CYCLE[i++ % 3]!);
  return quickResultView(finishQuick(s, qm));
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Records every result phase the page goes through in window.__phases. */
async function recordPhases(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __phases: string[] };
    w.__phases = [];
    new MutationObserver(() => {
      const p = document.body?.dataset.resultPhase;
      if (p && w.__phases.at(-1) !== p) w.__phases.push(p);
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-result-phase'] });
  });
}

/** Records every text the points count shows, with the page clock (window.__count). */
async function recordCount(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __count: [number, string][] };
    w.__count = [];
    new MutationObserver(() => {
      const t = document.querySelector('#points-delta strong')?.textContent;
      if (t && w.__count.at(-1)?.[1] !== t) w.__count.push([performance.now(), t]);
    }).observe(document, { childList: true, characterData: true, subtree: true });
  });
}
const css = (page: Page, sel: string, prop: string) => page.locator(sel).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function playToResult(page: Page, seed: number, fast: boolean) {
  await page.goto('/#/');
  await page.locator('#quick-match').click();
  await page.locator('#quick-seed').fill(String(seed));
  await page.locator('#quick-start').click();
  if (fast) await page.locator('#fast-mode').check();
  await page.locator('#quick-play').click();
  let i = 0;
  while (!page.url().includes('#/quick/result')) {
    const ready = await page.evaluate(() => document.body.dataset.quickPhase === 'choose' && !!document.querySelector('#card-attack'));
    if (ready) {
      await page.keyboard.press(`Digit${i % 3 + 1}`);
      i++;
      await expect.poll(() => page.evaluate(() => document.body.dataset.quickDecisions)).toBe(String(i));
    } else await page.waitForTimeout(30);
  }
}

test.describe('quick result', () => {
  test.setTimeout(180_000);

  test('reveals the decisive point, the result, points, passes, ratings and the goal in order, as Node computes them', async ({ page }) => {
    const errors = watchErrors(page);
    await recordPhases(page);
    await recordCount(page);
    await playToResult(page, 3, true);
    const v = nodeResult(3);
    // The tiles rise 120 ms apart (ADR-021).
    expect(await page.locator('#gains .gain').evaluateAll((els) => els.map((el) => getComputedStyle(el).transitionDelay.split(',')[0]))).toEqual(['0s', '0.12s', '0.24s']);
    await expect(page.locator('#decisive-line')).toHaveText(v.decisive!.line);
    await expect(page.locator('#play-by-play li')).toHaveText(v.playByPlay);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase), { timeout: 15_000 }).toBe('done');
    const phases = await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases);
    expect(phases).toEqual(['replay', 'result', 'points', ...(v.overtakes.length ? ['overtakes'] : []), 'ratings', 'goal', 'done']);
    await expect(page.locator('#quick-result h1')).toHaveText(v.headline);
    await expect(page.locator('#points-delta strong')).toHaveText(`${v.delta >= 0 ? '+' : ''}${v.delta}`);
    await expect(page.locator('#rank-change strong')).toHaveText(`#${v.rankBefore} → #${v.rankAfter}`);
    await expect(page.locator('#overtakes .overtake')).toHaveText(v.overtakes.map((o) => `#${o.rank} ${o.name}`));
    await expect(page.locator('#rating-gains .rating-gain')).toHaveCount(v.ratings.length);
    await expect(page.locator('#rating-gains .rating-gain.rose')).toHaveCount(v.ratings.filter((r) => r.rose).length);
    for (const r of v.ratings.filter((x) => x.rose)) await expect(page.locator('#rating-gains')).toContainText(`${r.label}${r.before} → ${r.after}`);
    await expect(page.locator('#next-goal strong')).toHaveText(v.goalLine);
    await expect(page.locator('#play-again')).toBeFocused();
    for (const el of await page.locator('#quick-result .step').all()) await expect(el).toHaveCSS('opacity', '1');
    // The points count up with an ease-out over about a second; every rating that rose ticks; the goal locks in.
    const shown = await page.evaluate(() => (window as unknown as { __count: [number, string][] }).__count);
    const count = shown.slice(shown.findIndex((x) => x[1] === '+0'));
    expect(count[0]![1]).toBe('+0');
    expect(count.at(-1)![1]).toBe(`${v.delta >= 0 ? '+' : ''}${v.delta}`);
    if (Math.abs(v.delta) >= 10) {
      expect(count.length).toBeGreaterThan(5);
      const spent = count.at(-1)![0] - count[0]![0];
      expect(spent).toBeGreaterThan(700);
      expect(spent).toBeLessThan(1600);
    }
    await expect(page.locator('#rating-gains .rating-gain.rose.is-ticked')).toHaveCount(v.ratings.filter((r) => r.rose).length);
    await expect(page.locator('#next-goal')).toHaveClass(/is-locked/);
    expect(errors).toEqual([]);
  });

  test('skips with Enter as well, cutting every animation to its end', async ({ page }) => {
    const errors = watchErrors(page);
    await playToResult(page, 3, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('replay');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    await expect(page.locator('#quick-result')).toHaveClass(/is-skipped/);
    await expect(page.locator('#play-again')).toBeFocused();
    await expect(page.locator('#next-goal')).toHaveClass(/is-locked/);
    expect(await css(page, '#gains .gain:last-child', 'transition-duration')).toMatch(/^0s/);
    expect(errors).toEqual([]);
  });

  test('with reduced motion, shows the final result at once and plays the match reveal as cuts', async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await recordPhases(page);
    await recordCount(page);
    await page.goto('/#/');
    await page.locator('#quick-match').click();
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 30_000 }).toBe('choose');
    expect(await css(page, '#card-attack', 'animation-duration')).toBe('0s');
    await page.keyboard.press('Digit1');
    await expect(page.locator('#reveal')).toBeVisible();
    expect(await css(page, '#reveal .flip.yours', 'transition-duration')).toBe('0s');
    let i = 1;
    while (!page.url().includes('#/quick/result')) {
      if (await page.evaluate(() => document.body.dataset.quickPhase === 'choose')) await page.keyboard.press(`Digit${i++ % 3 + 1}`);
      await page.waitForTimeout(30);
    }
    const v = nodeResult(3);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase), { timeout: 1000 }).toBe('done');
    expect(await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases)).toEqual(['done']);
    await expect(page.locator('#points-delta strong')).toHaveText(`${v.delta >= 0 ? '+' : ''}${v.delta}`);
    expect(await page.evaluate(() => (window as unknown as { __count: [number, string][] }).__count.map((x) => x[1]))).toEqual([`${v.delta >= 0 ? '+' : ''}${v.delta}`]);
    await expect(page.locator('#quick-result h1')).toHaveText(v.headline);
    await expect(page.locator('#play-again')).toBeFocused();
    await expect(page.locator('#decisive-replay')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('skips the reveal with space, showing everything and focusing Play again', async ({ page }) => {
    const errors = watchErrors(page);
    await playToResult(page, 3, true);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('replay');
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    await expect(page.locator('#play-again')).toBeFocused();
    await expect(page.locator('#next-goal')).toHaveClass(/shown/);
    await expect(page.locator('#points-delta strong')).toHaveText(/^[+-]\d+$/);
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase)).toMatch(/auto|choose/);
    expect(errors).toEqual([]);
  });

  test('replays the decisive point in 3D with the line as a caption, then the reveal; a click skips it', async ({ page }) => {
    const errors = watchErrors(page);
    await playToResult(page, 3, false);
    await expect(page.locator('#decisive-replay #view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#decisive-replay .replay-caption strong')).toHaveText(nodeResult(3).decisive!.line);
    await expect.poll(() => page.locator('#view').evaluate((c) => (c as HTMLCanvasElement).width >= c.clientWidth && c.clientWidth > 300)).toBe(true);
    await page.mouse.click(640, 200);
    await expect(page.locator('#decisive-replay')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('done');
    await expect(page.locator('#play-again')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('plays the 3D replay to its end, then removes it and reveals the rest', async ({ page }) => {
    const errors = watchErrors(page);
    await recordPhases(page);
    await playToResult(page, 3, false);
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase), { timeout: 90_000 }).toBe('done');
    await expect(page.locator('#decisive-replay')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases.slice(0, 3))).toEqual(['replay', 'replay-3d', 'result']);
    await expect(page.locator('#play-again')).toBeFocused();
    expect(errors).toEqual([]);
  });

  // Screenshots for review: RESULT_SHOTS=<dir> E2E_PORT=5183 npm run test:e2e -- e2e/quick-result.spec.ts
  test('takes screenshots of a won and a lost result, and of the 3D replay', async ({ browser }) => {
    const dir = process.env.RESULT_SHOTS;
    test.skip(!dir, 'set RESULT_SHOTS to a directory');
    const fresh = async () => (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    for (const [seed, name] of [[1, 'won'], [2, 'lost']] as const) {
      const page = await fresh();
      await playToResult(page, seed, true);
      await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase), { timeout: 15_000 }).toBe('done');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${dir}/result-${name}.png` });
    }
    const page = await fresh();
    await playToResult(page, 1, false);
    await expect(page.locator('#decisive-replay #view')).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => document.body.dataset.resultPhase)).toBe('replay-3d');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${dir}/result-replay-3d.png` });
  });
});
