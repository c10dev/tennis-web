// A confirm dialog (ADR-022): one at a time, modal, focus on the safe choice; Escape, a tap outside or the back
// button (closeDialog) cancel it. Resolves true only on the confirm button.
import { h } from './h.ts';
import './confirm.css';

let open: { close(ok: boolean): void } | null = null;

export const dialogOpen = (): boolean => open !== null;

export function closeDialog(): void {
  open?.close(false);
}

export function confirmDialog(opts: { title: string; body?: string; ok: string; cancel: string }): Promise<boolean> {
  closeDialog();
  return new Promise((resolve) => {
    const before = document.activeElement as HTMLElement | null;
    const cancel = h('button', { type: 'button', id: 'confirm-cancel', onclick: () => close(false) }, opts.cancel);
    const ok = h('button', { type: 'button', class: 'primary', id: 'confirm-ok', onclick: () => close(true) }, opts.ok);
    const box = h('div', { class: 'confirm paper', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title' },
      h('h2', { id: 'confirm-title' }, opts.title), opts.body ? h('p', null, opts.body) : null, h('div', { class: 'actions' }, cancel, ok));
    const backdrop = h('div', { class: 'confirm-backdrop', onclick: (e: Event) => e.target === backdrop && close(false) }, box);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close(false);
    };
    function close(result: boolean) {
      if (open !== handle) return;
      open = null;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      before?.focus?.();
      resolve(result);
    }
    const handle = { close };
    open = handle;
    document.addEventListener('keydown', onKey, true);
    document.body.append(backdrop);
    cancel.focus();
  });
}
