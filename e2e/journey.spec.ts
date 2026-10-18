import { expect, test, type Page } from '@playwright/test';

// The text tour (ADR-033) on the web build: a practice season alone, and a two-member room played in lockstep by two
// tabs of one browser (the local room server). No Three.js anywhere.

async function create(page: Page, name: string, talents: string[]): Promise<void> {
  await page.fill('#name', name);
  for (const t of talents) await page.click(`[aria-label="${t} 더하기"]`);
  await page.click('#create');
}

async function planAndReady(page: Page): Promise<void> {
  await page.waitForSelector('#calendar, #choice');
  while (await page.$('#choice')) await page.click('#choice .j-option');
  await page.click('#ready');
}

test.describe('text tour on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test('a practice season: make a player, plan a swing, read the report, plan the next', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('랠리 투어');
    await page.click('#practice');
    await create(page, '김랠리', ['서브', '서브', '포핸드']);
    await expect(page.locator('#me-line')).toContainText('OVR 70');
    await expect(page.locator('#calendar .j-week')).toHaveCount(12);
    await planAndReady(page);
    await expect(page.locator('#my-swing')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#headlines .j-headline').first()).not.toBeEmpty();
    await expect(page.locator('#staff .j-staff-line').first()).toBeVisible();
    await page.click('#next-plan');
    await expect(page.locator('.j-me .j-eyebrow')).toContainText('클레이 시즌');
    expect(scripts.some((u) => /three|broadcast/.test(u))).toBe(false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const small = await page.$$eval('.j-main button', (bs) => bs.filter((b) => b.getBoundingClientRect().height < 44 && (b as HTMLElement).offsetParent).length);
    expect(small).toBe(0);
  });

  test('reloading keeps the room and the plan in progress', async ({ page }) => {
    await page.goto('/');
    await page.click('#practice');
    await create(page, '박리로드', []);
    await page.waitForSelector('#calendar, #choice');
    while (await page.$('#choice')) await page.click('#choice .j-option');
    await page.click('#focus button >> nth=2');
    await page.reload();
    await expect(page.locator('#focus button >> nth=2')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/');
    await page.click('#continue');
    await expect(page.locator('#focus button >> nth=2')).toHaveAttribute('aria-pressed', 'true');
  });
});

test('two friends in a room play the same swing and see the same room', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/?as=u1');
  await a.click('#make-room');
  await create(a, '가나다', ['서브', '서브', '서브']);
  const code = (await a.locator('#room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await b.goto('/?as=u2');
  await b.fill('#join-code', code);
  await b.click('#join');
  await create(b, '라마바', ['리턴', '리턴', '체력']);
  await expect(b.locator('#waiting-host')).toBeVisible();
  await expect(a.locator('#members li')).toHaveCount(2);

  await a.click('#start-season');
  await planAndReady(a);
  await expect(a.locator('#ready-list li.ok')).toHaveCount(1);
  await b.goto(`/?as=u2#/play`);
  await planAndReady(b);

  for (const p of [a, b]) {
    await p.goto(`/?as=${p === a ? 'u1' : 'u2'}#/play`);
    await expect(p.locator('#room-report')).toBeVisible({ timeout: 30_000 });
  }
  const feedA = await a.locator('#room-feed').textContent();
  const feedB = await b.locator('#room-feed').textContent();
  expect(feedA).toBe(feedB);
  expect(feedA).toContain('룸 컵 우승');
  await expect(a.locator('#room-report .j-standings li')).toHaveCount(2);
  await context.close();
});
