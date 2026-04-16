import React, { useState, useEffect, useCallback } from 'react';

export default function SessionManager({ onSave, onLoad, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [newName, setNewName] = useState('');

  const refreshSessions = useCallback(async () => {
    const list = await window.boxterAPI?.session.list();
    setSessions(list || []);
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
                    {new Date(s.savedAt).toLocaleDateString()}
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
