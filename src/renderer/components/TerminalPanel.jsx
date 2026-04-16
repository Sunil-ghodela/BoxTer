import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default function TerminalPanel({ id }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const cleanupRef = useRef(null);

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

    // Fit after a short delay to let the container settle
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) { /* ignore */ }
    }, 100);

    // Create PTY process
    const cols = term.cols;
    const rows = term.rows;

    window.boxterAPI?.terminal.create(id, cols, rows).then(() => {
      // Send input to PTY
      term.onData((data) => {
        window.boxterAPI?.terminal.write(id, data);
      });

      // Receive output from PTY
      cleanupRef.current = window.boxterAPI?.terminal.onData((termId, data) => {
        if (termId === id && termRef.current) {
          termRef.current.write(data);
        }
      });
    });

    // Resize observer
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
      if (cleanupRef.current) cleanupRef.current();
      term.dispose();
      termRef.current = null;
    };
  }, [id]);

  return <div ref={containerRef} className="terminal-container" />;
}
