import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import Toolbar from './Toolbar.jsx';
import WorkspaceTabs from './WorkspaceTabs.jsx';
import PanelWrapper from './PanelWrapper.jsx';
import TerminalPanel from './TerminalPanel.jsx';
import BrowserPanel from './BrowserPanel.jsx';
import NotesPanel from './NotesPanel.jsx';
import SessionManager from './SessionManager.jsx';
import ShortcutHelp from './ShortcutHelp.jsx';
import CommandPalette from './CommandPalette.jsx';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts.js';
import 'react-grid-layout/css/styles.css';

const ResponsiveGrid = WidthProvider(Responsive);

let panelCounter = 0;
let workspaceCounter = 0;
const genPanelId = () => `panel-${++panelCounter}`;
const genWsId = () => `ws-${++workspaceCounter}`;

const PANEL_DEFAULTS = {
  terminal: { w: 4, h: 4, minW: 2, minH: 2 },
  browser:  { w: 5, h: 5, minW: 3, minH: 3 },
  notes:    { w: 3, h: 3, minW: 2, minH: 2 },
};

// Storage keys
const WORKSPACES_KEY = '__workspaces__';
const LEGACY_SESSION_KEY = '__last_session__';
const MAX_UNDO = 10;

const makeWorkspace = (name = 'Workspace 1') => ({
  id: genWsId(),
  name,
  panels: [],
  layouts: { lg: [] },
  focusedId: null,
  maximizedId: null,
});

