import { expect, test } from '@playwright/test';
import { createPlayer, defaultAllocation, newLadder, toQuickSave } from '@tennis/game';

// The toss build (`vite --mode toss`, ADR-022): the quick match only, no season mode, no dev replay page.
test.describe('toss target', () => {
  test('lands on the ladder start form and plays from there, without errors on the mocked SDK', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/quick$/);
    await expect(page.locator('#quick-start')).toBeVisible();
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await expect(page.locator('#quick-play')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('sends season routes and the title to the ladder', async ({ page }) => {
    for (const path of ['/#/', '/#/new', '/#/saves', '/#/home', '/#/nowhere']) {
      await page.goto(path);
      await expect(page).toHaveURL(/#\/quick$/);
      await expect(page.locator('#new-career')).toHaveCount(0);
    }
  });

  test('ignores ?seed= (no dev replay page)', async ({ page }) => {
    await page.goto('/?seed=42&surface=clay');
    await expect(page).toHaveURL(/#\/quick$/);
    await expect(page.locator('#controls')).toHaveCount(0);
  });
});

// Korean (ADR-022): the toss build speaks Korean and lays Hangul out in the self-hosted Pretendard.
test.describe('toss target in Korean', () => {
  test('plays to a decision in Korean, with Pretendard loaded', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.locator('#quick-start')).toHaveText('래더 시작');
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await expect(page.locator('#quick-play')).toHaveText('경기 시작');
    await expect(page.locator('#home-scouting')).toContainText('스카우팅');
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(page.locator('#moment')).toHaveText(/^(매치 포인트( 위기)?|\d+-\d+ 동점|승부처)$/, { timeout: 30_000 });
    await expect(page.locator('#card-attack strong')).toHaveText('공격');
    await expect(page.locator('#situation')).toHaveText(/^(내|상대) 서브 · \d+-\d+$/);
    const loaded = await page.evaluate(async () => {
      await Promise.all(['600', '800'].map((w) => document.fonts.load(`${w} 16px "Pretendard"`, '한')));
      return [...document.fonts].filter((x) => x.family.replace(/"/g, '') === 'Pretendard' && x.status === 'loaded').map((x) => x.weight).sort();
    });
    expect(loaded).toEqual(['600', '800']);
  });
});

// Saves (ADR-022, M7 step 7): the toss build keeps the ladder in the Toss user's storage and takes over the
// browser-era IndexedDB ladder once.
test.describe('toss target saves', () => {
  test('keeps the ladder after a reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#quick-name').fill('Min Park');
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await expect(page.locator('#quick-play')).toBeVisible();
    await page.reload();
    await expect(page.locator('#quick-play')).toBeVisible();
    await expect(page.locator('#ladder')).toContainText('Min Park');
  });

  test('takes over a ladder saved in IndexedDB by the browser build', async ({ page }) => {
    const file = toQuickSave(newLadder(5, createPlayer({ name: 'Old Save', style: 'baseliner', allocation: defaultAllocation('baseliner') }, 5)), 'then');
    await page.goto('/');
    await expect(page.locator('#quick-start')).toBeVisible();
    await page.evaluate((json) => new Promise<void>((done, fail) => {
      const r = indexedDB.open('tennis-sim', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('saves');
      r.onerror = () => fail(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(json, 'quick');
        tx.oncomplete = () => done();
      };
    }), JSON.stringify(file));
    await page.reload();
    await expect(page.locator('#ladder')).toContainText('Old Save');
    const left = await page.evaluate(() => new Promise((done) => {
      const r = indexedDB.open('tennis-sim', 1);
      r.onsuccess = () => {
        const get = r.result.transaction('saves', 'readonly').objectStore('saves').get('quick');
        get.onsuccess = () => done(get.result ?? null);
      };
    }));
    expect(left).toBeNull();
    await page.reload();
    await expect(page.locator('#ladder')).toContainText('Old Save');
  });
});

// The Android back button (ADR-022, M7 step 8), fired through the devtools mock.
test.describe('toss target back button', () => {
  test('asks before conceding in a match, goes to the ladder from a result, asks before leaving the ladder', async ({ page }) => {
    const back = () => page.evaluate(() => (window as unknown as { __ait: { trigger(e: string): void } }).__ait.trigger('backEvent'));
    await page.goto('/');
    await page.locator('#quick-seed').fill('3');
    await page.locator('#quick-start').click();
    await page.locator('#fast-mode').check();
    await page.locator('#quick-play').click();
    await expect(page.locator('#quick-panel')).toBeVisible();
    await back();
    await expect(page.getByRole('dialog')).toContainText('기권할까요?');
    await back();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await back();
    await page.locator('#confirm-ok').click();
    await expect(page.locator('#quick-result h1')).toHaveText(/^기권패 \d+-\d+$/);
    await back();
    await expect(page).toHaveURL(/#\/quick$/);
    await back();
    await expect(page.getByRole('dialog')).toContainText('게임을 종료할까요?');
    await page.locator('#confirm-cancel').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
