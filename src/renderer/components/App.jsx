import React, { useState, useCallback, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import Toolbar from './Toolbar.jsx';
import PanelWrapper from './PanelWrapper.jsx';
import TerminalPanel from './TerminalPanel.jsx';
import BrowserPanel from './BrowserPanel.jsx';
import NotesPanel from './NotesPanel.jsx';
import SessionManager from './SessionManager.jsx';
import 'react-grid-layout/css/styles.css';

const ResponsiveGrid = WidthProvider(Responsive);

let panelCounter = 0;
const genId = () => `panel-${++panelCounter}`;

const PANEL_DEFAULTS = {
  terminal: { w: 4, h: 4, minW: 2, minH: 2 },
  browser:  { w: 5, h: 5, minW: 3, minH: 3 },
  notes:    { w: 3, h: 3, minW: 2, minH: 2 },
};

export default function App() {
  const [panels, setPanels] = useState([]);
  const [layouts, setLayouts] = useState({ lg: [] });
  const [showSessionManager, setShowSessionManager] = useState(false);

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
  }, [layouts]);

  const removePanel = useCallback((id) => {
    if (window.boxterAPI?.terminal) {
      window.boxterAPI.terminal.kill(id);
    }
    setPanels((prev) => prev.filter((p) => p.id !== id));
    setLayouts((prev) => ({
      ...prev,
      lg: (prev.lg || []).filter((l) => l.i !== id),
    }));
  }, []);

  const onLayoutChange = useCallback((layout, allLayouts) => {
    setLayouts(allLayouts);
  }, []);

  // Session save/load
  const saveSession = useCallback(async (name) => {
    const sessionData = {
      panels: panels.map((p) => ({ id: p.id, type: p.type })),
      layouts,
    };
    await window.boxterAPI?.session.save(name, sessionData);
  }, [panels, layouts]);

  const loadSession = useCallback(async (name) => {
    const data = await window.boxterAPI?.session.load(name);
    if (!data) return;
    // Kill existing terminals
    panels.forEach((p) => {
      if (p.type === 'terminal') window.boxterAPI?.terminal.kill(p.id);
    });
    setPanels(data.panels || []);
    setLayouts(data.layouts || { lg: [] });
    // Update counter to avoid id collisions
    const maxNum = (data.panels || []).reduce((max, p) => {
      const num = parseInt(p.id.replace('panel-', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, panelCounter);
    panelCounter = maxNum;
  }, [panels]);

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
      />

      {showSessionManager && (
        <SessionManager
          onSave={saveSession}
          onLoad={loadSession}
          onClose={() => setShowSessionManager(false)}
        />
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
          </div>
        ) : (
          <ResponsiveGrid
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
            rowHeight={60}
            onLayoutChange={onLayoutChange}
            draggableHandle=".panel-header"
            resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
            compactType="vertical"
            margin={[6, 6]}
          >
            {panels.map((panel) => (
              <div key={panel.id}>
                <PanelWrapper
                  id={panel.id}
                  type={panel.type}
                  onRemove={removePanel}
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
