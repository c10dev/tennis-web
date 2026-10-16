import { expect, test, type Page } from '@playwright/test';
import type { Card } from '@tennis/engine';
import {
  autoPlay, createPlayer, decide, defaultAllocation, finishQuick, matchOver, newLadder, opponentRead, opponentScouting, planTip, startQuick, type GamePlan,
  type OpponentRead,
} from '@tennis/game';

// Seed 1 with the card cycle below: match 1 has one decision, match 2 two, match 3 is a rematch with match 1's opponent.
const SEED = 1;
const CYCLE: Card[] = ['attack', 'defend', 'counter'];

/** The first three ladder matches in Node: what the home card and every decision's read show. */
function nodeLadder() {
  let s = newLadder(SEED, createPlayer({ name: 'Alex Kim', style: 'big_server', allocation: defaultAllocation('big_server') }, SEED));
  const matches: { home: ReturnType<typeof opponentScouting>; tip: GamePlan | null; reads: OpponentRead[] }[] = [];
  for (let k = 0; k < 3; k++) {
    const qm = startQuick(s);
    const home = opponentScouting(s, qm.opponent);
    const tip = planTip(s.world.players.find((p) => p.id === qm.opponent)!.style);
    const reads: OpponentRead[] = [];
    let i = 0;
    for (autoPlay(qm); !matchOver(qm); autoPlay(qm)) {
      reads.push(opponentRead(qm));
      decide(qm, CYCLE[i++ % 3]!);
    }
    matches.push({ home, tip, reads });
    s = finishQuick(s, qm);
  }
  return matches;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
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

  test('scouts the habit and the plan tip on the ladder home, shows their cards and a tell at decisions, and remembers a rival', async ({ page }) => {
    const errors = watchErrors(page);
    const node = nodeLadder();
    expect(node[0]!.home.rival).toBeNull();
    expect(node[2]!.home.rival).not.toBeNull();
    expect(node.some((m) => m.reads.some((r) => r.history.length > 0))).toBe(true);
    expect(node.some((m) => m.tip !== null)).toBe(true);

    await page.goto('/#/');
    await page.locator('#quick-match').click();
    await page.locator('#quick-seed').fill(String(SEED));
    await page.locator('#quick-start').click();
    await page.locator('#fast-mode').check();
    for (const m of node) {
      await expect(page.locator('#home-scouting')).toHaveText(`Scouting: ${m.home.habit}`);
      if (m.home.rival) await expect(page.locator('#home-rival')).toHaveText(m.home.rival);
      else await expect(page.locator('#home-rival')).toHaveCount(0);
      if (m.home.plan) await expect(page.locator('#plan-tip')).toHaveText(m.home.plan);
      else await expect(page.locator('#plan-tip')).toHaveCount(0);
      await expect(page.locator('.plan-btn.tipped')).toHaveCount(m.tip ? 1 : 0);
      if (m.tip) await expect(page.locator(`#plan-${m.tip}`)).toHaveClass(/tipped/);
      await page.locator('#quick-play').click();
      await playChecking(page, m.reads);
      await page.locator('#to-ladder').click();
    }
    expect(errors).toEqual([]);
  });
});
