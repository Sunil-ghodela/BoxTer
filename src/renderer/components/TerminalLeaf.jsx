import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { stripAnsi } from '../utils/ansi.js';

const shellQuote = (p) => {
  if (!p) return '';
  return `'${p.replace(/'/g, "'\\''")}' `;
};

export default function TerminalLeaf({
  id,
  isFocused,
  onFocus,
  onSplitH,
  onSplitV,
  onClosePane,
  pipeToNotes,
  pipeLabel,
}) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const cleanupRef = useRef(null);
  const pipeRef = useRef(pipeToNotes);
  const [dropActive, setDropActive] = useState(false);

  useEffect(() => { pipeRef.current = pipeToNotes; }, [pipeToNotes]);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#00d4ff',
        selectionBackground: '#3a3a5c',
        black: '#1a1a2e',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#e0e0e0',
      },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const mod = e.ctrlKey || e.metaKey;

      // Split shortcuts (Alt+Shift+D/S/W)
      if (e.altKey && e.shiftKey) {
        if (e.key === 'D' || e.key === 'd') {
          onSplitH?.();
          return false;
        }
        if (e.key === 'S' || e.key === 's') {
          onSplitV?.();
          return false;
        }
        if (e.key === 'W' || e.key === 'w') {
          onClosePane?.();
          return false;
        }
      }

      // Clipboard
      if (mod && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        const sel = term.getSelection();
        if (sel) { navigator.clipboard.writeText(sel).catch(() => {}); return false; }
      }
      if (mod && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        navigator.clipboard.readText().then((txt) => {
          if (txt) window.boxterAPI?.terminal.write(id, txt);
        }).catch(() => {});
        return false;
      }
      if (e.shiftKey && e.key === 'Insert') {
        navigator.clipboard.readText().then((txt) => {
          if (txt) window.boxterAPI?.terminal.write(id, txt);
        }).catch(() => {});
        return false;
      }
      return true;
    });

    const onContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).then(() => term.clearSelection()).catch(() => {});
      } else {
        navigator.clipboard.readText().then((txt) => {
          if (txt) window.boxterAPI?.terminal.write(id, txt);
        }).catch(() => {});
      }
    };
    const containerEl = containerRef.current;
    containerEl.addEventListener('contextmenu', onContextMenu);

    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) { /* ignore */ }
    }, 100);

    const cols = term.cols;
    const rows = term.rows;

    window.boxterAPI?.terminal.create(id, cols, rows).then(() => {
      term.onData((data) => {
        window.boxterAPI?.terminal.write(id, data);
      });

      cleanupRef.current = window.boxterAPI?.terminal.onData((termId, data) => {
        if (termId !== id) return;
        if (termRef.current) termRef.current.write(data);
        const target = pipeRef.current;
        if (target) {
          const clean = stripAnsi(data);
          if (clean) {
            window.dispatchEvent(new CustomEvent('boxter:notes-append', {
              detail: { panelId: target, text: clean, source: id },
            }));
          }
        }
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fitRef.current && termRef.current) {
          fitRef.current.fit();
          const { cols, rows } = termRef.current;
          window.boxterAPI?.terminal.resize(id, cols, rows);
        }
      } catch (e) { /* ignore */ }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      containerEl.removeEventListener('contextmenu', onContextMenu);
      if (cleanupRef.current) cleanupRef.current();
      try { window.boxterAPI?.terminal?.kill(id); } catch { /* ignore */ }
      term.dispose();
      termRef.current = null;
    };
  }, [id]);

  const onDragOver = (e) => {
    if (!e.dataTransfer) return;
    const types = e.dataTransfer.types;
    if (types && (Array.from(types).includes('application/x-boxter-file-path') ||
                  Array.from(types).includes('Files') ||
                  Array.from(types).includes('text/plain'))) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setDropActive(true);
    }
  };

  const onDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropActive(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    let payload = '';
    const boxterPath = dt.getData('application/x-boxter-file-path');
    if (boxterPath) {
      payload = shellQuote(boxterPath);
    } else if (dt.files && dt.files.length) {
      const resolver = window.boxterAPI?.files?.pathForFile;
      const paths = [];
      for (const f of Array.from(dt.files)) {
        const p = resolver ? resolver(f) : '';
        if (p) paths.push(p);
      }
      if (paths.length) payload = paths.map(shellQuote).join('');
    } else {
      const txt = dt.getData('text/plain');
      if (txt) payload = txt;
    }
    if (payload) {
      window.boxterAPI?.terminal?.write(id, payload);
      termRef.current?.focus();
      onFocus?.();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`terminal-leaf${isFocused ? ' terminal-leaf-focused' : ''}${dropActive ? ' terminal-drop-active' : ''}`}
      onMouseDown={() => onFocus?.()}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {pipeLabel && (
        <div className="terminal-pipe-badge" title={`Output is being piped to "${pipeLabel}"`}>
          ↘ piping to {pipeLabel}
        </div>
      )}
      {dropActive && (
        <div className="terminal-drop-overlay">
          <div>Drop to paste path</div>
        </div>
      )}
    </div>
  );
}
