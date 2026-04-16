import React, { useState, useMemo, useEffect, useRef } from 'react';

/**
 * Rough fuzzy-ish match.
 * Returns a score: 0 = no match, higher = better.
 * - Exact substring in label → high score, weighted by earliness
 * - All query chars appear in order (subsequence) → lower score
 * - Category matches also count but weight less
 */
function scoreMatch(query, label, category) {
  if (!query) return 1; // empty query shows everything
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  const c = (category || '').toLowerCase();

  if (l === q) return 1000;
  if (l.startsWith(q)) return 800 - l.length;
  const idx = l.indexOf(q);
  if (idx >= 0) return 500 - idx - l.length * 0.1;

  // Category substring match
  if (c && c.indexOf(q) >= 0) return 200;

  // Subsequence match — each char of q must appear in l in order
  let lastIndex = -1;
  let matched = 0;
  for (const ch of q) {
    const found = l.indexOf(ch, lastIndex + 1);
    if (found === -1) return 0;
    lastIndex = found;
    matched++;
  }
  if (matched === q.length) return 100 - l.length * 0.1;

  return 0;
}

function ShortcutKbd({ keys }) {
  if (!keys || keys.length === 0) return null;
  return (
    <span className="cmd-keys">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          <kbd>{k}</kbd>
          {i < keys.length - 1 && <span className="kbd-plus">+</span>}
        </React.Fragment>
      ))}
    </span>
  );
}

export default function CommandPalette({ commands, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    return commands
      .map((cmd) => ({ cmd, score: scoreMatch(query, cmd.label, cmd.category) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((x) => x.cmd);
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep selected item in view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const runCommand = (cmd) => {
    if (!cmd) return;
    onClose();
    // Defer so the close state updates before the action (avoids stale dom)
    setTimeout(() => cmd.handler(), 0);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="cmd-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd-modal">
        <div className="cmd-input-row">
          <span className="cmd-prompt">{'>'}</span>
          <input
            ref={inputRef}
            className="cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="cmd-empty">No matching commands</div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                data-index={idx}
                className={`cmd-item${idx === selectedIndex ? ' cmd-item-active' : ''}`}
                onClick={() => runCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="cmd-info">
                  {cmd.category && <span className="cmd-category">{cmd.category}:</span>}
                  <span className="cmd-label">{cmd.label}</span>
                </div>
                <ShortcutKbd keys={cmd.keys} />
              </div>
            ))
          )}
        </div>
        <div className="cmd-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
