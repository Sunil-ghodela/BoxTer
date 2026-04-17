import React, { useEffect, useState } from 'react';

const formatUptime = (sec) => {
  if (!sec && sec !== 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatTime = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function StatusBanner({
  workspaceName,
  workspaceIndex,
  workspaceTotal,
  panelCounts,
  focusedType,
  themeLabel,
}) {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const clockId = setInterval(() => setNow(new Date()), 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(clockId);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const s = await window.boxterAPI?.system?.stats();
        if (!cancelled && s) setStats(s);
      } catch { /* ignore */ }
    };
    fetchStats();
    const id = setInterval(fetchStats, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const total = (panelCounts.terminal || 0) + (panelCounts.browser || 0) +
                (panelCounts.notes || 0) + (panelCounts.files || 0);

  return (
    <div className="status-banner">
      <span className="status-item status-ws" title="Current workspace">
        <span className="status-label">WS</span>
        <span className="status-value">{workspaceName}</span>
        <span className="status-sub">
          {workspaceIndex}/{workspaceTotal}
        </span>
      </span>

      <span className="status-item" title="Panels on this workspace">
        <span className="status-label">P</span>
        <span className="status-value">{total}</span>
        <span className="status-sub">
          {panelCounts.terminal || 0}t · {panelCounts.browser || 0}b · {panelCounts.notes || 0}n · {panelCounts.files || 0}f
        </span>
      </span>

      {focusedType && (
        <span className="status-item" title="Focused panel type">
          <span className="status-label">F</span>
          <span className="status-value">{focusedType}</span>
        </span>
      )}

      {stats && (
        <span
          className={`status-item ${stats.mem.pct > 85 ? 'status-warn' : ''}`}
          title={`Memory: ${stats.mem.usedMB} / ${stats.mem.totalMB} MB`}
        >
          <span className="status-label">MEM</span>
          <span className="status-value">{stats.mem.pct}%</span>
        </span>
      )}

      {stats && (
        <span className="status-item" title={`Load average (1m) — ${stats.cpu.count} cores`}>
          <span className="status-label">CPU</span>
          <span className="status-value">{stats.cpu.load1.toFixed(2)}</span>
        </span>
      )}

      {stats && (
        <span className="status-item" title="System uptime">
          <span className="status-label">UP</span>
          <span className="status-value">{formatUptime(stats.uptimeSec)}</span>
        </span>
      )}

      <span className="status-spacer" />

      <span className="status-item" title="Theme">
        <span className="status-label">T</span>
        <span className="status-value">{themeLabel}</span>
      </span>

      <span
        className={`status-item ${online ? 'status-ok' : 'status-warn'}`}
        title={online ? 'Online' : 'Offline'}
      >
        <span className="status-dot" />
        <span className="status-value">{online ? 'online' : 'offline'}</span>
      </span>

      <span className="status-item status-clock" title={now.toLocaleString()}>
        {formatTime(now)}
      </span>
    </div>
  );
}
