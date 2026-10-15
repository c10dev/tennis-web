import { expect, test } from '@playwright/test';

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
