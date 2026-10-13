import { defineConfig } from 'vite';

// The dev page lives in ui/; renderer/ and engine/ are workspace packages it imports as TypeScript source.
export default defineConfig({
  root: 'ui',
  build: { outDir: '../dist', emptyOutDir: true },
});
