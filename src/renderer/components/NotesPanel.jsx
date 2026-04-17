import React, { useState, useCallback, useRef, useEffect } from 'react';

export default function NotesPanel({ id, onSendToTerminal }) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [flash, setFlash] = useState(null);
  const textareaRef = useRef(null);
  const flashTimerRef = useRef(null);

  const handleChange = useCallback((e) => {
    setContent(e.target.value);
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(`boxter-notes-${id}`, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { /* ignore */ }
  }, [id, content]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`boxter-notes-${id}`);
      if (stored) setContent(stored);
    } catch (e) { /* ignore */ }
  }, [id]);

  // Listen for piped-in text from a terminal (or any source)
  useEffect(() => {
    const onAppend = (e) => {
      const d = e.detail;
      if (!d || d.panelId !== id || !d.text) return;
      setContent((prev) => {
        const next = prev + d.text;
        try { localStorage.setItem(`boxter-notes-${id}`, next); } catch { /* ignore */ }
        return next;
      });
      // Keep scrolled to bottom so the stream is visible
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 0);
    };
    window.addEventListener('boxter:notes-append', onAppend);
    return () => window.removeEventListener('boxter:notes-append', onAppend);
  }, [id]);

  const showFlash = (message, kind = 'ok') => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash({ message, kind });
    flashTimerRef.current = setTimeout(() => setFlash(null), 1800);
  };

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const getSelectionOrLine = () => {
    const el = textareaRef.current;
    if (!el) return '';
    const { selectionStart, selectionEnd, value } = el;
    if (selectionStart !== selectionEnd) {
      return value.slice(selectionStart, selectionEnd);
    }
    // No selection: grab the current line at caret
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionStart);
    const lineStart = before.lastIndexOf('\n') + 1;
    const newlineIn = after.indexOf('\n');
    const lineEnd = newlineIn === -1 ? value.length : selectionStart + newlineIn;
    return value.slice(lineStart, lineEnd);
  };

  const sendToTerminal = useCallback((withExecute) => {
    if (!onSendToTerminal) {
      showFlash('No terminal in this workspace', 'err');
      return;
    }
    const text = getSelectionOrLine();
    if (!text.trim()) {
      showFlash('Nothing selected', 'err');
      return;
    }
    const result = onSendToTerminal(text, { execute: withExecute });
    if (!result || !result.ok) {
      showFlash(result?.reason || 'No terminal available', 'err');
      return;
    }
    const lines = text.split('\n').length;
    showFlash(
      `${withExecute ? 'Ran' : 'Pasted'} ${lines} line${lines === 1 ? '' : 's'} → ${result.terminalName}`,
      'ok',
    );
  }, [onSendToTerminal]);

  return (
    <div className="notes-panel">
      <div className="notes-toolbar">
        <button onClick={handleSave} className="notes-save-btn">
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button
          onClick={() => sendToTerminal(true)}
          className="notes-send-btn"
          title="Send selection (or current line) to terminal + Enter (Ctrl+Enter)"
          disabled={!onSendToTerminal}
        >
          → Run
        </button>
        <button
          onClick={() => sendToTerminal(false)}
          className="notes-send-btn notes-send-btn-paste"
          title="Paste selection to terminal, no Enter (Ctrl+Shift+Enter)"
          disabled={!onSendToTerminal}
        >
          → Paste
        </button>
        <span className="notes-hint">Ctrl+S save · Ctrl+Enter run</span>
        {flash && (
          <span className={`notes-flash notes-flash-${flash.kind}`}>{flash.message}</span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="notes-editor"
        value={content}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSave();
            return;
          }
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            sendToTerminal(!e.shiftKey);
            return;
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            const newContent = content.substring(0, start) + '  ' + content.substring(end);
            setContent(newContent);
            setTimeout(() => {
              e.target.selectionStart = e.target.selectionEnd = start + 2;
            }, 0);
          }
        }}
        placeholder="Type your notes here..."
        spellCheck={false}
      />
    </div>
  );
}
