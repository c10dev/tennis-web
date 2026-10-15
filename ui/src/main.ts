// Entry point: ?seed= opens the dev replay page (web build only, ADR-022); anything else is the game. Each loads its
// own code, so the career screens do not download Three.js until a match is watched (TD-014).
import './style.css';
import { entryFor, TARGET } from './target.ts';

if (entryFor(TARGET, location.search) === 'replay') void import('./replay/page.ts');
else void import('./career/app.ts');
