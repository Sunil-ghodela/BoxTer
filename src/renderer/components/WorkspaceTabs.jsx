import React, { useState, useRef, useEffect } from 'react';

function Tab({ ws, isActive, canClose, onSwitch, onClose, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ws.name);
  const inputRef = useRef(null);

  useEffect(() => setDraft(ws.name), [ws.name]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const v = draft.trim();
    onRename(ws.id, v || ws.name);
    setEditing(false);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setEditing(true);
  };

  return (
    <div
      className={`ws-tab${isActive ? ' ws-tab-active' : ''}`}
      onClick={() => onSwitch(ws.id)}
      onDoubleClick={handleDoubleClick}
      title={`${ws.name} — double-click to rename`}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="ws-tab-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(ws.name); setEditing(false); }
          }}
          maxLength={30}
        />
      ) : (
        <>
          <span className="ws-tab-name">{ws.name}</span>
          {ws.panels.length > 0 && (
            <span className="ws-tab-count">{ws.panels.length}</span>
          )}
        </>
      )}
      {canClose && !editing && (
        <button
          className="ws-tab-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose(ws.id);
          }}
          title="Close workspace"
        >
          x
        </button>
      )}
    </div>
  );
}

export default function WorkspaceTabs({
  workspaces,
  activeId,
  onSwitch,
  onAdd,
  onClose,
  onRename,
}) {
  if (!workspaces || workspaces.length === 0) return null;

  const canClose = workspaces.length > 1;

  return (
    <div className="ws-tabs">
      <div className="ws-tabs-list">
        {workspaces.map((ws) => (
          <Tab
            key={ws.id}
            ws={ws}
            isActive={ws.id === activeId}
            canClose={canClose}
            onSwitch={onSwitch}
            onClose={onClose}
            onRename={onRename}
          />
        ))}
      </div>
      <button
        className="ws-tab-add"
        onClick={onAdd}
        title="New workspace (Ctrl+Shift+N)"
      >
        +
      </button>
    </div>
  );
}
