import { defineConfig } from 'vite';

// The dev page lives in ui/; renderer/ and engine/ are workspace packages it imports as TypeScript source.
// `--mode toss` builds for Apps in Toss (ADR-022) with relative asset paths, as the mini-app bundle is not served
// from the site root.
export default defineConfig(({ mode }) => ({
  root: 'ui',
  base: mode === 'toss' ? './' : '/',
  build: { outDir: '../dist', emptyOutDir: true },
}));
