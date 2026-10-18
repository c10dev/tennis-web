// Contact sheets of the players (ADR-031, M8 phase 0): the same moments of three matches, up close in the rig viewer
// and at a phone's stage size through the TV camera, so every motion or look step has a before and after. Not a test:
// run it against a dev server that is already up (`npx vite --port 5190`).
//   npx tsx e2e/shots/sheets.ts [--port 5190] [--label now] [--against baseline] [--out shots]
// Writes shots/<label>/<seed>-<moment>.webp; with --against, also shots/<label>/vs-<against>/<sheet> (that label's
// sheet above this one's). The browser draws with SwiftShader, so it runs on a machine without a GPU.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { exhibitionConfig, simulateMatch, type ShotEvent, type Surface } from '@tennis/engine';
import { buildTimeline, type PointSegment } from '@tennis/renderer';

const arg = (name: string, fallback: string | null = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const port = Number(arg('port', '5190'));
const label = arg('label', 'now')!;
const against = arg('against');
const out = arg('out', 'shots')!;

const MATCHES: [number, Surface][] = [[42, 'hard'], [2, 'clay'], [3, 'grass']];
const HOLDS = ['none', ...['attack', 'defend', 'counter'].flatMap((card) => [0, 1, 2, 3].map((i) => `${card}:${i}`))];

interface Row { view: string; query: string }
interface Moment { name: string; rows: Row[] }

/** A shot found in the match: its point (segment index), its index in the point, the event. */
interface Found { point: number; shot: number; s: ShotEvent; seg: PointSegment }

// The near player stands at court y < 0 (Three z > 0, the TV camera's end).
const near = (f: Found) => f.s.hitterPos.y < 0;

function moments(seed: number, surface: Surface): Moment[] {
  const timeline = buildTimeline(simulateMatch(exhibitionConfig(surface), seed));
  const shots: Found[] = timeline.segments.flatMap((seg, point) => seg.point.shots.map((s, shot) => ({ point, shot, s, seg })));
  const first = (ok: (f: Found) => boolean) => shots.find((f) => near(f) && ok(f));
  const base = `seed=${seed}&surface=${surface}`;
  const at = (f: Found | undefined, dt: string, views: string[]): Row[] =>
    f ? views.map((view) => ({ view, query: `${base}&point=${f.point}&shot=${f.shot}&dt=${dt}&view=${view}${view === 'tv' ? '' : '&size=300'}` })) : [];
  const after = (f: Found | undefined, views: string[]): Row[] => {
    if (!f) return [];
    const t = [0.2, 0.6, 1.0, 1.4].map((d) => (f.seg.landed + d).toFixed(2)).join(',');
    return views.map((view) => ({ view, query: `${base}&point=${f.point}&shot=${f.shot}&t=${t}&view=${view}${view === 'tv' ? '' : '&size=300'}` }));
  };
  const drives = shots.filter((f) => near(f) && f.s.shot !== 'serve');
  const low = drives.reduce<Found | undefined>((a, f) => (!a || f.s.from.z < a.s.from.z ? f : a), undefined);
  // The longest run: the most court covered between a player's two shots of a point.
  let run: Found | undefined;
  let runMetres = 0;
  for (const f of drives) {
    const prev = f.seg.point.shots.slice(0, f.shot).reverse().find((s) => s.hitter === f.s.hitter);
    const m = prev ? Math.hypot(f.s.hitterPos.x - prev.hitterPos.x, f.s.hitterPos.y - prev.hitterPos.y) : 0;
    if (m > runMetres) [run, runMetres] = [f, m];
  }
  // A point's last shot by the player the camera sees from behind, ending as named.
  const ending = (outcome: ShotEvent['outcome'][]) => shots.find((f) => near(f) && f.shot === f.seg.point.shots.length - 1 && outcome.includes(f.s.outcome));
  const hold = (view: string, holds: string[]): Row => ({ view, query: `${base}&point=3&hold=${holds.join(',')}&view=${view}${view === 'tv' ? '' : '&size=200'}` });
  return [
    { name: 'serve', rows: at(first((f) => f.s.shot === 'serve'), '-1.0,-0.6,-0.3,-0.1,0,0.25', ['side', 'tv']) },
    { name: 'forehand', rows: at(first((f) => f.s.shot === 'drive' && f.s.wing === 'forehand'), '-0.6,-0.35,-0.15,0,0.15,0.35', ['front', 'side', 'tv']) },
    { name: 'backhand', rows: at(first((f) => f.s.shot === 'drive' && f.s.wing === 'backhand'), '-0.6,-0.35,-0.15,0,0.15,0.35', ['front', 'side', 'tv']) },
    { name: 'low', rows: at(low, '-0.35,-0.15,0,0.15', ['front', 'tv']) },
    { name: 'run', rows: at(run, '-1.2,-0.9,-0.6,-0.3,0', ['chase', 'tv']) },
    { name: 'winner', rows: after(ending(['winner', 'ace']), ['front', 'tv']) },
    { name: 'error', rows: after(ending(['unforced_error']), ['front', 'tv']) },
    { name: 'holds', rows: [hold('front', HOLDS), hold('tv', HOLDS.slice(0, 7)), hold('tv', HOLDS.slice(7))] },
  ];
}

/** One rig-viewer strip as a PNG data URL. */
async function strip(page: Page, query: string): Promise<string> {
  await page.goto(`http://localhost:${port}/rig.html?${query}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 120_000 });
  return `data:image/png;base64,${(await page.locator('canvas').screenshot()).toString('base64')}`;
}

/** Stacks images under their captions at CSS size (`density` image pixels to one), no wider than `maxWidth`; WebP. */
async function compose(page: Page, parts: { caption: string; src: string }[], maxWidth: number, density: number): Promise<Buffer> {
  const url = await page.evaluate(async ({ parts, maxWidth, density }) => {
    // No named functions in here: tsx wraps them in a helper the page does not have.
    const imgs = await Promise.all(parts.map((p) => new Promise<HTMLImageElement>((done) => { const i = new Image(); i.onload = () => done(i); i.src = p.src; })));
    const bar = 22;
    const width = Math.round(Math.min(maxWidth, Math.max(...imgs.map((i) => i.width / density))));
    const heights = imgs.map((i) => Math.round((i.height * width) / i.width));
    const c = document.createElement('canvas');
    c.width = width;
    c.height = heights.reduce((a, h) => a + h + bar, 0);
    const g = c.getContext('2d')!;
    g.fillStyle = '#111';
    g.fillRect(0, 0, c.width, c.height);
    let y = 0;
    imgs.forEach((img, k) => {
      g.fillStyle = '#eee';
      g.font = '14px monospace';
      g.fillText(parts[k]!.caption, 6, y + 16);
      g.drawImage(img, 0, y + bar, width, heights[k]!);
      y += heights[k]! + bar;
    });
    return c.toDataURL('image/webp', 0.85);
  }, { parts, maxWidth, density });
  return Buffer.from(url.split(',')[1]!, 'base64');
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 2600, height: 1100 }, deviceScaleFactor: 2 });
const dir = `${out}/${label}`;
mkdirSync(dir, { recursive: true });
const started = Date.now();
let sheets = 0;
for (const [seed, surface] of MATCHES) {
  for (const m of moments(seed, surface)) {
    if (!m.rows.length) continue;
    const parts = [];
    for (const r of m.rows) parts.push({ caption: `${label} · seed ${seed} ${surface} · ${m.name} · ${r.view}`, src: await strip(page, r.query) });
    writeFileSync(`${dir}/${seed}-${m.name}.webp`, await compose(page, parts, 2600, 2));
    sheets++;
  }
}
if (against) {
  const other = `${out}/${against}`;
  const vs = `${dir}/vs-${against}`;
  mkdirSync(vs, { recursive: true });
  const asUrl = (f: string) => `data:image/webp;base64,${readFileSync(f).toString('base64')}`;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.webp'))) {
    if (!existsSync(`${other}/${name}`)) continue;
    const pair = [{ caption: against, src: asUrl(`${other}/${name}`) }, { caption: label, src: asUrl(`${dir}/${name}`) }];
    writeFileSync(`${vs}/${name}`, await compose(page, pair, 2600, 1));
  }
}
await browser.close();
console.log(`${sheets} sheets in ${dir} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
