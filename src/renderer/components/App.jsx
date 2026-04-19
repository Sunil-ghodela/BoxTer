import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import Toolbar from './Toolbar.jsx';
import WorkspaceTabs from './WorkspaceTabs.jsx';
import PanelWrapper from './PanelWrapper.jsx';
import TerminalPanel from './TerminalPanel.jsx';
import BrowserPanel from './BrowserPanel.jsx';
import NotesPanel from './NotesPanel.jsx';
import FilesPanel from './FilesPanel.jsx';
import SessionManager from './SessionManager.jsx';
import ShortcutHelp from './ShortcutHelp.jsx';
import CommandPalette from './CommandPalette.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import ActivityTimeline from './ActivityTimeline.jsx';
import TemplatePicker from './TemplatePicker.jsx';
import { getTemplate, TEMPLATES } from '../utils/templates.js';
import { logActivity } from '../utils/activityLog.js';
import { allLeaves, regenerateLeafIds, firstLeafId as firstLeaf } from '../utils/terminalTree.js';
import UpdateBanner from './UpdateBanner.jsx';
import StatusBanner from './StatusBanner.jsx';
import CanvasView from './CanvasView.jsx';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts.js';
import useTheme, { THEMES } from '../hooks/useTheme.js';
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
  files:    { w: 4, h: 4, minW: 2, minH: 2 },
};

// Pixel sizes for Canvas mode
const CANVAS_PANEL_DEFAULTS = {
  terminal: { w: 420, h: 300 },
  browser:  { w: 360, h: 240 },
  notes:    { w: 340, h: 260 },
  files:    { w: 380, h: 300 },
};
const CANVAS_GRID_PX = 90;     // 1 grid col ≈ 90px for initial port from grid layout
const CANVAS_GRID_ROW_PX = 50; // 1 grid row ≈ 50px

const gridToCanvasRect = (gl) => ({
  x: (gl.x || 0) * CANVAS_GRID_PX,
  y: (gl.y || 0) * CANVAS_GRID_ROW_PX,
  w: Math.max(240, (gl.w || 4) * CANVAS_GRID_PX),
  h: Math.max(180, (gl.h || 4) * CANVAS_GRID_ROW_PX),
});

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
  viewMode: 'grid',
  canvasLayout: {},
  canvasView: { scale: 1, tx: 0, ty: 0 },
});

