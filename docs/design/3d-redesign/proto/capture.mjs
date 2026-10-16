// Renders every style frame (or a comma-separated list) to PNGs: run from the repo root while the proto folder is
// served on :5290 (see docs/3d-redesign.md). three is routed to node_modules, so no network is needed.
/* global process, console, document */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
const out = process.argv[2];
const only = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1300, height: 700 }, deviceScaleFactor: 2 });
await ctx.route('https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js', (r) => r.fulfill({ path: resolve('node_modules/three/build/three.module.js'), contentType: 'text/javascript' }));
await ctx.route('https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.core.js', (r) => r.fulfill({ path: resolve('node_modules/three/build/three.core.js'), contentType: 'text/javascript' }));
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:5290/?frame=cam-chase');
await p.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60000 });
const ids = only ? only.split(',') : (await p.evaluate(() => document.body.dataset.ready)).split(',');
for (const id of ids) {
  await p.goto(`http://localhost:5290/?frame=${id}`);
  await p.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60000 });
  await p.locator('#frame').screenshot({ path: `${out}/${id}.png` });
  console.log('ok', id);
}
await b.close();
