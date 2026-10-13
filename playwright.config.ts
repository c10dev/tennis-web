import { defineConfig, devices } from '@playwright/test';

// Browser tests for the replay page (TD-005, TD-013). Not part of `npm test`: run `npm run test:e2e`.
// E2E_PORT lets parallel worktrees run their suites side by side (ADR-017).
const PORT = Number(process.env.E2E_PORT ?? 5179);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1280, height: 720 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false },
});
