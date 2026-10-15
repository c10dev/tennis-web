import { defineConfig, devices } from '@playwright/test';

// Browser tests for the replay page (TD-005, TD-013). Not part of `npm test`: run `npm run test:e2e`.
// E2E_PORT lets parallel worktrees run their suites side by side (ADR-017); the toss build (ADR-022) runs on the
// next port up.
const PORT = Number(process.env.E2E_PORT ?? 5179);
const TOSS_PORT = PORT + 1;
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } };

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1280, height: 720 } },
  projects: [
    { name: 'chromium', testIgnore: /toss\.spec\.ts/, use: desktop },
    { name: 'toss', testMatch: /toss\.spec\.ts/, use: { ...desktop, baseURL: `http://localhost:${TOSS_PORT}` } },
  ],
  webServer: [
    { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false },
    { command: `npx vite --mode toss --port ${TOSS_PORT} --strictPort`, url: `http://localhost:${TOSS_PORT}`, reuseExistingServer: false },
  ],
});
