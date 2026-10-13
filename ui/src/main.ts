// Entry point: ?seed= opens the dev replay page; anything else is the career game. Each loads its own code, so the
// career screens do not download Three.js until a match is watched (TD-014).
import './style.css';

if (new URLSearchParams(location.search).has('seed')) void import('./replay/page.ts');
else void import('./career/app.ts');
