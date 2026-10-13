// Hash routes: #/name/param/param.
export interface Route {
  name: string;
  params: string[];
}

export function currentRoute(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] ?? '', params: parts.slice(1) };
}

export function go(path: string): void {
  if (location.hash === path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}