export default function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showActivity, setShowActivity] = useState(() => {
    try { return localStorage.getItem('boxter-activity-open') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('boxter-activity-open', showActivity ? '1' : '0'); } catch { /* ignore */ }
  }, [showActivity]);
  const toggleActivity = useCallback(() => setShowActivity((s) => !s), []);
  const [isRestored, setIsRestored] = useState(false);
  const autoSaveTimer = useRef(null);
  // Undo stack — per workspace
  const closedStacks = useRef({}); // { [wsId]: [{panel, layout}, ...] }

  const activeWs = workspaces.find((w) => w.id === activeId) || null;

  const { theme, cycleTheme: cycleThemeRaw } = useTheme();
  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];
  const cycleTheme = useCallback(() => {
    cycleThemeRaw();
    const idx = THEMES.findIndex((t) => t.id === theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    logActivity({ category: 'ui', title: `Theme → ${next.label}` });
  }, [cycleThemeRaw, theme]);

  const [showStatusBanner, setShowStatusBanner] = useState(() => {
    try {
      const saved = localStorage.getItem('boxter-status-banner');
      return saved === null ? true : saved === '1';
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('boxter-status-banner', showStatusBanner ? '1' : '0'); } catch { /* ignore */ }
  }, [showStatusBanner]);
  const toggleStatusBanner = useCallback(() => setShowStatusBanner((s) => !s), []);

  const nextCanvasSpot = useCallback((canvasLayout, panels) => {
    let maxBottom = 0;
    let maxRight = 0;
    panels.forEach((p) => {
      const r = canvasLayout[p.id];
      if (!r) return;
      maxBottom = Math.max(maxBottom, r.y + r.h);
      maxRight = Math.max(maxRight, r.x + r.w);
    });
    return { x: 20 + (maxRight > 1400 ? 20 : maxRight), y: maxBottom > 0 && maxRight > 1400 ? maxBottom + 20 : 20 };
  }, []);

  const switchViewMode = useCallback((wsId, mode) => {
    setWorkspaces((prev) => prev.map((w) => {
      if (w.id !== wsId) return w;
      if (w.viewMode === mode) return w;
      let canvasLayout = w.canvasLayout || {};
      if (mode === 'canvas') {
        const next = { ...canvasLayout };
        const gridLg = w.layouts?.lg || [];
        w.panels.forEach((p) => {
          if (next[p.id]) return;
          const gl = gridLg.find((l) => l.i === p.id);
          if (gl) {
            next[p.id] = gridToCanvasRect(gl);
          } else {
            const spot = nextCanvasSpot(next, w.panels);
            const d = CANVAS_PANEL_DEFAULTS[p.type] || CANVAS_PANEL_DEFAULTS.terminal;
            next[p.id] = { x: spot.x, y: spot.y, ...d };
          }
        });
        canvasLayout = next;
      }
      return { ...w, viewMode: mode, canvasLayout };
    }));
  }, [nextCanvasSpot]);

  const toggleViewMode = useCallback(() => {
    if (!activeWs) return;
    const nextMode = activeWs.viewMode === 'canvas' ? 'grid' : 'canvas';
    switchViewMode(activeWs.id, nextMode);
    logActivity({
      category: 'ui',
      title: `${activeWs.name} → ${nextMode === 'canvas' ? 'Canvas' : 'Grid'} view`,
      workspaceId: activeWs.id,
    });
  }, [activeWs, switchViewMode]);

  const navigateToSearchResult = useCallback(({ workspaceId, panelId }) => {
    if (!workspaceId) return;
    setActiveId(workspaceId);
    if (panelId) {
      setWorkspaces((prev) => prev.map((w) =>
        w.id === workspaceId ? { ...w, focusedId: panelId, maximizedId: null } : w
      ));
    }
  }, []);

  const setCanvasView = useCallback((wsId, view) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? { ...w, canvasView: view } : w)));
  }, []);

  const setCanvasPanelRect = useCallback((wsId, panelId, patch) => {
    setWorkspaces((prev) => prev.map((w) => {
      if (w.id !== wsId) return w;
      const cur = w.canvasLayout[panelId];
      if (!cur) return w;
      return {
        ...w,
        canvasLayout: { ...w.canvasLayout, [panelId]: { ...cur, ...patch } },
      };
    }));
  }, []);

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
            panels: (w.panels || []).map((p) => {
              if (p.type !== 'terminal') return p;
              const tree = p.tree || { t: 'leaf', id: p.id };
              const fl = p.focusedLeaf && (tree.t === 'leaf' ? tree.id === p.focusedLeaf : true)
                ? p.focusedLeaf
                : firstLeaf(tree) || p.id;
              return { ...p, tree, focusedLeaf: fl };
            }),
            layouts: w.layouts || { lg: [] },
            focusedId: null,
            maximizedId: null,
            viewMode: w.viewMode || 'grid',
            canvasLayout: w.canvasLayout || {},
            canvasView: w.canvasView || { scale: 1, tx: 0, ty: 0 },
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
          panels: w.panels.map((p) => {
            const base = { id: p.id, type: p.type, name: p.name, pinned: p.pinned };
            if (p.type === 'terminal') {
              base.tree = p.tree;
              base.focusedLeaf = p.focusedLeaf;
            }
            return base;
          }),
          layouts: w.layouts,
          viewMode: w.viewMode,
          canvasLayout: w.canvasLayout,
          canvasView: w.canvasView,
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

  // Log workspace switches (after restore settles)
  const lastActiveRef = useRef(null);
  useEffect(() => {
    if (!isRestored || !activeId) return;
    if (lastActiveRef.current && lastActiveRef.current !== activeId) {
      const ws = workspaces.find((w) => w.id === activeId);
      if (ws) {
        logActivity({
          category: 'workspace',
          title: `Switched to "${ws.name}"`,
          workspaceId: ws.id,
        });
      }
    }
    lastActiveRef.current = activeId;
  }, [activeId, isRestored]);

  const addPanel = useCallback((type) => {
    if (!activeWs) return;
    const id = genPanelId();
    logActivity({
      category: 'panel',
      title: `Added ${type} panel`,
      detail: activeWs.name,
      workspaceId: activeWs.id,
      panelId: id,
    });
    const defaults = PANEL_DEFAULTS[type];
    const canvasDefaults = CANVAS_PANEL_DEFAULTS[type] || CANVAS_PANEL_DEFAULTS.terminal;
    const newPanel = { id, type };
    if (type === 'terminal') {
      newPanel.tree = { t: 'leaf', id };
      newPanel.focusedLeaf = id;
    }
    updateActive((w) => {
      const occupied = w.layouts.lg || [];
      const maxY = occupied.reduce((max, l) => Math.max(max, l.y + l.h), 0);
      const spot = nextCanvasSpot(w.canvasLayout || {}, w.panels);
      return {
        ...w,
        panels: [...w.panels, newPanel],
        layouts: {
          ...w.layouts,
          lg: [...occupied, { i: id, x: 0, y: maxY, ...defaults }],
        },
        canvasLayout: {
          ...(w.canvasLayout || {}),
          [id]: { x: spot.x, y: spot.y, ...canvasDefaults },
        },
        focusedId: id,
      };
    });
  }, [activeWs, updateActive, nextCanvasSpot]);

  const removePanel = useCallback((id) => {
    if (!activeWs) return;
    let wasPinned = false;
    const targetPanel = activeWs.panels.find((p) => p.id === id);
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
      const nextCanvas = { ...(w.canvasLayout || {}) };
      delete nextCanvas[id];
      return {
        ...w,
        panels: w.panels.filter((p) => p.id !== id),
        layouts: { ...w.layouts, lg: (w.layouts.lg || []).filter((l) => l.i !== id) },
        canvasLayout: nextCanvas,
        focusedId: w.focusedId === id ? null : w.focusedId,
        maximizedId: w.maximizedId === id ? null : w.maximizedId,
      };
    });
    if (wasPinned) return;
    if (targetPanel) {
      logActivity({
        category: 'panel',
        title: `Closed ${targetPanel.name || targetPanel.type}`,
        detail: activeWs.name,
        workspaceId: activeWs.id,
      });
    }
    // Kill every leaf's pty in a terminal panel (split-aware)
    if (targetPanel?.type === 'terminal' && window.boxterAPI?.terminal) {
      const leaves = targetPanel.tree ? allLeaves(targetPanel.tree) : [id];
      leaves.forEach((leafId) => {
        try { window.boxterAPI.terminal.kill(leafId); } catch { /* ignore */ }
      });
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
    if (activeWs && newName) {
      logActivity({
        category: 'panel',
        title: `Renamed panel → "${newName}"`,
        detail: activeWs.name,
        workspaceId: activeWs.id,
        panelId: id,
      });
    }
  }, [updateActive, activeWs]);

  const toggleMaximize = useCallback((id) => {
    updateActive((w) => ({
      ...w,
      focusedId: id,
      maximizedId: w.maximizedId === id ? null : id,
    }));
  }, [updateActive]);

  const setTerminalTree = useCallback((panelId, tree) => {
    updateActive((w) => ({
      ...w,
      panels: w.panels.map((p) => (p.id === panelId ? { ...p, tree } : p)),
    }));
  }, [updateActive]);

  const setFocusedLeaf = useCallback((panelId, leafId) => {
    updateActive((w) => ({
      ...w,
      panels: w.panels.map((p) => (p.id === panelId ? { ...p, focusedLeaf: leafId } : p)),
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
    if (source.type === 'terminal') {
      // Copy tree shape with fresh leaf ids for new ptys
      const freshTree = source.tree
        ? regenerateLeafIds(source.tree, newId)
        : { t: 'leaf', id: newId };
      newPanel.tree = freshTree;
      newPanel.focusedLeaf = firstLeaf(freshTree) || newId;
    }
    const defaults = PANEL_DEFAULTS[source.type];
    const newLayout = sourceLayout
      ? { i: newId, x: sourceLayout.x, y: sourceLayout.y + sourceLayout.h,
          w: sourceLayout.w, h: sourceLayout.h, minW: defaults.minW, minH: defaults.minH }
      : { i: newId, x: 0, y: Infinity, ...defaults };
    const srcCanvas = activeWs.canvasLayout?.[id];
    const newCanvas = srcCanvas
      ? { x: srcCanvas.x + 30, y: srcCanvas.y + 30, w: srcCanvas.w, h: srcCanvas.h }
      : { x: 20, y: 20, ...(CANVAS_PANEL_DEFAULTS[source.type] || CANVAS_PANEL_DEFAULTS.terminal) };
    updateActive((w) => ({
      ...w,
      panels: [...w.panels, newPanel],
      layouts: { ...w.layouts, lg: [...(w.layouts.lg || []), newLayout] },
      canvasLayout: { ...(w.canvasLayout || {}), [newId]: newCanvas },
      focusedId: newId,
    }));
    logActivity({
      category: 'panel',
      title: `Duplicated ${source.name || source.type}`,
      detail: activeWs.name,
      workspaceId: activeWs.id,
      panelId: newId,
    });
  }, [activeWs, updateActive]);

  const onLayoutChange = useCallback((wsId) => (layout, allLayouts) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? { ...w, layouts: allLayouts } : w)));
  }, []);

  // Workspace management
  const addWorkspace = useCallback(() => {
    const ws = makeWorkspace(`Workspace ${workspaces.length + 1}`);
    setWorkspaces((prev) => [...prev, ws]);
    setActiveId(ws.id);
    logActivity({
      category: 'workspace',
      title: `Created workspace "${ws.name}"`,
      workspaceId: ws.id,
    });
  }, [workspaces.length]);

  const addWorkspaceFromTemplate = useCallback((templateId) => {
    const tpl = getTemplate(templateId);
    if (!tpl) return;
    const ws = makeWorkspace(tpl.name);
    const panels = [];
    const gridLg = [];
    const canvasLayout = {};
    tpl.panels.forEach((pdef) => {
      const id = genPanelId();
      panels.push({ id, type: pdef.type, name: pdef.name || undefined });
      gridLg.push({ i: id, ...pdef.grid });
      if (pdef.canvas) canvasLayout[id] = pdef.canvas;
    });
    ws.panels = panels;
    ws.layouts = { lg: gridLg };
    ws.canvasLayout = canvasLayout;
    ws.focusedId = panels[0]?.id || null;
    setWorkspaces((prev) => [...prev, ws]);
    setActiveId(ws.id);
    logActivity({
      category: 'workspace',
      title: `Created "${ws.name}" from template`,
      detail: `${panels.length} panels`,
      workspaceId: ws.id,
    });
  }, []);

  const removeWorkspace = useCallback((wsId) => {
    const target = workspaces.find((w) => w.id === wsId);
    setWorkspaces((prev) => {
      if (prev.length <= 1) return prev; // keep at least one
      const ws = prev.find((w) => w.id === wsId);
      // Kill all terminals and purge file-panel storage in that workspace
      if (ws) {
        ws.panels.forEach((p) => {
          if (p.type === 'terminal') window.boxterAPI?.terminal?.kill(p.id);
          if (p.type === 'files') window.boxterAPI?.files?.purgePanel?.(p.id);
        });
      }
      delete closedStacks.current[wsId];
      const next = prev.filter((w) => w.id !== wsId);
      return next;
    });
    if (target && workspaces.length > 1) {
      logActivity({
        category: 'workspace',
        title: `Closed workspace "${target.name}"`,
      });
    }
    setActiveId((cur) => {
      if (cur !== wsId) return cur;
      const remaining = workspaces.filter((w) => w.id !== wsId);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [workspaces]);

  const renameWorkspace = useCallback((wsId, newName) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? { ...w, name: newName || 'Workspace' } : w)));
    if (newName) {
      logActivity({
        category: 'workspace',
        title: `Renamed workspace → "${newName}"`,
        workspaceId: wsId,
      });
    }
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
        panels: w.panels.map((p) => {
          const base = { id: p.id, type: p.type, name: p.name, pinned: p.pinned };
          if (p.type === 'terminal') {
            base.tree = p.tree;
            base.focusedLeaf = p.focusedLeaf;
          }
          return base;
        }),
        layouts: w.layouts,
        viewMode: w.viewMode,
        canvasLayout: w.canvasLayout,
        canvasView: w.canvasView,
      })),
      activeId,
    };
    await window.boxterAPI?.session.save(name, data);
    logActivity({
      category: 'session',
      title: `Saved session "${name}"`,
      detail: `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}`,
    });
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
        panels: (w.panels || []).map((p) => {
          if (p.type !== 'terminal') return p;
          const tree = p.tree || { t: 'leaf', id: p.id };
          return { ...p, tree, focusedLeaf: p.focusedLeaf || firstLeaf(tree) || p.id };
        }),
        layouts: w.layouts || { lg: [] },
        focusedId: null,
        maximizedId: null,
        viewMode: w.viewMode || 'grid',
        canvasLayout: w.canvasLayout || {},
        canvasView: w.canvasView || { scale: 1, tx: 0, ty: 0 },
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
    logActivity({
      category: 'session',
      title: `Loaded session "${name}"`,
      detail: `${restored.length} workspace${restored.length === 1 ? '' : 's'}`,
    });
  }, [workspaces]);

  // Keyboard shortcuts
  const focusedId = activeWs?.focusedId || null;
  const maximizedId = activeWs?.maximizedId || null;

  const shortcuts = React.useMemo(() => [
    { key: 't', ctrl: true, handler: () => addPanel('terminal') },
    { key: 'b', ctrl: true, handler: () => addPanel('browser') },
    { key: 'e', ctrl: true, handler: () => addPanel('notes') },
    { key: 'f', ctrl: true, shift: true, handler: () => addPanel('files') },
    { key: 'w', ctrl: true, handler: () => { if (focusedId) removePanel(focusedId); } },
    { key: 'd', ctrl: true, handler: () => { if (focusedId) duplicatePanel(focusedId); } },
    { key: 'm', ctrl: true, handler: () => { if (focusedId) toggleMaximize(focusedId); } },
    { key: 'p', alt: true,  handler: () => { if (focusedId) togglePin(focusedId); } },
    { key: 't', alt: true,  handler: cycleTheme },
    { key: 'b', alt: true,  handler: toggleStatusBanner },
    { key: 'v', alt: true,  handler: toggleViewMode },
    { key: 'h', alt: true,  handler: toggleActivity },
    { key: 'n', ctrl: true, alt: true, handler: () => setShowTemplatePicker(true) },
    { key: 't', ctrl: true, shift: true, handler: undoCloseLastPanel },
    { key: 'n', ctrl: true, shift: true, handler: addWorkspace },
    { key: 'Tab', ctrl: true,             handler: () => nextWorkspace(1) },
    { key: 'Tab', ctrl: true, shift: true, handler: () => nextWorkspace(-1) },
    { key: '/', ctrl: true, handler: () => setShowShortcutHelp((s) => !s) },
    { key: 'k', ctrl: true, handler: () => setShowCommandPalette((s) => !s) },
    { key: 'p', ctrl: true, handler: () => setShowGlobalSearch((s) => !s) },
    { key: 's', ctrl: true, handler: () => setShowSessionManager(true) },
    { key: 'F2', handler: () => {
      if (!focusedId) return;
      const panel = document.querySelector('.workspace-active .panel-focused .panel-type');
      panel?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }},
    { key: 'Escape', ignoreInInputs: false, handler: () => {
      if (showTemplatePicker) { setShowTemplatePicker(false); return; }
      if (showGlobalSearch) { setShowGlobalSearch(false); return; }
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
    showGlobalSearch, showTemplatePicker,
    workspaces, updateActive, cycleTheme, toggleStatusBanner, toggleViewMode,
    toggleActivity,
  ]);

  useKeyboardShortcuts(shortcuts);

  // Terminal → Notes pipe map, persisted in localStorage
  const [pipes, setPipes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('boxter-pipes') || '{}') || {}; }
    catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('boxter-pipes', JSON.stringify(pipes)); } catch { /* ignore */ }
  }, [pipes]);

  const setTerminalPipe = useCallback((terminalId, notesId) => {
    setPipes((prev) => {
      const next = { ...prev };
      if (notesId) next[terminalId] = notesId;
      else delete next[terminalId];
      return next;
    });
    if (!activeWs) return;
    const term = activeWs.panels.find((p) => p.id === terminalId);
    const note = notesId && activeWs.panels.find((p) => p.id === notesId);
    logActivity({
      category: 'content',
      title: notesId
        ? `Pipe: ${term?.name || 'Terminal'} → ${note?.name || 'Notes'}`
        : `Pipe cleared on ${term?.name || 'Terminal'}`,
      detail: activeWs.name,
      workspaceId: activeWs.id,
      panelId: terminalId,
    });
  }, [activeWs]);

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
      { id: 'new-files',    category: 'Panel', label: 'New Files',
        keys: ['Ctrl', 'Shift', 'F'], handler: () => addPanel('files') },
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
      { id: 'new-ws-from-template', category: 'Workspace',
        label: 'New workspace from template…',
        keys: ['Ctrl', 'Alt', 'N'], handler: () => setShowTemplatePicker(true) },
      { id: 'next-ws', category: 'Workspace', label: 'Next workspace',
        keys: ['Ctrl', 'Tab'], handler: () => nextWorkspace(1) },
      { id: 'prev-ws', category: 'Workspace', label: 'Previous workspace',
        keys: ['Ctrl', 'Shift', 'Tab'], handler: () => nextWorkspace(-1) },
    );
    TEMPLATES.forEach((t) => {
      list.push({
        id: `tpl-${t.id}`,
        category: 'Template',
        label: `Create "${t.name}" workspace`,
        handler: () => addWorkspaceFromTemplate(t.id),
      });
    });
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
    // Pipe: focused leaf of each terminal → notes
    if (activeWs) {
      const terms = activeWs.panels.filter((p) => p.type === 'terminal');
      const notes = activeWs.panels.filter((p) => p.type === 'notes');
      terms.forEach((t) => {
        const leafId = t.focusedLeaf || (t.tree ? firstLeaf(t.tree) : t.id) || t.id;
        const active = pipes[leafId];
        const leafLabel = t.tree && t.tree.t === 'split' ? ' (focused pane)' : '';
        if (active) {
          const notePanel = activeWs.panels.find((p) => p.id === active);
          list.push({
            id: `unpipe-${leafId}`,
            category: 'Pipe',
            label: `Stop piping "${t.name || 'Terminal'}"${leafLabel} → "${notePanel?.name || 'Notes'}"`,
            handler: () => setTerminalPipe(leafId, null),
          });
        }
        notes.forEach((n) => {
          if (active === n.id) return;
          list.push({
            id: `pipe-${leafId}-${n.id}`,
            category: 'Pipe',
            label: `Pipe "${t.name || 'Terminal'}"${leafLabel} → "${n.name || 'Notes'}"`,
            handler: () => setTerminalPipe(leafId, n.id),
          });
        });
      });
    }
    // Theme / UI
    list.push(
      { id: 'cycle-theme', category: 'Theme',
        label: `Cycle theme (current: ${currentTheme.label})`,
        keys: ['Alt', 'T'], handler: cycleTheme },
      { id: 'toggle-status-banner', category: 'UI',
        label: showStatusBanner ? 'Hide status banner' : 'Show status banner',
        keys: ['Alt', 'B'], handler: toggleStatusBanner },
      { id: 'toggle-view-mode', category: 'View',
        label: activeWs?.viewMode === 'canvas' ? 'Switch to Grid view' : 'Switch to Canvas view',
        keys: ['Alt', 'V'], handler: toggleViewMode },
      { id: 'toggle-activity', category: 'UI',
        label: showActivity ? 'Hide activity timeline' : 'Show activity timeline',
        keys: ['Alt', 'H'], handler: toggleActivity },
    );
    // Search / Sessions / help
    list.push(
      { id: 'global-search', category: 'Search',
        label: 'Global search (all workspaces)',
        keys: ['Ctrl', 'P'], handler: () => setShowGlobalSearch(true) },
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
    cycleTheme, currentTheme, showStatusBanner, toggleStatusBanner,
    toggleViewMode, showActivity, toggleActivity, addWorkspaceFromTemplate,
    pipes, setTerminalPipe,
  ]);

  // Clean up dangling pipes when panels are removed
  useEffect(() => {
    const allIds = new Set(workspaces.flatMap((w) => w.panels.map((p) => p.id)));
    setPipes((prev) => {
      const next = {};
      Object.entries(prev).forEach(([termId, notesId]) => {
        if (allIds.has(termId) && allIds.has(notesId)) next[termId] = notesId;
      });
      return next;
    });
  }, [workspaces]);

  const sendToTerminal = useCallback((text, opts = {}) => {
    if (!activeWs || !text) return { ok: false, reason: 'No active workspace' };
    const terminals = activeWs.panels.filter((p) => p.type === 'terminal');
    if (terminals.length === 0) {
      return { ok: false, reason: 'No terminal in workspace' };
    }
    const focused = terminals.find((p) => p.id === activeWs.focusedId);
    const target = focused || terminals[terminals.length - 1];
    const leafId = target.focusedLeaf || (target.tree ? firstLeaf(target.tree) : target.id) || target.id;
    const payload = opts.execute ? text + (text.endsWith('\n') ? '' : '\r') : text;
    try {
      window.boxterAPI?.terminal?.write(leafId, payload);
    } catch { return { ok: false, reason: 'Terminal write failed' }; }
    logActivity({
      category: 'content',
      title: `Sent ${text.split('\n').length} line(s) to ${target.name || 'Terminal'}`,
      detail: activeWs.name,
      workspaceId: activeWs.id,
      panelId: target.id,
    });
    return { ok: true, terminalId: leafId, terminalName: target.name || 'Terminal' };
  }, [activeWs]);

  const getPipeForLeaf = useCallback((leafId) => {
    const notesId = pipes[leafId];
    if (!notesId) return null;
    const notePanel = activeWs?.panels.find((p) => p.id === notesId);
    return { notesId, label: notePanel ? (notePanel.name || 'Notes') : null };
  }, [pipes, activeWs]);

  const renderPanel = (panel) => {
    switch (panel.type) {
      case 'terminal': {
        return (
          <TerminalPanel
            id={panel.id}
            tree={panel.tree}
            focusedLeaf={panel.focusedLeaf}
            onTreeChange={(t) => setTerminalTree(panel.id, t)}
            onFocusedLeafChange={(leafId) => setFocusedLeaf(panel.id, leafId)}
            onClose={() => removePanel(panel.id)}
            getPipeFor={getPipeForLeaf}
          />
        );
      }
      case 'browser':  return <BrowserPanel id={panel.id} />;
      case 'notes':    return <NotesPanel id={panel.id} onSendToTerminal={sendToTerminal} />;
      case 'files':    return <FilesPanel id={panel.id} />;
      default: return <div>Unknown panel type</div>;
    }
  };

  return (
    <div className="app">
      <UpdateBanner />
      <Toolbar
        onAddPanel={addPanel}
        onToggleSessions={() => setShowSessionManager((s) => !s)}
        onShowShortcuts={() => setShowShortcutHelp(true)}
        onCycleTheme={cycleTheme}
        themeLabel={currentTheme.label}
        themeIcon={currentTheme.icon}
        viewMode={activeWs?.viewMode || 'grid'}
        onToggleViewMode={toggleViewMode}
      />

      <WorkspaceTabs
        workspaces={workspaces}
        activeId={activeId}
        onSwitch={switchWorkspace}
        onAdd={addWorkspace}
        onClose={removeWorkspace}
        onRename={renameWorkspace}
      />

      {showStatusBanner && activeWs && (() => {
        const counts = { terminal: 0, browser: 0, notes: 0, files: 0 };
        activeWs.panels.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
        const idx = workspaces.findIndex((w) => w.id === activeId) + 1;
        const focused = activeWs.panels.find((p) => p.id === activeWs.focusedId);
        return (
          <StatusBanner
            workspaceName={activeWs.name}
            workspaceIndex={idx}
            workspaceTotal={workspaces.length}
            panelCounts={counts}
            focusedType={focused ? (focused.name || focused.type) : null}
            themeLabel={currentTheme.label}
          />
        );
      })()}

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

      {showGlobalSearch && (
        <GlobalSearch
          workspaces={workspaces}
          onNavigate={navigateToSearchResult}
          onClose={() => setShowGlobalSearch(false)}
        />
      )}

      {showActivity && (
        <ActivityTimeline
          onNavigate={navigateToSearchResult}
          onClose={() => setShowActivity(false)}
        />
      )}

      {showTemplatePicker && (
        <TemplatePicker
          onPick={(tplId) => {
            addWorkspaceFromTemplate(tplId);
            setShowTemplatePicker(false);
          }}
          onClose={() => setShowTemplatePicker(false)}
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
                <p>Start from a template, or add panels manually.</p>
                <div className="empty-actions">
                  <button
                    className="empty-primary"
                    onClick={() => setShowTemplatePicker(true)}
                  >
                    Start from template…
                  </button>
                  <button onClick={() => addPanel('terminal')}>Terminal</button>
                  <button onClick={() => addPanel('browser')}>Browser</button>
                  <button onClick={() => addPanel('notes')}>Notes</button>
                  <button onClick={() => addPanel('files')}>Files</button>
                </div>
                <p className="empty-tip">
                  Tip: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> opens templates · <kbd>Ctrl</kbd>+<kbd>/</kbd> shows all shortcuts
                </p>
              </div>
            ) : ws.viewMode === 'canvas' ? (
              <CanvasView
                panels={ws.panels}
                canvasLayout={ws.canvasLayout || {}}
                canvasView={ws.canvasView || { scale: 1, tx: 0, ty: 0 }}
                focusedId={ws.focusedId}
                onViewChange={(v) => setCanvasView(ws.id, v)}
                onLayoutChange={(panelId, patch) => setCanvasPanelRect(ws.id, panelId, patch)}
                onFocus={(id) => ws.id === activeId && focusPanel(id)}
                onRemove={removePanel}
                onRename={renamePanel}
                onDuplicate={duplicatePanel}
                onTogglePin={togglePin}
                onSendToTerminal={sendToTerminal}
                onTerminalTree={setTerminalTree}
                onFocusedLeaf={setFocusedLeaf}
                onClosePanel={removePanel}
                getPipeFor={getPipeForLeaf}
              />
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
