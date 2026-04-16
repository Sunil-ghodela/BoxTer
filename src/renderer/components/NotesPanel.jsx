import React, { useState, useCallback } from 'react';

export default function NotesPanel({ id }) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

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

  // Load saved content on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`boxter-notes-${id}`);
      if (saved) setContent(saved);
    } catch (e) { /* ignore */ }
  }, [id]);

  return (
    <div className="notes-panel">
      <div className="notes-toolbar">
        <button onClick={handleSave} className="notes-save-btn">
          {saved ? 'Saved!' : 'Save'}
        </button>
        <span className="notes-hint">Ctrl+S to save</span>
      </div>
      <textarea
        className="notes-editor"
        value={content}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSave();
          }
          // Allow tab
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
