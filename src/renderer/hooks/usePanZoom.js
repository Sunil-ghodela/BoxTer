import { useEffect, useRef, useCallback } from 'react';

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.12;

export default function usePanZoom({ containerRef, view, onChange }) {
  const viewRef = useRef(view);
  viewRef.current = view;
  const panning = useRef(null); // {startX, startY, tx0, ty0}

  const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

  const zoomAt = useCallback((clientX, clientY, factor) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { scale, tx, ty } = viewRef.current;
    const next = clampScale(scale * factor);
    if (next === scale) return;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const ratio = next / scale;
    const ntx = px - (px - tx) * ratio;
    const nty = py - (py - ty) * ratio;
    onChange({ scale: next, tx: ntx, ty: nty });
  }, [containerRef, onChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAt(e.clientX, e.clientY, factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, zoomAt]);

  const onPanStart = useCallback((e) => {
    panning.current = {
      startX: e.clientX,
      startY: e.clientY,
      tx0: viewRef.current.tx,
      ty0: viewRef.current.ty,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!panning.current) return;
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      onChange({
        scale: viewRef.current.scale,
        tx: panning.current.tx0 + dx,
        ty: panning.current.ty0 + dy,
      });
    };
    const onUp = () => { panning.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onChange]);

  const zoomIn = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_STEP);
  }, [containerRef, zoomAt]);

  const zoomOut = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / ZOOM_STEP);
  }, [containerRef, zoomAt]);

  const reset = useCallback(() => {
    onChange({ scale: 1, tx: 0, ty: 0 });
  }, [onChange]);

  const fitTo = useCallback((bbox, padding = 60) => {
    const el = containerRef.current;
    if (!el || !bbox || bbox.w <= 0 || bbox.h <= 0) return;
    const rect = el.getBoundingClientRect();
    const availW = Math.max(1, rect.width - padding * 2);
    const availH = Math.max(1, rect.height - padding * 2);
    const scale = clampScale(Math.min(availW / bbox.w, availH / bbox.h, 1));
    const tx = rect.width / 2 - (bbox.x + bbox.w / 2) * scale;
    const ty = rect.height / 2 - (bbox.y + bbox.h / 2) * scale;
    onChange({ scale, tx, ty });
  }, [containerRef, onChange]);

  return { onPanStart, zoomIn, zoomOut, reset, fitTo, zoomAt };
}
