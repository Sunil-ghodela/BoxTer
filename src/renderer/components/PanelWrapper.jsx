import React, { useState, useRef, useEffect } from 'react';

const TYPE_LABELS = {
  terminal: '> Terminal',
  browser: '@ Browser',
  notes: '# Notes',
};

const TYPE_ICONS = {
  terminal: '>',
  browser: '@',
  notes: '#',
};

export default function PanelWrapper({
  id,
  type,
  name,
  isFocused,
  onFocus,
  onRemove,
  onRename,
  onDuplicate,
  children,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(name || '');
  }, [name]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = (e) => {
    e.stopPropagation();
    setDraft(name || '');
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    onRename?.(id, trimmed || null); // null clears custom name → falls back to default
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name || '');
    setEditing(false);
  };

  const displayName = name ? name : TYPE_LABELS[type] || type;
  const iconPrefix = name ? `${TYPE_ICONS[type] || ''} ` : '';

  return (
    <div
      className={`panel panel-${type}${isFocused ? ' panel-focused' : ''}`}
      onMouseDown={onFocus}
      onFocus={onFocus}
    >
      <div className="panel-header">
        {editing ? (
          <input
            ref={inputRef}
            className="panel-name-input no-drag"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            maxLength={40}
            placeholder={TYPE_LABELS[type] || type}
          />
        ) : (
          <span
            className="panel-type"
            onDoubleClick={startEditing}
            title="Double-click to rename"
          >
            {iconPrefix}{displayName}
          </span>
        )}
        <div className="panel-header-actions">
          <button
            className="panel-icon-btn no-drag"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              startEditing(e);
            }}
            title="Rename panel (F2)"
          >
            r
          </button>
          {onDuplicate && (
            <button
              className="panel-icon-btn no-drag"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDuplicate(id);
              }}
              title="Duplicate panel (Ctrl+D)"
            >
              d
            </button>
          )}
          <button
            className="panel-close no-drag"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove(id);
            }}
            title="Close panel (Ctrl+W)"
          >
            x
          </button>
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}
