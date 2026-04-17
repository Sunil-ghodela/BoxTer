import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchIndex, searchIndex } from '../utils/searchIndex.js';

const CATEGORY_ICONS = {
  Workspace: 'W',
  Panel:     'P',
  Notes:     '#',
  File:      'F',
  URL:       '@',
};

function highlightMatch(text, query) {
  if (!text || !query) return text;
  const lower = text.toLowerCase();
  const i = lower.indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="gs-match">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export default function GlobalSearch({ workspaces, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await buildSearchIndex(workspaces);
        if (!cancelled) {
          setIndex(items);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaces]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => searchIndex(index, query), [index, query]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector('.gs-result-active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const choose = (item) => {
    if (!item) return;
    onNavigate({ workspaceId: item.workspaceId, panelId: item.panelId });
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[selected]);
    }
  };

  return (
    <div className="gs-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gs-modal" onKeyDown={onKeyDown}>
        <div className="gs-input-row">
          <span className="gs-prompt">?</span>
          <input
            ref={inputRef}
            className="gs-input"
            placeholder="Search workspaces, panels, notes, files, URLs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="gs-count">{results.length}</span>
        </div>

        <div className="gs-results" ref={listRef}>
          {loading ? (
            <div className="gs-empty">Building index…</div>
          ) : results.length === 0 ? (
            <div className="gs-empty">
              {query ? 'No matches' : 'Start typing to search across all workspaces'}
            </div>
          ) : (
            results.map((item, i) => (
              <div
                key={item.id}
                className={`gs-result${i === selected ? ' gs-result-active' : ''}`}
                onClick={() => choose(item)}
                onMouseEnter={() => setSelected(i)}
              >
                <span className={`gs-icon gs-cat-${item.category.toLowerCase()}`}>
                  {CATEGORY_ICONS[item.category] || '·'}
                </span>
                <div className="gs-result-body">
                  <div className="gs-result-title">
                    {highlightMatch(item.title, query)}
                  </div>
                  {item.snippet ? (
                    <div className="gs-result-snippet">
                      {highlightMatch(item.snippet, query)}
                    </div>
                  ) : (
                    <div className="gs-result-sub">{item.subtitle}</div>
                  )}
                </div>
                <span className="gs-cat-label">{item.category}</span>
              </div>
            ))
          )}
        </div>

        <div className="gs-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
