// Shared by the Playwright specs: error watching, computed styles, and the quick ladder played the same way in Node
// and on the page (start form defaults, the CYCLE cards at every decision point).
import { expect, type Page } from '@playwright/test';
import type { Card } from '@tennis/engine';
import {
  autoPlay, createPlayer, decide, defaultAllocation, finishQuick, matchOver, newLadder, startQuick, type GamePlan, type QuickMatch, type QuickState,
} from '@tennis/game';

/** The cards every quick spec picks, in turn, at decision points. */
export const CYCLE: Card[] = ['attack', 'defend', 'counter'];

/** Collects page errors and console errors; a spec ends with `expect(errors).toEqual([])`. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** One computed style property of the first element matching `sel`. */
export const css = (page: Page, sel: string, prop: string): Promise<string> =>
  page.locator(sel).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** A new ladder as the start form makes it: name Alex Kim, the first style option (big server). */
export const nodeLadder = (seed: number): QuickState =>
  newLadder(seed, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, seed));

/** Plays the ladder's next match in Node with the CYCLE cards; `onDecision` sees the match before each card. */
export function nodePlayNext(s: QuickState, plan: GamePlan = 'balanced', onDecision?: (qm: QuickMatch) => void): QuickState {
  const qm = startQuick(s, plan);
  let i = 0;
  for (autoPlay(qm); !matchOver(qm); autoPlay(qm)) {
    onDecision?.(qm);
    decide(qm, CYCLE[i++ % 3]!);
  }
  return finishQuick(s, qm);
}

/** Types `seed` into the start form's seed field, opening its Advanced section first. */
export async function fillSeed(page: Page, seed: number): Promise<void> {
  if (!(await page.locator('#quick-seed').isVisible())) await page.locator('#quick-advanced summary').click();
  await page.locator('#quick-seed').fill(String(seed));
}

/** Starts a ladder with `seed` from the title screen and waits for the Play button. */
export async function startLadder(page: Page, seed: number): Promise<void> {
  await page.goto('/#/');
  await page.locator('#quick-match').click();
  await fillSeed(page, seed);
  await page.locator('#quick-start').click();
  await expect(page.locator('#quick-play')).toBeVisible();
}

/** Plays the first match of a new ladder, pressing 1/2/3 in CYCLE order at every decision, until the result screen. */
export async function playToResult(page: Page, seed: number, fast: boolean): Promise<void> {
  await startLadder(page, seed);
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
