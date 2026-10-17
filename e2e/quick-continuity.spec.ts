import { expect, test } from '@playwright/test';

// The hybrid edit (ADR-030, presentation spec E1, E8 C): in 3D, match time never jumps on screen unless a wipe
// covers it. Every frame's match second is sampled in the page; between two frames it may only move forward, by at
// most the fastest speed (the 5× walk back) times the frame's real time.

interface Sample { t: number; real: number; wipe: boolean; ff: boolean; phase: string }

test('plays the opening points behind wipes, then one continuous picture through two decisions', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/#/quick');
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await page.locator('#quick-play').click();
  await page.evaluate(() => {
    const w = window as unknown as { __samples: Sample[] };
    w.__samples = [];
    const tick = () => {
      const d = document.body.dataset;
      if (d.t) w.__samples.push({ t: Number(d.t), real: performance.now() / 1000, wipe: d.wipe === '1', ff: d.ff === '1', phase: d.quickPhase ?? '' });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (const key of ['Digit1', 'Digit2']) {
    await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase === 'choose' && !!document.querySelector('#card-attack')), { timeout: 150_000 }).toBe(true);
    await page.keyboard.press(key);
  }
  await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 60_000 }).toMatch(/choose|auto/);
  const samples = await page.evaluate(() => (window as unknown as { __samples: Sample[] }).__samples);
  expect(samples.length).toBeGreaterThan(100);
  const jumps: string[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (a.wipe || b.wipe) continue;
    const dt = b.t - a.t;
    // dataset.t is written by the broadcast's own frame, so allow it one frame (50 ms) ahead of the sampler.
    const most = 5 * (b.real - a.real + 0.05) + 0.02;
    if (dt < -0.011 || dt > most) jumps.push(`${a.t.toFixed(2)} → ${b.t.toFixed(2)} in ${(b.real - a.real).toFixed(3)} s (${b.phase})`);
  }
  expect(jumps).toEqual([]);
  expect(samples.some((s) => s.wipe)).toBe(true);
  expect(samples.some((s) => s.ff)).toBe(true);
});
