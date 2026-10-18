// Entry point: ?seed= opens the dev replay page (web build only, ADR-022), ?legacy=1 the season mode and quick match,
// anything else on the web the text tour (ADR-033). Each loads its own code, so the career and tour screens do not
// download Three.js (TD-014).
import './style.css';
import { entryFor, TARGET } from './target.ts';

const entry = entryFor(TARGET, location.search);
if (entry === 'replay') void import('./replay/page.ts');
else if (entry === 'journey') void import('./journey/app.ts');
else void import('./career/app.ts');
