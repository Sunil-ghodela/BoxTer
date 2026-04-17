import React, { useEffect, useState, useMemo } from 'react';
import { listActivity, subscribeActivity, clearActivity } from '../utils/activityLog.js';

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'panel',     label: 'Panels' },
  { id: 'workspace', label: 'Workspaces' },
  { id: 'content',   label: 'Content' },
  { id: 'ui',        label: 'UI' },
];

const CATEGORY_ICONS = {
  panel:     'P',
  workspace: 'W',
  content:   '#',
  ui:        'U',
  session:   'S',
  other:     '·',
};

const formatRelative = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
};

const formatTime = (ts) => {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function ActivityTimeline({ onNavigate, onClose }) {
  const [entries, setEntries] = useState(() => listActivity());
  const [filter, setFilter] = useState('all');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeActivity(setEntries);
    return unsubscribe;
  }, []);

  // Refresh relative timestamps every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.category === filter);
  }, [entries, filter]);

  const counts = useMemo(() => {
    const c = {};
    entries.forEach((e) => { c[e.category] = (c[e.category] || 0) + 1; });
    c.all = entries.length;
    return c;
  }, [entries]);

  const handleClick = (entry) => {
    if (entry.workspaceId && onNavigate) {
      onNavigate({ workspaceId: entry.workspaceId, panelId: entry.panelId });
    }
  };

  return (
    <div className="activity-panel" role="region" aria-label="Activity timeline">
      <div className="activity-header">
        <div className="activity-title">
          <span className="activity-dot" />
          <span>Activity</span>
          <span className="activity-count">{entries.length}</span>
        </div>
        <div className="activity-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`activity-chip${filter === f.id ? ' activity-chip-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {counts[f.id === 'all' ? 'all' : f.id] ? (
                <span className="activity-chip-count">{counts[f.id === 'all' ? 'all' : f.id]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="activity-actions">
          <button
            className="activity-btn"
            onClick={() => { clearActivity(); }}
            title="Clear all"
          >
            clear
          </button>
          <button className="activity-btn" onClick={onClose} title="Hide (Alt+H)">x</button>
        </div>
      </div>

      <div className="activity-list" data-tick={tick}>
        {filtered.length === 0 ? (
          <div className="activity-empty">
            {filter === 'all'
              ? 'No activity yet — open panels, edit notes, switch workspaces to see events here.'
              : 'No events match this filter.'}
          </div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className={`activity-row${e.workspaceId ? ' activity-row-link' : ''}`}
              onClick={() => handleClick(e)}
              title={new Date(e.timestamp).toLocaleString()}
            >
              <span className={`activity-cat activity-cat-${e.category}`}>
                {CATEGORY_ICONS[e.category] || '·'}
              </span>
              <span className="activity-time">{formatTime(e.timestamp)}</span>
              <span className="activity-rel">{formatRelative(e.timestamp)}</span>
              <span className="activity-text">
                {e.title}
                {e.detail ? <span className="activity-detail"> — {e.detail}</span> : null}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
