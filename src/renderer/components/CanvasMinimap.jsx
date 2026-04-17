import React, { useRef, useCallback } from 'react';

const MINI_W = 180;
const MINI_H = 120;
const PADDING = 12;

const TYPE_COLORS = {
  terminal: '#50fa7b',
  browser:  '#ff79c6',
  notes:    '#f1fa8c',
  files:    '#8be9fd',
};

export default function CanvasMinimap({
  containerRef,
  panels,
  canvasLayout,
  canvasView,
  focusedId,
  bbox,
  onNavigate,
}) {
  const miniRef = useRef(null);

  const pad = 40;
  const extX = bbox.x - pad;
  const extY = bbox.y - pad;
  const extW = bbox.w + pad * 2;
  const extH = bbox.h + pad * 2;

  const availW = MINI_W - PADDING * 2;
  const availH = MINI_H - PADDING * 2;
  const scale = Math.min(availW / extW, availH / extH);
  const offX = PADDING + (availW - extW * scale) / 2;
  const offY = PADDING + (availH - extH * scale) / 2;

  const toMini = (x, y) => ({
    x: offX + (x - extX) * scale,
    y: offY + (y - extY) * scale,
  });

  const container = containerRef.current;
  const cRect = container ? container.getBoundingClientRect() : { width: 0, height: 0 };
  const worldViewX = -canvasView.tx / canvasView.scale;
  const worldViewY = -canvasView.ty / canvasView.scale;
  const worldViewW = cRect.width / canvasView.scale;
  const worldViewH = cRect.height / canvasView.scale;
  const vp = toMini(worldViewX, worldViewY);
  const vpW = worldViewW * scale;
  const vpH = worldViewH * scale;

  const jumpTo = useCallback((clientX, clientY) => {
    const el = miniRef.current;
    if (!el || !container) return;
    const r = el.getBoundingClientRect();
    const mx = clientX - r.left;
    const my = clientY - r.top;
    const wx = extX + (mx - offX) / scale;
    const wy = extY + (my - offY) / scale;
    const cRect2 = container.getBoundingClientRect();
    onNavigate(
      cRect2.width / 2 - wx * canvasView.scale,
      cRect2.height / 2 - wy * canvasView.scale
    );
  }, [extX, extY, offX, offY, scale, container, canvasView.scale, onNavigate]);

  return (
    <div
      ref={miniRef}
      className="canvas-minimap"
      onMouseDown={(e) => { e.stopPropagation(); jumpTo(e.clientX, e.clientY); }}
      title="Click to navigate"
    >
      <svg width={MINI_W} height={MINI_H}>
        <rect
          x={0} y={0} width={MINI_W} height={MINI_H}
          className="mini-bg"
        />
        {panels.map((p) => {
          const r = canvasLayout[p.id];
          if (!r) return null;
          const a = toMini(r.x, r.y);
          const w = Math.max(2, r.w * scale);
          const h = Math.max(2, r.h * scale);
          return (
            <rect
              key={p.id}
              x={a.x} y={a.y} width={w} height={h}
              fill={TYPE_COLORS[p.type] || '#888'}
              opacity={p.id === focusedId ? 1 : 0.55}
              rx={2}
            />
          );
        })}
        <rect
          x={vp.x} y={vp.y} width={vpW} height={vpH}
          className="mini-viewport"
          fill="none"
        />
      </svg>
    </div>
  );
}
