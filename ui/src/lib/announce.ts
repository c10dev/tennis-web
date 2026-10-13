// One polite live region for the whole page: screen readers hear the score, the stakes and outcomes that sighted
// players read off the ticker and the decision panel.

/** Says `text` once through the page's live region (made on first use). */
export function announce(text: string): void {
  let el = document.getElementById('announcer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'announcer';
    el.className = 'sr-only';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.textContent = text;
}
