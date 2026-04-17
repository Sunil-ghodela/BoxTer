import React from 'react';

const SHORTCUTS = [
  { group: 'Panels', items: [
    { keys: ['Ctrl', 'T'],        desc: 'New Terminal' },
    { keys: ['Ctrl', 'B'],        desc: 'New Browser' },
    { keys: ['Ctrl', 'E'],        desc: 'New Notes' },
    { keys: ['Ctrl', 'Shift', 'F'], desc: 'New Files (drop-zone)' },
    { keys: ['Ctrl', 'W'],        desc: 'Close focused panel' },
    { keys: ['Ctrl', 'Shift', 'T'], desc: 'Undo close (reopen)' },
    { keys: ['Ctrl', 'D'],        desc: 'Duplicate focused panel' },
    { keys: ['Ctrl', 'M'],        desc: 'Maximize / restore focused panel' },
    { keys: ['Alt', 'P'],         desc: 'Pin / unpin focused panel' },
  ]},
  { group: 'Navigation', items: [
    { keys: ['Ctrl', '1..9'],     desc: 'Focus panel by index' },
    { keys: ['Click'],            desc: 'Focus a panel' },
  ]},
  { group: 'Workspaces', items: [
    { keys: ['Ctrl', 'Shift', 'N'], desc: 'New empty workspace' },
    { keys: ['Ctrl', 'Alt', 'N'],   desc: 'New workspace from template' },
    { keys: ['Ctrl', 'Tab'],        desc: 'Next workspace' },
    { keys: ['Ctrl', 'Shift', 'Tab'], desc: 'Previous workspace' },
    { keys: ['Ctrl', 'Alt', '1..9'], desc: 'Switch to nth workspace' },
  ]},
  { group: 'Editing', items: [
    { keys: ['F2'],               desc: 'Rename focused panel' },
    { keys: ['Double-click'],     desc: 'On title: rename / On header: maximize' },
  ]},
  { group: 'Sessions', items: [
    { keys: ['Ctrl', 'S'],        desc: 'Open session manager' },
  ]},
  { group: 'Appearance', items: [
    { keys: ['Alt', 'T'],         desc: 'Cycle theme (Dark / Light / Cyberpunk / Solarized / Dracula)' },
    { keys: ['Alt', 'B'],         desc: 'Toggle status banner' },
    { keys: ['Alt', 'H'],         desc: 'Toggle activity timeline (bottom)' },
  ]},
  { group: 'Canvas view', items: [
    { keys: ['Alt', 'V'],         desc: 'Toggle Grid / Canvas view' },
    { keys: ['Click panel'],      desc: 'Focus panel (auto-zoom in if zoomed out)' },
    { keys: ['Alt', 'Z'],         desc: 'Zoom to focused panel' },
    { keys: ['Mouse wheel'],      desc: 'Zoom in / out (anchored to pointer)' },
    { keys: ['Click-drag'],       desc: 'Pan on empty canvas area' },
    { keys: ['Ctrl', '0'],        desc: 'Fit all panels to view' },
    { keys: ['Ctrl', '1'],        desc: 'Reset to 100% zoom' },
    { keys: ['+ / -'],            desc: 'Zoom in / out' },
  ]},
  { group: 'Search', items: [
    { keys: ['Ctrl', 'P'],        desc: 'Global search (notes content, files, URLs, panels)' },
  ]},
  { group: 'Help', items: [
    { keys: ['Ctrl', 'K'],        desc: 'Command palette (search all actions)' },
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