export default function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const autoSaveTimer = useRef(null);
  // Undo stack — per workspace
  const closedStacks = useRef({}); // { [wsId]: [{panel, layout}, ...] }

  const activeWs = workspaces.find((w) => w.id === activeId) || null;

  // Restore on first mount
  useEffect(() => {
    (async () => {
      try {
        // Prefer new workspace-aware save
        const data = await window.boxterAPI?.session.load(WORKSPACES_KEY);
        if (data && Array.isArray(data.workspaces) && data.workspaces.length > 0) {
          const restored = data.workspaces.map((w) => ({
            id: w.id,
            name: w.name || 'Workspace',
            panels: w.panels || [],
            layouts: w.layouts || { lg: [] },
            focusedId: null,
            maximizedId: null,
          }));
          setWorkspaces(restored);
          setActiveId(data.activeId || restored[0].id);
          const allPanels = restored.flatMap((w) => w.panels);
          const maxPanel = allPanels.reduce((max, p) => {
            const n = parseInt((p.id || '').replace('panel-', ''), 10);
            return isNaN(n) ? max : Math.max(max, n);
          }, 0);
          panelCounter = maxPanel;
          const maxWs = restored.reduce((max, w) => {
            const n = parseInt((w.id || '').replace('ws-', ''), 10);
            return isNaN(n) ? max : Math.max(max, n);
          }, 0);
          workspaceCounter = maxWs;
        } else {
          // Migrate legacy single-session save if present
          const legacy = await window.boxterAPI?.session.load(LEGACY_SESSION_KEY);
          if (legacy && Array.isArray(legacy.panels) && legacy.panels.length > 0) {
            const ws = makeWorkspace('Workspace 1');
            ws.panels = legacy.panels;
            ws.layouts = legacy.layouts || { lg: [] };
            setWorkspaces([ws]);
            setActiveId(ws.id);
            const maxN = legacy.panels.reduce((m, p) => {
              const n = parseInt((p.id || '').replace('panel-', ''), 10);
              return isNaN(n) ? m : Math.max(m, n);
            }, 0);
            panelCounter = maxN;
          } else {
            const ws = makeWorkspace('Workspace 1');
            setWorkspaces([ws]);
            setActiveId(ws.id);
          }
        }
      } catch (e) {
        const ws = makeWorkspace('Workspace 1');
        setWorkspaces([ws]);
        setActiveId(ws.id);
      }
      setIsRestored(true);
    })();
  }, []);

  // Auto-save
  useEffect(() => {
    if (!isRestored) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const data = {
        workspaces: workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          panels: w.panels.map((p) => ({
            id: p.id, type: p.type, name: p.name, pinned: p.pinned,
          })),
          layouts: w.layouts,
        })),
        activeId,
      };
      window.boxterAPI?.session.save(WORKSPACES_KEY, data).catch(() => {});
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [workspaces, activeId, isRestored]);

  // Mutate the active workspace
  const updateActive = useCallback((mutator) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === activeId ? mutator(w) : w)));
  }, [activeId]);

  const addPanel = useCallback((type) => {
    if (!activeWs) return;
    const id = genPanelId();
    const defaults = PANEL_DEFAULTS[type];
    updateActive((w) => {
      const occupied = w.layouts.lg || [];
      const maxY = occupied.reduce((max, l) => Math.max(max, l.y + l.h), 0);
      return {
        ...w,
        panels: [...w.panels, { id, type }],
        layouts: {
          ...w.layouts,
          lg: [...occupied, { i: id, x: 0, y: maxY, ...defaults }],
        },
        focusedId: id,
      };
    });
  }, [activeWs, updateActive]);

  const removePanel = useCallback((id) => {
    if (!activeWs) return;
    let wasPinned = false;
    updateActive((w) => {
      const removed = w.panels.find((p) => p.id === id);
      if (removed?.pinned) { wasPinned = true; return w; }
      const removedLayout = (w.layouts.lg || []).find((l) => l.i === id);
      if (removed) {
        const stack = closedStacks.current[w.id] || [];
        stack.push({ panel: removed, layout: removedLayout });
        if (stack.length > MAX_UNDO) stack.shift();
        closedStacks.current[w.id] = stack;
      }
      return {
        ...w,
        panels: w.panels.filter((p) => p.id !== id),
        layouts: { ...w.layouts, lg: (w.layouts.lg || []).filter((l) => l.i !== id) },
        focusedId: w.focusedId === id ? null : w.focusedId,
        maximizedId: w.maximizedId === id ? null : w.maximizedId,
      };
    });
    if (wasPinned) return;
    if (window.boxterAPI?.terminal) {
      window.boxterAPI.terminal.kill(id);
    }
  }, [activeWs, updateActive]);

  const togglePin = useCallback((id) => {
    updateActive((w) => ({
      ...w,
      panels: w.panels.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)),
    }));
  }, [updateActive]);

  const undoCloseLastPanel = useCallback(() => {
    if (!activeWs) return;
    const stack = closedStacks.current[activeWs.id];
    if (!stack || stack.length === 0) return;
    const last = stack.pop();
    updateActive((w) => ({
      ...w,
      panels: [...w.panels, last.panel],
      layouts: last.layout
        ? { ...w.layouts, lg: [...(w.layouts.lg || []), last.layout] }
        : w.layouts,
      focusedId: last.panel.id,
    }));
  }, [activeWs, updateActive]);

  const focusPanel = useCallback((id) => {
    updateActive((w) => ({
      ...w,
      focusedId: id,
      // while maximized, focusing another panel swaps which panel is maximized
      maximizedId: w.maximizedId ? id : w.maximizedId,
    }));
  }, [updateActive]);

  const focusByIndex = useCallback((idx) => {
    if (!activeWs) return;
    const panel = activeWs.panels[idx];
    if (panel) focusPanel(panel.id);
  }, [activeWs, focusPanel]);

  const renamePanel = useCallback((id, newName) => {
    updateActive((w) => ({
      ...w,
      panels: w.panels.map((p) => (p.id === id ? { ...p, name: newName || undefined } : p)),
    }));
  }, [updateActive]);

  const toggleMaximize = useCallback((id) => {
    updateActive((w) => ({
      ...w,
      focusedId: id,
      maximizedId: w.maximizedId === id ? null : id,
    }));
  }, [updateActive]);

  const duplicatePanel = useCallback((id) => {
    if (!activeWs) return;
    const source = activeWs.panels.find((p) => p.id === id);
    if (!source) return;
    const sourceLayout = (activeWs.layouts.lg || []).find((l) => l.i === id);
    const newId = genPanelId();
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
      ? { i: newId, x: sourceLayout.x, y: sourceLayout.y + sourceLayout.h,
          w: sourceLayout.w, h: sourceLayout.h, minW: defaults.minW, minH: defaults.minH }
      : { i: newId, x: 0, y: Infinity, ...defaults };
    updateActive((w) => ({
      ...w,
      panels: [...w.panels, newPanel],
      layouts: { ...w.layouts, lg: [...(w.layouts.lg || []), newLayout] },
      focusedId: newId,
    }));
  }, [activeWs, updateActive]);

  const onLayoutChange = useCallback((wsId) => (layout, allLayouts) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? { ...w, layouts: allLayouts } : w)));
  }, []);

  // Workspace management
  const addWorkspace = useCallback(() => {
    const ws = makeWorkspace(`Workspace ${workspaces.length + 1}`);
    setWorkspaces((prev) => [...prev, ws]);
    setActiveId(ws.id);
  }, [workspaces.length]);

  const removeWorkspace = useCallback((wsId) => {
    setWorkspaces((prev) => {
      if (prev.length <= 1) return prev; // keep at least one
      const ws = prev.find((w) => w.id === wsId);
      // Kill all terminals in that workspace
      if (ws && window.boxterAPI?.terminal) {
        ws.panels.forEach((p) => {
          if (p.type === 'terminal') window.boxterAPI.terminal.kill(p.id);
        });
      }
      delete closedStacks.current[wsId];
      const next = prev.filter((w) => w.id !== wsId);
      return next;
    });
    setActiveId((cur) => {
      if (cur !== wsId) return cur;
      const remaining = workspaces.filter((w) => w.id !== wsId);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [workspaces]);

  const renameWorkspace = useCallback((wsId, newName) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? { ...w, name: newName || 'Workspace' } : w)));
  }, []);

  const switchWorkspace = useCallback((wsId) => setActiveId(wsId), []);

  const nextWorkspace = useCallback((direction) => {
    if (workspaces.length <= 1) return;
    const idx = workspaces.findIndex((w) => w.id === activeId);
    const nextIdx = (idx + direction + workspaces.length) % workspaces.length;
    setActiveId(workspaces[nextIdx].id);
  }, [workspaces, activeId]);

  // Sessions — now save/restore the full workspace collection
  const saveSession = useCallback(async (name) => {
    const data = {
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        panels: w.panels.map((p) => ({ id: p.id, type: p.type, name: p.name, pinned: p.pinned })),
        layouts: w.layouts,
      })),
      activeId,
    };
    await window.boxterAPI?.session.save(name, data);
  }, [workspaces, activeId]);

  const loadSession = useCallback(async (name) => {
    const data = await window.boxterAPI?.session.load(name);
    if (!data) return;
    // Kill all terminals in current workspaces
    workspaces.forEach((w) => {
      w.panels.forEach((p) => {
        if (p.type === 'terminal') window.boxterAPI?.terminal.kill(p.id);
      });
    });
    // Back-compat: if session is a single workspace format, wrap it
    let restored;
    if (Array.isArray(data.workspaces)) {
      restored = data.workspaces.map((w) => ({
        id: w.id || genWsId(),
        name: w.name || 'Workspace',
        panels: w.panels || [],
        layouts: w.layouts || { lg: [] },
        focusedId: null,
        maximizedId: null,
      }));
    } else if (Array.isArray(data.panels)) {
      const ws = makeWorkspace('Workspace 1');
      ws.panels = data.panels;
      ws.layouts = data.layouts || { lg: [] };
      restored = [ws];
    } else {
      return;
    }
    setWorkspaces(restored);
    setActiveId(data.activeId || restored[0].id);
    const maxN = restored.flatMap((w) => w.panels).reduce((m, p) => {
      const n = parseInt((p.id || '').replace('panel-', ''), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, panelCounter);
    panelCounter = maxN;
  }, [workspaces]);

  // Keyboard shortcuts
  const focusedId = activeWs?.focusedId || null;
  const maximizedId = activeWs?.maximizedId || null;

  const shortcuts = React.useMemo(() => [
    { key: 't', ctrl: true, handler: () => addPanel('terminal') },
    { key: 'b', ctrl: true, handler: () => addPanel('browser') },
    { key: 'e', ctrl: true, handler: () => addPanel('notes') },
    { key: 'w', ctrl: true, handler: () => { if (focusedId) removePanel(focusedId); } },
    { key: 'd', ctrl: true, handler: () => { if (focusedId) duplicatePanel(focusedId); } },
    { key: 'm', ctrl: true, handler: () => { if (focusedId) toggleMaximize(focusedId); } },
    { key: 'p', alt: true,  handler: () => { if (focusedId) togglePin(focusedId); } },
    { key: 't', ctrl: true, shift: true, handler: undoCloseLastPanel },
    { key: 'n', ctrl: true, shift: true, handler: addWorkspace },
    { key: 'Tab', ctrl: true,             handler: () => nextWorkspace(1) },
    { key: 'Tab', ctrl: true, shift: true, handler: () => nextWorkspace(-1) },
    { key: '/', ctrl: true, handler: () => setShowShortcutHelp((s) => !s) },
    { key: 'k', ctrl: true, handler: () => setShowCommandPalette((s) => !s) },
    { key: 's', ctrl: true, handler: () => setShowSessionManager(true) },
    { key: 'F2', handler: () => {
      if (!focusedId) return;
      const panel = document.querySelector('.workspace-active .panel-focused .panel-type');
      panel?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }},
    { key: 'Escape', ignoreInInputs: false, handler: () => {
      if (showCommandPalette) { setShowCommandPalette(false); return; }
      if (showShortcutHelp) { setShowShortcutHelp(false); return; }
      if (showSessionManager) { setShowSessionManager(false); return; }
      if (maximizedId) updateActive((w) => ({ ...w, maximizedId: null }));
    } },
    ...[1,2,3,4,5,6,7,8,9].map((n) => ({
      key: String(n), ctrl: true, handler: () => focusByIndex(n - 1),
    })),
    ...[1,2,3,4,5,6,7,8,9].map((n) => ({
      key: String(n), ctrl: true, alt: true, handler: () => {
        const ws = workspaces[n - 1];
        if (ws) setActiveId(ws.id);
      },
    })),
  ], [
    addPanel, removePanel, duplicatePanel, toggleMaximize, togglePin,
    undoCloseLastPanel, focusByIndex, addWorkspace, nextWorkspace,
    focusedId, maximizedId, showShortcutHelp, showSessionManager, showCommandPalette,
    workspaces, updateActive,
  ]);

  useKeyboardShortcuts(shortcuts);

  // Commands available in the palette (Ctrl+K).
  const commands = useMemo(() => {
    const focusedPanel = activeWs?.panels.find((p) => p.id === focusedId) || null;
    const list = [
      // Panels
      { id: 'new-terminal', category: 'Panel', label: 'New Terminal',
        keys: ['Ctrl', 'T'], handler: () => addPanel('terminal') },
      { id: 'new-browser',  category: 'Panel', label: 'New Browser',
        keys: ['Ctrl', 'B'], handler: () => addPanel('browser') },
      { id: 'new-notes',    category: 'Panel', label: 'New Notes',
        keys: ['Ctrl', 'E'], handler: () => addPanel('notes') },
    ];
    if (focusedPanel) {
      list.push(
        { id: 'close-focused', category: 'Panel',
          label: `Close "${focusedPanel.name || focusedPanel.type}"`,
          keys: ['Ctrl', 'W'], handler: () => removePanel(focusedPanel.id) },
        { id: 'dup-focused', category: 'Panel',
          label: `Duplicate "${focusedPanel.name || focusedPanel.type}"`,
          keys: ['Ctrl', 'D'], handler: () => duplicatePanel(focusedPanel.id) },
        { id: 'rename-focused', category: 'Panel',
          label: `Rename "${focusedPanel.name || focusedPanel.type}"`,
          keys: ['F2'], handler: () => {
            const el = document.querySelector('.workspace-active .panel-focused .panel-type');
            el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          }},
        { id: 'max-focused', category: 'Panel',
          label: maximizedId ? 'Restore panel' : 'Maximize panel',
          keys: ['Ctrl', 'M'], handler: () => toggleMaximize(focusedPanel.id) },
        { id: 'pin-focused', category: 'Panel',
          label: focusedPanel.pinned ? 'Unpin panel' : 'Pin panel',
          keys: ['Alt', 'P'], handler: () => togglePin(focusedPanel.id) },
      );
    }
    list.push(
      { id: 'undo-close', category: 'Panel',
        label: 'Reopen last closed panel',
        keys: ['Ctrl', 'Shift', 'T'], handler: undoCloseLastPanel },
    );
    // Workspaces
    list.push(
      { id: 'new-ws', category: 'Workspace', label: 'New workspace',
        keys: ['Ctrl', 'Shift', 'N'], handler: addWorkspace },
      { id: 'next-ws', category: 'Workspace', label: 'Next workspace',
        keys: ['Ctrl', 'Tab'], handler: () => nextWorkspace(1) },
      { id: 'prev-ws', category: 'Workspace', label: 'Previous workspace',
        keys: ['Ctrl', 'Shift', 'Tab'], handler: () => nextWorkspace(-1) },
    );
    workspaces.forEach((w) => {
      if (w.id === activeId) return;
      list.push({
        id: `switch-${w.id}`,
        category: 'Workspace',
        label: `Switch to "${w.name}"`,
        handler: () => switchWorkspace(w.id),
      });
    });
    if (activeWs) {
      list.push({
        id: 'rename-ws',
        category: 'Workspace',
        label: `Rename "${activeWs.name}"`,
        handler: () => {
          const el = document.querySelector('.ws-tab-active .ws-tab-name');
          el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        },
      });
      if (workspaces.length > 1) {
        list.push({
          id: 'close-ws',
          category: 'Workspace',
          label: `Close "${activeWs.name}"`,
          handler: () => removeWorkspace(activeWs.id),
        });
      }
    }
    // Sessions / help
    list.push(
      { id: 'open-sessions', category: 'Session',
        label: 'Open session manager',
        keys: ['Ctrl', 'S'], handler: () => setShowSessionManager(true) },
      { id: 'show-help', category: 'Help',
        label: 'Show keyboard shortcuts',
        keys: ['Ctrl', '/'], handler: () => setShowShortcutHelp(true) },
    );
    return list;
  }, [
    activeWs, activeId, focusedId, maximizedId, workspaces,
    addPanel, removePanel, duplicatePanel, toggleMaximize, togglePin,
    undoCloseLastPanel, addWorkspace, nextWorkspace, switchWorkspace, removeWorkspace,
  ]);

  const renderPanel = (panel) => {
    switch (panel.type) {
      case 'terminal': return <TerminalPanel id={panel.id} />;
      case 'browser':  return <BrowserPanel id={panel.id} />;
      case 'notes':    return <NotesPanel id={panel.id} />;
      default: return <div>Unknown panel type</div>;
    }
  };

  return (
    <div className="app">
      <Toolbar
        onAddPanel={addPanel}
        onToggleSessions={() => setShowSessionManager((s) => !s)}
        onShowShortcuts={() => setShowShortcutHelp(true)}
      />

      <WorkspaceTabs
        workspaces={workspaces}
        activeId={activeId}
        onSwitch={switchWorkspace}
        onAdd={addWorkspace}
        onClose={removeWorkspace}
        onRename={renameWorkspace}
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

      {showCommandPalette && (
        <CommandPalette
          commands={commands}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      <div className="workspace-stack">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`workspace${ws.id === activeId ? ' workspace-active' : ''}`}
          >
            {ws.panels.length === 0 ? (
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
                className={`layout${ws.maximizedId ? ' layout-has-maximized' : ''}`}
                layouts={ws.layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
                rowHeight={60}
                onLayoutChange={onLayoutChange(ws.id)}
                draggableHandle=".panel-header"
                draggableCancel=".panel-close,.no-drag,button,input,textarea,webview"
                resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
                compactType="vertical"
                margin={[6, 6]}
                isDraggable={!ws.maximizedId}
                isResizable={!ws.maximizedId}
              >
                {ws.panels.map((panel) => (
                  <div
                    key={panel.id}
                    className={panel.id === ws.maximizedId ? 'grid-item-maximized' : ''}
                  >
                    <PanelWrapper
                      id={panel.id}
                      type={panel.type}
                      name={panel.name}
                      isPinned={!!panel.pinned}
                      isFocused={panel.id === ws.focusedId}
                      isMaximized={panel.id === ws.maximizedId}
                      onFocus={() => ws.id === activeId && focusPanel(panel.id)}
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
        ))}
      </div>
    </div>
  );
}
