import { expect, test, type Page } from '@playwright/test';

// The room server on `wrangler dev` (ADR-033, run with E2E_CLOUD=1): two members in two browser contexts (separate
// storage, so nothing is shared but the server) play a swing and see the same room.

async function create(page: Page, name: string): Promise<void> {
  await page.fill('#name', name);
  await page.click('#create');
}

async function planAndReady(page: Page): Promise<void> {
  await page.waitForSelector('#calendar, #choice');
  while (await page.$('#choice')) await page.click('#choice .j-option');
  await page.click('#ready');
}

test('two friends on the room server play the same swing', async ({ browser }) => {
  const [ca, cb] = [await browser.newContext(), await browser.newContext()];
  const [a, b] = [await ca.newPage(), await cb.newPage()];
  await a.goto('/?as=c1');
  await a.click('#make-room');
  await create(a, '구름하나');
  const code = (await a.locator('#room-code').textContent())!.trim();
  await b.goto('/?as=c2');
  await b.fill('#join-code', code);
  await b.click('#join');
  await create(b, '구름둘');
  await expect(a.locator('#members li')).toHaveCount(2, { timeout: 15_000 });
  await a.click('#start-season');
  await b.goto('/?as=c2#/play');
  await planAndReady(a);
  await planAndReady(b);
  for (const p of [a, b]) await expect(p.locator('#room-report')).toBeVisible({ timeout: 30_000 });
  expect(await a.locator('#room-feed').textContent()).toBe(await b.locator('#room-feed').textContent());
  await ca.close();
  await cb.close();
});
