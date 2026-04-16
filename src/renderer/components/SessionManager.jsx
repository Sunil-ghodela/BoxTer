import React, { useState, useEffect, useCallback } from 'react';

const INTERNAL_PREFIX = '__';

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hr ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function SessionManager({ onSave, onLoad, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [newName, setNewName] = useState('');

  const refreshSessions = useCallback(async () => {
    const list = await window.boxterAPI?.session.list();
    // Filter out internal sessions (like __last_session__) and sort newest first
    const filtered = (list || [])
      .filter((s) => !s.name.startsWith(INTERNAL_PREFIX))
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    setSessions(filtered);
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const handleSave = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await onSave(name);
    setNewName('');
    refreshSessions();
  };

  const handleLoad = async (name) => {
    await onLoad(name);
    onClose();
  };

  const handleDelete = async (name) => {
    await window.boxterAPI?.session.delete(name);
    refreshSessions();
  };

  return (
    <div className="session-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="session-modal">
        <div className="session-header">
          <h3>Sessions</h3>
          <button className="session-close" onClick={onClose}>x</button>
        </div>

        <form className="session-save-form" onSubmit={handleSave}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Session name..."
            className="session-input"
          />
          <button type="submit" className="session-save-btn">Save Current</button>
        </form>

        <div className="session-list">
          {sessions.length === 0 ? (
            <div className="session-empty">No saved sessions yet.</div>
          ) : (
            sessions.map((s) => (
              <div key={s.name} className="session-item">
                <div className="session-info">
                  <span className="session-name">{s.name}</span>
                  <span className="session-date">
                    {relativeTime(s.savedAt)}
                  </span>
                </div>
                <div className="session-actions">
                  <button onClick={() => handleLoad(s.name)} className="btn-load">Load</button>
                  <button onClick={() => handleDelete(s.name)} className="btn-delete">Del</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
