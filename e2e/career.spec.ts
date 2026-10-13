import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_TACTIC, fingerprint, replayMatch, type MatchRecipe } from '@tennis/engine';
import { beginWeek, createPlayer, defaultAllocation, newSeason, pendingUserMatch, playRound, quickRecipe, tournamentView } from '@tennis/game';
import { watchErrors } from './helpers.ts';

const SEED = 4;

/** The same career in Node: week 1, the user's first match, as the page will play it. */
function firstMatch() {
  const s = newSeason(SEED, createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, SEED));
  return pendingUserMatch(beginWeek(s, { kind: 'enter' }))!;
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
    // The drawing buffer, not just the CSS box: a canvas mounted before it is in the document must still get a size.
    await expect.poll(() => page.locator('#view').evaluate((c) => (c as HTMLCanvasElement).width >= c.clientWidth && c.clientWidth > 300)).toBe(true);
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
    // A double click must play the round once: the old page cannot act again while the tournament loads.
    await page.locator('#back-to-tournament').dblclick();
    const end = expected.events.at(-1)!;
    if (end.type !== 'match_end') throw new Error('Node match did not finish');
    await expect(page.locator('#draw .match.user').first()).toContainText(end.score.sets.map(([a, b]) => `${a}-${b}`).join(' '));
    const s = playRound(beginWeek(newSeason(SEED, createPlayer({ name: 'Alex Kim', style: 'baseliner', allocation: defaultAllocation('baseliner') }, SEED)), { kind: 'enter' }), { ...quickRecipe(pending, DEFAULT_TACTIC), tacticChanges: changes });
    await expect(page.locator('#draw .round')).toHaveCount(tournamentView(s)!.rounds.length);
    expect(errors).toEqual([]);
  });

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

  test('sends a malformed history link home instead of crashing', async ({ page }) => {
    const errors = watchErrors(page);
    await newCareer(page);
    await page.goto('/#/history/0.5');
    await expect(page).toHaveURL(/#\/home/);
    expect(errors).toEqual([]);
  });

  test('still opens the title screen when the browser refuses save storage', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { get: () => { throw new Error('storage blocked'); } });
    });
    await page.goto('/#/');
    await expect(page.locator('#quick-match')).toBeVisible();
    await expect(page.locator('#new-career')).toBeVisible();
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
