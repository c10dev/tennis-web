import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          include: ['engine/tests/**/*.test.ts'],
          exclude: ['engine/tests/**/*.slow.test.ts'],
        },
      },
      {
        test: {
          name: 'game',
          include: ['game/tests/**/*.test.ts'],
          exclude: ['game/tests/**/*.slow.test.ts'],
          testTimeout: 20_000,
        },
      },
      {
        test: {
          name: 'season',
          include: ['game/tests/season.slow.test.ts'],
          testTimeout: 600_000,
        },
      },
      {
        test: {
          name: 'quick',
          include: ['game/tests/quick.slow.test.ts'],
          testTimeout: 600_000,
        },
      },
      {
        test: {
          name: 'renderer',
          include: ['renderer/tests/**/*.test.ts'],
          environment: 'node',
          // Property tests sample whole matches at 60 fps; give them room when files run in parallel.
          testTimeout: 20_000,
        },
      },
      {
        test: {
          name: 'stats',
          include: ['engine/tests/**/*.slow.test.ts'],
          testTimeout: 300_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['engine/src/**/*.ts'],
      thresholds: {
        'engine/src/scoring/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
