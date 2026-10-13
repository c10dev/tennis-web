import { expect, test, type Page } from '@playwright/test';
import { nextOpponent, opponentRead, opponentScouting, type OpponentRead } from '@tennis/game';
import { CYCLE, nodeLadder, nodePlayNext, startLadder, watchErrors } from './helpers.ts';

// Seed 1 with the card cycle below: match 1 has one decision, match 2 two, match 3 is a rematch with match 1's opponent.
const SEED = 1;

/** The first three ladder matches in Node: what the home card and every decision's read show. */
function nodeReads() {
  let s = nodeLadder(SEED);
  const matches: { home: ReturnType<typeof opponentScouting>; reads: OpponentRead[] }[] = [];
  for (let k = 0; k < 3; k++) {
    const home = opponentScouting(s, nextOpponent(s));
    const reads: OpponentRead[] = [];
    s = nodePlayNext(s, 'balanced', (qm) => reads.push(opponentRead(qm)));
    matches.push({ home, reads });
  }
  return matches;
}

const atChoose = (page: Page) => page.evaluate(() => document.body.dataset.quickPhase === 'choose' && !!document.querySelector('#card-attack'));

/** Plays one match with the card cycle, checking the read on every choose screen against Node's. */
async function playChecking(page: Page, reads: OpponentRead[]) {
  let i = 0;
  while (!page.url().includes('#/quick/result')) {
    if (!(await atChoose(page))) {
      await page.waitForTimeout(30);
      continue;
    }
    const read = reads[i]!;
    await expect(page.locator('#scouting')).toHaveText(read.scouting);
    await expect(page.locator('#tell')).toContainText(read.tell!);
    if (read.history.length) await expect(page.locator('#their-cards .chip')).toHaveCount(read.history.length);
    else await expect(page.locator('#their-cards')).toHaveCount(0);
    if (read.rival) await expect(page.locator('#rival')).toHaveText(read.rival);
    else await expect(page.locator('#rival')).toHaveCount(0);
    await page.locator(`#card-${CYCLE[i % 3]!}`).click();
    i++;
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickDecisions)).toBe(String(i));
  }
  expect(i).toBe(reads.length);
}

test.describe('quick match opponent read', () => {
  test.setTimeout(180_000);

  test('scouts the habit on the ladder home, shows their cards and a tell at decisions, and remembers a rival', async ({ page }) => {
    const errors = watchErrors(page);
    const node = nodeReads();
    expect(node[0]!.home.rival).toBeNull();
    expect(node[2]!.home.rival).not.toBeNull();
    expect(node.some((m) => m.reads.some((r) => r.history.length > 0))).toBe(true);

    await startLadder(page, SEED);
    await page.locator('#fast-mode').check();
    for (const m of node) {
      await expect(page.locator('#home-scouting')).toHaveText(`Scouting: ${m.home.habit}`);
      if (m.home.rival) await expect(page.locator('#home-rival')).toHaveText(m.home.rival);
      else await expect(page.locator('#home-rival')).toHaveCount(0);
      await page.locator('#quick-play').click();
      await playChecking(page, m.reads);
      await page.locator('#to-ladder').click();
    }
    expect(errors).toEqual([]);
  });
});
