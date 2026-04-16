import React from 'react';

const TYPE_LABELS = {
  terminal: '> Terminal',
  browser: '@ Browser',
  notes: '# Notes',
};

export default function PanelWrapper({ id, type, onRemove, children }) {
  return (
    <div className={`panel panel-${type}`}>
      <div className="panel-header">
        <span className="panel-type">{TYPE_LABELS[type] || type}</span>
        <button
          className="panel-close"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          title="Close panel"
        >
          x
        </button>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}
