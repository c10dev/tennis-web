// Frame times, draws and triangles on the replay page, the M7 look against the ADR-024 default (TD-059). Not a
// test: run it against a dev server that is already up (`npx vite --port 5190`), one server at a time.
//   npx tsx e2e/perf/frames.ts [--port 5190] [--secs 40] [--viewport 412x503x2] [--throttle 1] [--uncapped] [--runs 2]
// --uncapped turns off vsync and Chromium's frame cap so the frame time shows the headroom under 16.7 ms;
// --throttle slows the page's main thread (not the GPU process) by that factor. On WSL2, Mesa's d3d12 driver gives
// headless Chromium the Windows GPU through ANGLE's GL ES backend; without the env below it falls back to llvmpipe.
import { chromium } from '@playwright/test';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const port = Number(arg('port', '5190'));
const secs = Number(arg('secs', '40'));
const [width, height, dpr] = arg('viewport', '412x503x2').split('x').map(Number) as [number, number, number];
const throttle = Number(arg('throttle', '1'));
const runs = Number(arg('runs', '2'));
const uncapped = process.argv.includes('--uncapped');

const args = ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'];
if (uncapped) args.push('--disable-gpu-vsync', '--disable-frame-rate-limit');
const env = { ...process.env, LD_LIBRARY_PATH: '/usr/lib/wsl/lib', GALLIUM_DRIVER: 'd3d12', MESA_D3D12_DEFAULT_ADAPTER_NAME: 'NVIDIA' };
// The default is the ADR-024 look since 2026-10-16; `rig=mannequin` is the M7 look it replaced.
const configs: [string, string][] = [
  ['M7 high', '&rig=mannequin'],
  ['M7 low', '&rig=mannequin&quality=low'],
  ['default high', ''],
  ['default low', '&quality=low'],
];

interface Sample { renderer: string; dts: number[]; cams: Record<string, { calls: number[]; tris: number[]; dts: number[] }>; quality: string }

const quantile = (values: readonly number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
};
const mean = (values: readonly number[]) => values.reduce((a, x) => a + x, 0) / values.length;

// In-page code as a string: tsx's keepNames helper (`__name`) does not exist in the page.
const probe = `async (secs) => {
  const gl = document.querySelector('#view').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '?';
  const dts = [];
  const cams = {};
  let last = performance.now();
  const end = last + secs * 1000;
  await new Promise((done) => {
    const tick = (now) => {
      const dt = now - last;
      last = now;
      dts.push(dt);
      const d = document.body.dataset;
      const cam = (cams[d.camera ?? '?'] ??= { calls: [], tris: [], dts: [] });
      cam.calls.push(Number(d.calls));
      cam.tris.push(Number(d.triangles));
      cam.dts.push(dt);
      if (now < end) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  return { renderer, dts: dts.slice(1), cams, quality: document.body.dataset.quality ?? '?' };
}`;

const browser = await chromium.launch({ headless: true, args, env });
for (const [name, extra] of configs) {
  for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    if (throttle > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
    let errors = 0;
    page.on('pageerror', () => errors++);
    await page.goto(`http://localhost:${port}/?seed=42&surface=hard&mode=key${extra}`);
    await page.waitForFunction(() => document.body.dataset.calls, null, { timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    const sample = (await page.evaluate(`(${probe})(${secs})`)) as Sample;
    if (run === 0 && name === configs[0]![0]) console.log(`renderer: ${sample.renderer}`);
    const cams = Object.entries(sample.cams)
  .map(([cam, c]) => `${cam} ${Math.max(...c.calls)}/${(Math.max(...c.tris) / 1000).toFixed(1)}k p50 ${quantile(c.dts, 0.5).toFixed(2)} ms`)
  .join(' | ');
    const d = sample.dts;
    console.log(`${name} #${run} [${sample.quality}] ${(1000 / mean(d)).toFixed(1)} fps, p50 ${quantile(d, 0.5).toFixed(2)} p95 ${quantile(d, 0.95).toFixed(2)} p99 ${quantile(d, 0.99).toFixed(2)} max ${Math.max(...d).toFixed(1)} ms, errors ${errors} :: ${cams}`);
    await context.close();
  }
}
await browser.close();
