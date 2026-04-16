import React from 'react';

const PANEL_TYPES = [
  { type: 'terminal', label: 'Terminal', icon: '>' },
  { type: 'browser',  label: 'Browser',  icon: '@' },
  { type: 'notes',    label: 'Notes',    icon: '#' },
  { type: 'files',    label: 'Files',    icon: '+' },
];

export default function Toolbar({ onAddPanel, onToggleSessions, onShowShortcuts }) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="brand-icon">[B]</span>
        <span className="brand-name">BoxTer</span>
      </div>

      <div className="toolbar-actions">
        {PANEL_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            className="toolbar-btn"
            onClick={() => onAddPanel(type)}
            title={`Add ${label}`}
          >
            <span className="btn-icon">{icon}</span>
            <span className="btn-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <button
          className="toolbar-btn help-btn"
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (Ctrl+/)"
        >
          ?
        </button>
        <button className="toolbar-btn session-btn" onClick={onToggleSessions}>
          Sessions
        </button>
      </div>
    </div>
  );
}
