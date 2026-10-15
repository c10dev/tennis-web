import aitDevtools from '@apps-in-toss/devtools/unplugin';
import { defineConfig } from 'vite';

// The dev page lives in ui/; renderer/ and engine/ are workspace packages it imports as TypeScript source.
// `--mode toss` builds for Apps in Toss (ADR-022) with relative asset paths, as the mini-app bundle is not served
// from the site root. In toss dev the devtools plugin swaps the SDK for a mock (it switches itself off in
// production builds); AIT_PANEL=0 hides its floating panel (the e2e server does).
export default defineConfig(({ mode }) => ({
  root: 'ui',
  base: mode === 'toss' ? './' : '/',
  plugins: mode === 'toss' ? [aitDevtools.vite({ panel: process.env.AIT_PANEL !== '0' })] : [],
  build: { outDir: '../dist', emptyOutDir: true },
}));
