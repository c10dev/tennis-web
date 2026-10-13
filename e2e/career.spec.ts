import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_TACTIC, fingerprint, replayMatch, type MatchRecipe } from '@tennis/engine';
import { beginWeek, createPlayer, defaultAllocation, newSeason, pendingUserMatch, quickRecipe } from '@tennis/game';

const SEED = 4;

/** The same career in Node: week 1, the user's first match, as the page will play it. */
function firstMatch() {
  const s = newSeason(SEED, createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, SEED));
  return pendingUserMatch(beginWeek(s, { kind: 'enter' }))!;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function newCareer(page: Page) {
  await page.goto('/#/new');
  await page.locator('#seed').fill(String(SEED));
  await page.locator('#start').click();
  await expect(page.locator('#this-week')).toContainText('Week 1');
}

/** Plays the open tournament to the end with quick results, then closes the week. */
async function quickTournament(page: Page) {
  await expect(page.locator('#draw')).toBeVisible();
  for (let i = 0; i < 20; i++) {
    if (await page.locator('#finish-week').isVisible()) break;
    if (await page.locator('#quick').isVisible()) await page.locator('#quick').click();
    else await page.locator('#play-all').click();
  }
  await page.locator('#finish-week').click();
  await expect(page.locator('#note')).toBeVisible();
}

async function seekToEnd(page: Page) {
  await page.evaluate(() => {
    const s = document.querySelector<HTMLInputElement>('.seek')!;
    s.value = s.max;
    s.dispatchEvent(new Event('input'));
  });
}

test.describe('career', () => {
  test('creates a player and plays weeks: a tournament, training and rest', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await expect(page.locator('#enter')).toBeEnabled();
    await page.locator('#enter').click();
    await quickTournament(page);
    await expect(page.locator('#note')).toContainText('Week 1: Harbour Open won by');
    await expect(page.locator('#status')).toContainText('Week 2 of 24');
    await page.locator('#focus').selectOption('serve');
    await page.locator('#intensity').selectOption('hard');
    await page.locator('#train').click();
    await expect(page.locator('#note')).toContainText('Week 2: trained serve (hard).');
    await expect(page.locator('#calendar tr.past')).toHaveCount(2);
    await page.locator('#nav-rankings').click();
    await expect(page.locator('#rankings tbody tr')).toHaveCount(64);
    await expect(page.locator('#rankings tr.user')).toContainText('Alex Kim');
    await page.locator('#nav-player').click();
    await expect(page.locator('#player')).toContainText('Serve power');
    expect(errors).toEqual([]);
  });

  test('saves to a slot and loads it back after a reload, exactly as it was', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await page.locator('#rest').click();
    await page.locator('#rest').click();
    await expect(page.locator('#status')).toContainText('Week 3 of 24');
    const before = { status: await page.locator('#status').textContent(), calendar: await page.locator('#calendar').textContent() };
    await page.locator('#nav-saves').click();
    await page.locator('tr[data-slot="slot1"] .save').click();
    await expect(page.locator('tr[data-slot="slot1"]')).toContainText('Alex Kim · week 3');
    await page.reload();
    await page.goto('/#/');
    await expect(page.locator('#continue')).toContainText('week 3');
    await page.locator('#load').click();
    await page.locator('tr[data-slot="slot1"] .load').click();
    await expect(page.locator('#this-week')).toBeVisible();
    expect({ status: await page.locator('#status').textContent(), calendar: await page.locator('#calendar').textContent() }).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('watches a match set by set, changes tactics at the break, and records the match the engine plays in Node', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await page.locator('#enter').click();
    await page.locator('#watch').click();
    await expect(page.locator('#view')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-t', /\d/);
    const aggressive = { ...DEFAULT_TACTIC, aggression: 0.9 };
    const changes: MatchRecipe['tacticChanges'] = [];
    for (let set = 1; set <= 5; set++) {
      await seekToEnd(page);
      await expect(page.locator('#match-panel')).toBeVisible();
      if (!(await page.locator('#set-break').isVisible())) break;
      if (set === 1) {
        await page.locator('#aggression').fill('0.9');
        changes.push({ afterSet: 1, player: 'A', tactic: aggressive });
      }
      const paused = Number(await page.locator('body').getAttribute('data-t'));
      await page.locator('#next-set').click();
      await expect.poll(async () => Number(await page.locator('body').getAttribute('data-t'))).toBeGreaterThan(paused);
    }
    await expect(page.locator('#match-result')).toBeVisible();
    const pending = firstMatch();
    const expected = replayMatch({ ...quickRecipe(pending, DEFAULT_TACTIC), tacticChanges: changes });
    await expect(page.locator('body')).toHaveAttribute('data-fingerprint', fingerprint(expected));
    await page.locator('#back-to-tournament').click();
    const end = expected.events.at(-1)!;
    if (end.type !== 'match_end') throw new Error('Node match did not finish');
    await expect(page.locator('#draw .match.user').first()).toContainText(end.score.sets.map(([a, b]) => `${a}-${b}`).join(' '));
    expect(errors).toEqual([]);
  });

  test('replays an earlier match from its recipe', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await page.locator('#enter').click();
    await quickTournament(page);
    await page.locator('#calendar a').first().click();
    await page.locator('#replay-0').click();
    await expect(page.locator('#view')).toBeVisible();
    const expected = replayMatch(quickRecipe(firstMatch(), DEFAULT_TACTIC));
    await expect(page.locator('body')).toHaveAttribute('data-fingerprint', fingerprint(expected));
    await page.locator('#leave').click();
    await expect(page.locator('#history')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('loads the career screens without Three.js', async ({ page }) => {
    const scripts: string[] = [];
    page.on('response', (r) => {
      if (r.url().endsWith('.js') || r.url().includes('.ts')) scripts.push(r.url());
    });
    await newCareer(page);
    expect(scripts.some((u) => /career\/app/.test(u))).toBe(true);
    expect(scripts.some((u) => /three|broadcast/.test(u))).toBe(false);
  });
});
