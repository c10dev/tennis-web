import { expect, test } from '@playwright/test';

type Rgb = [number, number, number];
const rgb = (css: string): Rgb => css.match(/\d+/g)!.slice(0, 3).map(Number) as Rgb;
const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: number[]) => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
/** WCAG 2 contrast ratio. */
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a.map(lin)), lum(b.map(lin))].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
/** Machado et al. 2009 (severity 1) in linear RGB, then CIE76 ΔE in Lab. */
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
function lab(c: Rgb, m: number[][]) {
  const l = c.map(lin);
  const [r, g, b] = m.map((row) => Math.min(1, Math.max(0, row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!)));
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [X, Y, Z] = [(0.4124 * r! + 0.3576 * g! + 0.1805 * b!) / 0.95047, lum([r!, g!, b!]), (0.0193 * r! + 0.1192 * g! + 0.9505 * b!) / 1.08883].map(f);
  return [116 * Y! - 16, 500 * (X! - Y!), 200 * (Y! - Z!)];
}
/** The smallest ΔE between any two of the colours for protan and deutan viewers. */
const minCvdDelta = (cs: Rgb[]) => Math.min(...Object.values(CVD).flatMap((m) => cs.flatMap((a, i) => cs.slice(i + 1).map((b) => {
  const [p, q] = [lab(a, m), lab(b, m)];
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
}))));

// Rally Pop (ADR-018 phase 0, ADR-020 phase 1a): sticker cards never rely on colour alone (icon, key, name), their
// text and band colours stay apart for protan and deutan viewers, and the verdict carries a symbol and a word.
test('marks every card with an icon and its key, uses the colour-blind-safe trio, and words the verdict with a symbol', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('#quick-match').click();
  await page.locator('#quick-seed').fill('3');
  await page.locator('#quick-start').click();
  await page.locator('#fast-mode').check();
  await page.locator('#quick-play').click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.quickPhase), { timeout: 20_000 }).toBe('choose');
  await expect(page.locator('#moment')).toHaveCSS('background-color', 'rgb(255, 194, 26)');
  const cards = [['attack', 'rgb(194, 65, 12)', 'rgb(255, 122, 69)'], ['defend', 'rgb(11, 102, 214)', 'rgb(74, 163, 255)'], ['counter', 'rgb(4, 126, 115)', 'rgb(63, 211, 176)']] as const;
  const texts: Rgb[] = [];
  const bands: Rgb[] = [];
  for (const [i, [card, text, band]] of cards.entries()) {
    const btn = page.locator(`#card-${card}`);
    await expect(btn.locator('svg.icon')).toHaveCount(1);
    await expect(btn.locator('svg.icon')).toHaveAttribute('aria-hidden', 'true');
    await expect(btn.locator('.key')).toHaveText(String(i + 1));
    await expect(btn).toHaveCSS('color', text);
    await expect(btn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(await btn.evaluate((el) => getComputedStyle(el, '::before').backgroundColor)).toBe(band);
    texts.push(rgb(text));
    bands.push(rgb(band));
  }
  for (const t of texts) expect(contrast(t, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  expect(minCvdDelta(texts)).toBeGreaterThan(30);
  expect(minCvdDelta(bands)).toBeGreaterThan(30);
  await page.locator('#card-attack').click();
  await expect(page.locator('#reveal .chip svg.icon')).toHaveCount(2);
  await expect(page.locator('#reveal .verdict')).toHaveText(/^(✓ You read it!|✗ They read you|= Same card)$/);
});

// Rally Pop phase 1a (ADR-020): the self-hosted faces load (a wrong path would only fall back silently).
test('loads the self-hosted Rally Pop fonts', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#quick-match')).toBeVisible();
  const loaded = await page.evaluate(async () => {
    const faces: [string, string][] = [['Lilita One', '400'], ['Nunito', '600'], ['Nunito', '800'], ['Barlow Condensed', '600'], ['Barlow Condensed', '700']];
    await Promise.all(faces.map(([f, w]) => document.fonts.load(`${w} 16px "${f}"`)));
    return faces.filter(([f, w]) => [...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.weight === w && x.status === 'loaded'));
  });
  expect(loaded).toHaveLength(5);
  await expect(page.locator('.title h1')).toHaveCSS('font-family', /Lilita One/);
  await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/);
});
