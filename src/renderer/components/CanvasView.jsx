import React, { useRef, useCallback, useMemo, useEffect } from 'react';
import PanelWrapper from './PanelWrapper.jsx';
import TerminalPanel from './TerminalPanel.jsx';
import NotesPanel from './NotesPanel.jsx';
import FilesPanel from './FilesPanel.jsx';
import BrowserPlaceholder from './BrowserPlaceholder.jsx';
import CanvasMinimap from './CanvasMinimap.jsx';
import usePanZoom from '../hooks/usePanZoom.js';

const MIN_PANEL_W = 200;
const MIN_PANEL_H = 140;

const renderBody = (panel) => {
  switch (panel.type) {
    case 'terminal': return <TerminalPanel id={panel.id} />;
    case 'notes':    return <NotesPanel id={panel.id} />;
    case 'files':    return <FilesPanel id={panel.id} />;
    case 'browser':  return <BrowserPlaceholder id={panel.id} />;
    default: return <div>Unknown panel type</div>;
  }
};

const AUTO_ZOOM_THRESHOLD = 0.7;

export default function CanvasView({
  panels,
  canvasLayout,
  canvasView,
  focusedId,
  onViewChange,
  onLayoutChange,
  onFocus,
  onRemove,
  onRename,
  onDuplicate,
  onTogglePin,
}) {
  const containerRef = useRef(null);
  const worldRef = useRef(null);
  const animTimerRef = useRef(null);
  const viewRef = useRef(canvasView);
  viewRef.current = canvasView;
  const canvasLayoutRef = useRef(canvasLayout);
  canvasLayoutRef.current = canvasLayout;

  const animateView = useCallback((view) => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (worldRef.current) worldRef.current.classList.add('canvas-world-animated');
    onViewChange(view);
    animTimerRef.current = setTimeout(() => {
      if (worldRef.current) worldRef.current.classList.remove('canvas-world-animated');
      animTimerRef.current = null;
    }, 320);
  }, [onViewChange]);

  const zoomToPanel = useCallback((panelId) => {
    const rect = canvasLayoutRef.current[panelId];
    const el = containerRef.current;
    if (!rect || !el) return;
    const cr = el.getBoundingClientRect();
    const padding = 60;
    const fit = Math.min(
      (cr.width - padding * 2) / rect.w,
      (cr.height - padding * 2) / rect.h,
    );
    const scale = Math.max(0.4, Math.min(1.4, fit));
    const tx = cr.width / 2 - (rect.x + rect.w / 2) * scale;
    const ty = cr.height / 2 - (rect.y + rect.h / 2) * scale;
    animateView({ scale, tx, ty });
  }, [animateView]);

  const { onPanStart, zoomIn, zoomOut, reset, fitTo } = usePanZoom({
    containerRef,
    view: canvasView,
    onChange: onViewChange,
  });

  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    panels.forEach((p) => {
      const r = canvasLayout[p.id];
      if (!r) return;
      any = true;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    });
    if (!any) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [panels, canvasLayout]);

  const handleFit = useCallback(() => {
    if (!bbox) return;
    const el = containerRef.current;
    if (!el) { fitTo(bbox); return; }
    const cr = el.getBoundingClientRect();
    const padding = 60;
    const availW = Math.max(1, cr.width - padding * 2);
    const availH = Math.max(1, cr.height - padding * 2);
    const scale = Math.max(0.15, Math.min(1, Math.min(availW / bbox.w, availH / bbox.h)));
    const tx = cr.width / 2 - (bbox.x + bbox.w / 2) * scale;
    const ty = cr.height / 2 - (bbox.y + bbox.h / 2) * scale;
    animateView({ scale, tx, ty });
  }, [bbox, fitTo, animateView]);

  const focusedIdRef = useRef(focusedId);
  focusedIdRef.current = focusedId;

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
                       e.target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleFit();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        reset();
      } else if (e.key === '+' || (e.key === '=' && e.shiftKey)) {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        if (focusedIdRef.current) {
          e.preventDefault();
          zoomToPanel(focusedIdRef.current);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleFit, reset, zoomIn, zoomOut, zoomToPanel]);

  // Drag a panel by header
  const dragState = useRef(null);

  const onPanelDragStart = useCallback((panel, e) => {
    const rect = canvasLayout[panel.id];
    if (!rect) return;
    dragState.current = {
      id: panel.id,
      startX: e.clientX,
      startY: e.clientY,
      x0: rect.x,
      y0: rect.y,
    };
    onFocus(panel.id);
    e.preventDefault();
    e.stopPropagation();
  }, [canvasLayout, onFocus]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current) return;
      const d = dragState.current;
      const scale = canvasView.scale;
      const dx = (e.clientX - d.startX) / scale;
      const dy = (e.clientY - d.startY) / scale;
      onLayoutChange(d.id, { x: d.x0 + dx, y: d.y0 + dy });
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasView.scale, onLayoutChange]);

  // Resize handle
  const resizeState = useRef(null);
  const onResizeStart = useCallback((panel, e) => {
    const rect = canvasLayout[panel.id];
    if (!rect) return;
    resizeState.current = {
      id: panel.id,
      startX: e.clientX,
      startY: e.clientY,
      w0: rect.w,
      h0: rect.h,
    };
    onFocus(panel.id);
    e.preventDefault();
    e.stopPropagation();
  }, [canvasLayout, onFocus]);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeState.current) return;
      const r = resizeState.current;
      const scale = canvasView.scale;
      const dw = (e.clientX - r.startX) / scale;
      const dh = (e.clientY - r.startY) / scale;
      onLayoutChange(r.id, {
        w: Math.max(MIN_PANEL_W, r.w0 + dw),
        h: Math.max(MIN_PANEL_H, r.h0 + dh),
      });
    };
    const onUp = () => { resizeState.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasView.scale, onLayoutChange]);

  const handleBgMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 0) {
      if (e.target === containerRef.current || e.target.classList.contains('canvas-world')) {
        onPanStart(e);
      }
    }
  }, [onPanStart]);

  const { scale, tx, ty } = canvasView;
  const worldTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;

  const onPanelClickFocus = useCallback((panel, e) => {
    e.stopPropagation();
    onFocus(panel.id);
    if (viewRef.current.scale < AUTO_ZOOM_THRESHOLD) {
      zoomToPanel(panel.id);
    }
  }, [onFocus, zoomToPanel]);

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleBgMouseDown}
    >
      <div ref={worldRef} className="canvas-world" style={{ transform: worldTransform }}>
        <div className="canvas-grid-bg" />
        {panels.map((panel) => {
          const rect = canvasLayout[panel.id];
          if (!rect) return null;
          return (
            <div
              key={panel.id}
              className={`canvas-panel${panel.id === focusedId ? ' canvas-panel-focused' : ''}`}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
              }}
              onMouseDown={(e) => onPanelClickFocus(panel, e)}
            >
              <PanelWrapper
                id={panel.id}
                type={panel.type}
                name={panel.name}
                isPinned={!!panel.pinned}
                isFocused={panel.id === focusedId}
                isMaximized={false}
                onFocus={() => onFocus(panel.id)}
                onRemove={onRemove}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onToggleMaximize={() => {}}
                onTogglePin={onTogglePin}
                onHeaderMouseDown={(e) => onPanelDragStart(panel, e)}
              >
                {renderBody(panel)}
              </PanelWrapper>
              <div
                className="canvas-resize-handle"
                onMouseDown={(e) => onResizeStart(panel, e)}
              />
            </div>
          );
        })}
      </div>

      <div className="canvas-controls">
        <button className="canvas-btn" onClick={zoomIn} title="Zoom in (+)">+</button>
        <button className="canvas-btn canvas-zoom-label" onClick={reset} title="Reset (Ctrl+1)">
          {Math.round(scale * 100)}%
        </button>
        <button className="canvas-btn" onClick={zoomOut} title="Zoom out (-)">-</button>
        <button
          className="canvas-btn canvas-fit-btn"
          onClick={focusedId && viewRef.current.scale < AUTO_ZOOM_THRESHOLD
            ? () => zoomToPanel(focusedId)
            : handleFit}
          title={focusedId ? 'Zoom to focused panel (Alt+Z) / Fit all (Ctrl+0)' : 'Fit all (Ctrl+0)'}
        >
          Fit
        </button>
      </div>

      {bbox && (
        <CanvasMinimap
          containerRef={containerRef}
          panels={panels}
          canvasLayout={canvasLayout}
          canvasView={canvasView}
          focusedId={focusedId}
          bbox={bbox}
          onNavigate={(nx, ny) => onViewChange({ scale, tx: nx, ty: ny })}
        />
      )}
    </div>
  );
}
