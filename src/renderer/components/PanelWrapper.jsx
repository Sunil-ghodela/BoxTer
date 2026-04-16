import React from 'react';

const TYPE_LABELS = {
  terminal: '> Terminal',
  browser: '@ Browser',
  notes: '# Notes',
};

export default function PanelWrapper({ id, type, isFocused, onFocus, onRemove, children }) {
  return (
    <div
      className={`panel panel-${type}${isFocused ? ' panel-focused' : ''}`}
      onMouseDown={onFocus}
      onFocus={onFocus}
    >
      <div className="panel-header">
        <span className="panel-type">{TYPE_LABELS[type] || type}</span>
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
      <div className="panel-body">{children}</div>
    </div>
  );
}
