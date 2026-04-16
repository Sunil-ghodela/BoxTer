import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import Toolbar from './Toolbar.jsx';
import PanelWrapper from './PanelWrapper.jsx';
import TerminalPanel from './TerminalPanel.jsx';
import BrowserPanel from './BrowserPanel.jsx';
import NotesPanel from './NotesPanel.jsx';
import SessionManager from './SessionManager.jsx';
import ShortcutHelp from './ShortcutHelp.jsx';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts.js';
import 'react-grid-layout/css/styles.css';

const ResponsiveGrid = WidthProvider(Responsive);

let panelCounter = 0;
const genId = () => `panel-${++panelCounter}`;

const PANEL_DEFAULTS = {
  terminal: { w: 4, h: 4, minW: 2, minH: 2 },
  browser:  { w: 5, h: 5, minW: 3, minH: 3 },
  notes:    { w: 3, h: 3, minW: 2, minH: 2 },
};

const AUTO_SESSION = '__last_session__';
const MAX_UNDO = 10;

export default function App() {
  const [panels, setPanels] = useState([]);
  const [layouts, setLayouts] = useState({ lg: [] });
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [focusedId, setFocusedId] = useState(null);
  const [maximizedId, setMaximizedId] = useState(null);
  const [isRestored, setIsRestored] = useState(false);
  const autoSaveTimer = useRef(null);
  const closedStackRef = useRef([]); // stack of { panel, layout } for undo

  // Restore last session on first mount
  useEffect(() => {
    (async () => {
      try {
        const data = await window.boxterAPI?.session.load(AUTO_SESSION);
        if (data && Array.isArray(data.panels) && data.panels.length > 0) {
          setPanels(data.panels);
          setLayouts(data.layouts || { lg: [] });
          const maxNum = data.panels.reduce((max, p) => {
            const num = parseInt((p.id || '').replace('panel-', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          panelCounter = maxNum;
        }
      } catch (e) { /* ignore */ }
      setIsRestored(true);
    })();
  }, []);

  // Auto-save last session whenever panels or layouts change (debounced)
  useEffect(() => {
    if (!isRestored) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const data = {
        panels: panels.map((p) => ({ id: p.id, type: p.type, name: p.name, pinned: p.pinned })),
        layouts,
      };
      window.boxterAPI?.session.save(AUTO_SESSION, data).catch(() => {});
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [panels, layouts, isRestored]);

  const addPanel = useCallback((type) => {
    const id = genId();
    const defaults = PANEL_DEFAULTS[type];
    const occupied = layouts.lg || [];
    const maxY = occupied.reduce((max, l) => Math.max(max, l.y + l.h), 0);

    setPanels((prev) => [...prev, { id, type }]);
    setLayouts((prev) => ({
      ...prev,
      lg: [
        ...(prev.lg || []),
        { i: id, x: 0, y: maxY, ...defaults },
      ],
    }));
    setFocusedId(id);
  }, [layouts]);

  const removePanel = useCallback((id) => {
    let wasPinned = false;
    setPanels((prevPanels) => {
      const removed = prevPanels.find((p) => p.id === id);
      if (removed?.pinned) {
        wasPinned = true;
        return prevPanels; // refuse to remove pinned panels
      }
      setLayouts((prevLayouts) => {
        const removedLayout = (prevLayouts.lg || []).find((l) => l.i === id);
        if (removed) {
          closedStackRef.current.push({ panel: removed, layout: removedLayout });
          if (closedStackRef.current.length > MAX_UNDO) {
            closedStackRef.current.shift();
          }
        }
        return {
          ...prevLayouts,
          lg: (prevLayouts.lg || []).filter((l) => l.i !== id),
        };
      });
      return prevPanels.filter((p) => p.id !== id);
    });

    if (wasPinned) return;

    if (window.boxterAPI?.terminal) {
      window.boxterAPI.terminal.kill(id);
    }

    setFocusedId((cur) => (cur === id ? null : cur));
    setMaximizedId((cur) => (cur === id ? null : cur));
  }, []);

  const togglePin = useCallback((id) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
  }, []);

  const undoCloseLastPanel = useCallback(() => {
    const last = closedStackRef.current.pop();
    if (!last) return;
    const { panel, layout } = last;
    setPanels((prev) => [...prev, panel]);
    if (layout) {
      setLayouts((prev) => ({
        ...prev,
        lg: [...(prev.lg || []), layout],
      }));
    }
    setFocusedId(panel.id);
  }, []);

  const focusByIndex = useCallback((idx) => {
    const panel = panels[idx];
    if (!panel) return;
    setFocusedId(panel.id);
    setMaximizedId((cur) => (cur ? panel.id : cur));
  }, [panels]);

  const renamePanel = useCallback((id, newName) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName || undefined } : p)));
  }, []);

  const toggleMaximize = useCallback((id) => {
    setMaximizedId((cur) => (cur === id ? null : id));
    setFocusedId(id);
  }, []);

  const duplicatePanel = useCallback((id) => {
    const source = panels.find((p) => p.id === id);
    if (!source) return;
    const sourceLayout = (layouts.lg || []).find((l) => l.i === id);
    const newId = genId();

    // Clone type-specific state
    if (source.type === 'notes') {
      try {
        const content = localStorage.getItem(`boxter-notes-${id}`);
        if (content) localStorage.setItem(`boxter-notes-${newId}`, content);
      } catch (e) { /* ignore */ }
    }

    const newPanel = {
      id: newId,
      type: source.type,
      name: source.name ? `${source.name} (copy)` : undefined,
    };

    const defaults = PANEL_DEFAULTS[source.type];
    const newLayout = sourceLayout
      ? {
          i: newId,
          x: sourceLayout.x,
          y: sourceLayout.y + sourceLayout.h,
          w: sourceLayout.w,
          h: sourceLayout.h,
          minW: defaults.minW,
          minH: defaults.minH,
        }
      : { i: newId, x: 0, y: Infinity, ...defaults };

    setPanels((prev) => [...prev, newPanel]);
    setLayouts((prev) => ({
      ...prev,
      lg: [...(prev.lg || []), newLayout],
    }));
    setFocusedId(newId);
  }, [panels, layouts]);

  const onLayoutChange = useCallback((layout, allLayouts) => {
    setLayouts(allLayouts);
  }, []);

  // Session save/load
  const saveSession = useCallback(async (name) => {
    const sessionData = {
      panels: panels.map((p) => ({ id: p.id, type: p.type, name: p.name, pinned: p.pinned })),
      layouts,
    };
    await window.boxterAPI?.session.save(name, sessionData);
  }, [panels, layouts]);

  const loadSession = useCallback(async (name) => {
    const data = await window.boxterAPI?.session.load(name);
    if (!data) return;
    panels.forEach((p) => {
      if (p.type === 'terminal') window.boxterAPI?.terminal.kill(p.id);
    });
    setPanels(data.panels || []);
    setLayouts(data.layouts || { lg: [] });
    const maxNum = (data.panels || []).reduce((max, p) => {
      const num = parseInt(p.id.replace('panel-', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, panelCounter);
    panelCounter = maxNum;
    setFocusedId((data.panels && data.panels[0] && data.panels[0].id) || null);
  }, [panels]);

  // Keyboard shortcuts
  const shortcuts = React.useMemo(() => [
    { key: 't', ctrl: true, handler: () => addPanel('terminal') },
    { key: 'b', ctrl: true, handler: () => addPanel('browser') },
    { key: 'e', ctrl: true, handler: () => addPanel('notes') },
    { key: 'w', ctrl: true, handler: () => { if (focusedId) removePanel(focusedId); } },
    { key: 'd', ctrl: true, handler: () => { if (focusedId) duplicatePanel(focusedId); } },
    { key: 'm', ctrl: true, handler: () => { if (focusedId) toggleMaximize(focusedId); } },
    { key: 'p', alt: true,  handler: () => { if (focusedId) togglePin(focusedId); } },
    { key: 't', ctrl: true, shift: true, handler: undoCloseLastPanel },
    { key: '?', ctrl: true, shift: true, handler: () => setShowShortcutHelp((s) => !s) },
    { key: '/', ctrl: true, handler: () => setShowShortcutHelp((s) => !s) },
    { key: 's', ctrl: true, handler: () => setShowSessionManager(true) },
    { key: 'F2', handler: () => {
      if (!focusedId) return;
      const panel = document.querySelector(`.panel-focused .panel-type`);
      // Dispatch a dblclick to trigger the existing rename flow
      panel?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }},
    { key: 'Escape', ignoreInInputs: false, handler: () => {
      if (showShortcutHelp) { setShowShortcutHelp(false); return; }
      if (showSessionManager) { setShowSessionManager(false); return; }
      if (maximizedId) { setMaximizedId(null); return; }
    } },
    ...[1,2,3,4,5,6,7,8,9].map((n) => ({
      key: String(n), ctrl: true, handler: () => focusByIndex(n - 1),
    })),
  ], [addPanel, removePanel, duplicatePanel, toggleMaximize, togglePin, undoCloseLastPanel, focusedId, focusByIndex, maximizedId, showShortcutHelp, showSessionManager]);

  useKeyboardShortcuts(shortcuts);

  const renderPanel = (panel) => {
    switch (panel.type) {
      case 'terminal':
        return <TerminalPanel id={panel.id} />;
      case 'browser':
        return <BrowserPanel id={panel.id} />;
      case 'notes':
        return <NotesPanel id={panel.id} />;
      default:
        return <div>Unknown panel type</div>;
    }
  };

  return (
    <div className="app">
      <Toolbar
        onAddPanel={addPanel}
        onToggleSessions={() => setShowSessionManager((s) => !s)}
        onShowShortcuts={() => setShowShortcutHelp(true)}
      />

      {showSessionManager && (
        <SessionManager
          onSave={saveSession}
          onLoad={loadSession}
          onClose={() => setShowSessionManager(false)}
        />
      )}

      {showShortcutHelp && (
        <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />
      )}

      <div className="grid-container">
        {panels.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">+</div>
            <h2>Welcome to BoxTer</h2>
            <p>Add a panel from the toolbar to get started.</p>
            <div className="empty-actions">
              <button onClick={() => addPanel('terminal')}>Open Terminal</button>
              <button onClick={() => addPanel('browser')}>Open Browser</button>
              <button onClick={() => addPanel('notes')}>Open Notes</button>
            </div>
            <p className="empty-tip">
              Tip: press <kbd>Ctrl</kbd>+<kbd>/</kbd> to see all shortcuts
            </p>
          </div>
        ) : (
          <ResponsiveGrid
            className={`layout${maximizedId ? ' layout-has-maximized' : ''}`}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
            rowHeight={60}
            onLayoutChange={onLayoutChange}
            draggableHandle=".panel-header"
            draggableCancel=".panel-close,.no-drag,button,input,textarea,webview"
            resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
            compactType="vertical"
            margin={[6, 6]}
            isDraggable={!maximizedId}
            isResizable={!maximizedId}
          >
            {panels.map((panel) => (
              <div
                key={panel.id}
                className={panel.id === maximizedId ? 'grid-item-maximized' : ''}
              >
                <PanelWrapper
                  id={panel.id}
                  type={panel.type}
                  name={panel.name}
                  isPinned={!!panel.pinned}
                  isFocused={panel.id === focusedId}
                  isMaximized={panel.id === maximizedId}
                  onFocus={() => setFocusedId(panel.id)}
                  onRemove={removePanel}
                  onRename={renamePanel}
                  onDuplicate={duplicatePanel}
                  onToggleMaximize={toggleMaximize}
                  onTogglePin={togglePin}
                >
                  {renderPanel(panel)}
                </PanelWrapper>
              </div>
            ))}
          </ResponsiveGrid>
        )}
      </div>
    </div>
  );
}
