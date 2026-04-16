import { useEffect } from 'react';

/**
 * useKeyboardShortcuts — binds global keyboard shortcuts to handlers.
 *
 * shortcuts: array of { key, ctrl, shift, alt, meta, handler, ignoreInInputs? }
 * key is compared case-insensitively.
 * By default, shortcuts are skipped when typing inside an input/textarea/contenteditable.
 */
export default function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const isEditableTarget = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      // xterm terminals eat their own keys — skip those
      if (el.closest && el.closest('.xterm')) return true;
      return false;
    };

    const handler = (e) => {
      for (const s of shortcuts) {
        const keyMatch = (s.key || '').toLowerCase() === (e.key || '').toLowerCase();
        if (!keyMatch) continue;
        if (!!s.ctrl !== (e.ctrlKey || e.metaKey)) continue;
        if (!!s.shift !== e.shiftKey) continue;
        if (!!s.alt !== e.altKey) continue;
        if (s.ignoreInInputs !== false && isEditableTarget(e.target)) continue;
        e.preventDefault();
        e.stopPropagation();
        s.handler(e);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
