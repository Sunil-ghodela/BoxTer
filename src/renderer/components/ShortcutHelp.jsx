import React from 'react';

const SHORTCUTS = [
  { group: 'Panels', items: [
    { keys: ['Ctrl', 'T'],        desc: 'New Terminal' },
    { keys: ['Ctrl', 'B'],        desc: 'New Browser' },
    { keys: ['Ctrl', 'E'],        desc: 'New Notes' },
    { keys: ['Ctrl', 'W'],        desc: 'Close focused panel' },
    { keys: ['Ctrl', 'Shift', 'T'], desc: 'Undo close (reopen)' },
  ]},
  { group: 'Navigation', items: [
    { keys: ['Ctrl', '1..9'],     desc: 'Focus panel by index' },
    { keys: ['Click'],            desc: 'Focus a panel' },
  ]},
  { group: 'Editing', items: [
    { keys: ['F2'],               desc: 'Rename focused panel' },
    { keys: ['Double-click'],     desc: 'Rename: click panel title' },
  ]},
  { group: 'Sessions', items: [
    { keys: ['Ctrl', 'S'],        desc: 'Open session manager' },
  ]},
  { group: 'Help', items: [
    { keys: ['Ctrl', '/'],        desc: 'Toggle this shortcut panel' },
    { keys: ['Esc'],              desc: 'Close modals' },
  ]},
];

export default function ShortcutHelp({ onClose }) {
  return (
    <div className="session-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="session-modal shortcut-modal">
        <div className="session-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="session-close" onClick={onClose}>x</button>
        </div>
        <div className="shortcut-body">
          {SHORTCUTS.map((section) => (
            <div key={section.group} className="shortcut-group">
              <h4 className="shortcut-group-title">{section.group}</h4>
              {section.items.map((s, i) => (
                <div key={i} className="shortcut-row">
                  <span className="shortcut-desc">{s.desc}</span>
                  <span className="shortcut-keys">
                    {s.keys.map((k, j) => (
                      <React.Fragment key={j}>
                        <kbd>{k}</kbd>
                        {j < s.keys.length - 1 && <span className="kbd-plus">+</span>}
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
