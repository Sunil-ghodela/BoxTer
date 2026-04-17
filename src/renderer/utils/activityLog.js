// Simple activity log: ring buffer in localStorage, pub/sub for live updates.

const STORAGE_KEY = 'boxter-activity-log';
const MAX_ENTRIES = 200;

const listeners = new Set();
let cache = null;

const load = () => {
  if (cache !== null) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cache)) cache = [];
  } catch {
    cache = [];
  }
  return cache;
};

const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
};

const notify = () => {
  listeners.forEach((cb) => { try { cb(cache.slice()); } catch { /* ignore */ } });
};

let idCounter = 0;
const genId = () => `${Date.now()}-${++idCounter}`;

export function logActivity(entry) {
  load();
  const full = {
    id: genId(),
    timestamp: Date.now(),
    category: 'other',
    ...entry,
  };
  cache.unshift(full);
  if (cache.length > MAX_ENTRIES) cache.length = MAX_ENTRIES;
  persist();
  notify();
  return full;
}

export function listActivity() {
  return load().slice();
}

export function clearActivity() {
  cache = [];
  persist();
  notify();
}

export function subscribeActivity(cb) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
