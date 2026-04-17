import React, { useState } from 'react';
import { TEMPLATES } from '../utils/templates.js';

const TYPE_COLORS = {
  terminal: '#50fa7b',
  browser:  '#ff79c6',
  notes:    '#f1fa8c',
  files:    '#8be9fd',
};

const TYPE_ICONS = {
  terminal: '>',
  browser:  '@',
  notes:    '#',
  files:    '+',
};

export default function TemplatePicker({ onPick, onClose }) {
  const [selected, setSelected] = useState(TEMPLATES[0]?.id || null);
  const activeTemplate = TEMPLATES.find((t) => t.id === selected);

  return (
    <div className="tp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tp-modal">
        <div className="tp-header">
          <h3>Start from a template</h3>
          <button className="session-close" onClick={onClose}>x</button>
        </div>

        <div className="tp-body">
          <div className="tp-grid">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className={`tp-card${selected === t.id ? ' tp-card-active' : ''}`}
                onClick={() => setSelected(t.id)}
                onDoubleClick={() => onPick(t.id)}
              >
                <div className="tp-card-head">
                  <span
                    className="tp-card-icon"
                    style={{ color: t.accent, borderColor: t.accent }}
                  >
                    {t.icon}
                  </span>
                  <span className="tp-card-name">{t.name}</span>
                </div>
                <div className="tp-card-preview">
                  {t.panels.map((p, i) => (
                    <span
                      key={i}
                      className="tp-dot"
                      style={{ background: TYPE_COLORS[p.type] }}
                      title={`${p.type}${p.name ? ` (${p.name})` : ''}`}
                    >
                      {TYPE_ICONS[p.type]}
                    </span>
                  ))}
                </div>
                <div className="tp-card-desc">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="tp-footer">
          <div className="tp-footer-hint">
            {activeTemplate
              ? `${activeTemplate.panels.length} panels`
              : 'Pick a template'}
          </div>
          <div className="tp-footer-actions">
            <button className="tp-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="tp-btn-primary"
              onClick={() => selected && onPick(selected)}
              disabled={!selected}
            >
              Create workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
