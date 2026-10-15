// Apps in Toss mini-app config (ADR-022), read by `ait build` / `ait deploy`. `appName` must match the console.
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'rally-tennis',
  brand: { primaryColor: '#123a8c' }, // --court in ui/src/theme.css
  permissions: [],
  // A game: the content runs full screen under Toss's transparent bar (close and more buttons).
  navigationBar: { transparentBackground: true },
  // No page scrolling, pull-to-refresh or swipe-back in a game screen; the in-app back is handled by the game.
  webView: { bounces: false, overScrollMode: 'never', pullToRefreshEnabled: false, allowsBackForwardNavigationGestures: false },
  webBundleDir: 'dist',
});
