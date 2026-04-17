// Build a unified search index over workspaces, panels, notes content,
// browser URLs, and files. Everything is collected into flat items with a
// lowercased `haystack` string for substring matching.

const TYPE_LABELS = {
  terminal: 'Terminal',
  browser:  'Browser',
  notes:    'Notes',
  files:    'Files',
};

const snippet = (text, q, len = 100) => {
  if (!text) return '';
  if (!q) return text.slice(0, len).replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const i = lower.indexOf(q);
  if (i < 0) return text.slice(0, len).replace(/\s+/g, ' ');
  const start = Math.max(0, i - 30);
  const end = Math.min(text.length, i + q.length + 60);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return (prefix + text.slice(start, end) + suffix).replace(/\s+/g, ' ');
};

export async function buildSearchIndex(workspaces) {
  const items = [];

  workspaces.forEach((ws) => {
    // Workspace itself
    items.push({
      id: `ws:${ws.id}`,
      category: 'Workspace',
      title: ws.name,
      subtitle: `${ws.panels.length} panel${ws.panels.length === 1 ? '' : 's'}`,
      haystack: (ws.name || '').toLowerCase(),
      workspaceId: ws.id,
      panelId: null,
    });

    ws.panels.forEach((p) => {
      const label = p.name || TYPE_LABELS[p.type] || p.type;
      // Panel entry
      items.push({
        id: `panel:${p.id}`,
        category: 'Panel',
        title: label,
        subtitle: `${TYPE_LABELS[p.type] || p.type} · ${ws.name}`,
        haystack: `${label} ${p.type}`.toLowerCase(),
        workspaceId: ws.id,
        panelId: p.id,
      });

      if (p.type === 'notes') {
        let content = '';
        try { content = localStorage.getItem(`boxter-notes-${p.id}`) || ''; } catch { /* ignore */ }
        if (content.trim()) {
          items.push({
            id: `notes:${p.id}`,
            category: 'Notes',
            title: label,
            body: content,
            subtitle: `${ws.name}`,
            haystack: content.toLowerCase(),
            workspaceId: ws.id,
            panelId: p.id,
          });
        }
      }

      if (p.type === 'browser') {
        let url = '';
        try { url = localStorage.getItem(`boxter-browser-${p.id}`) || ''; } catch { /* ignore */ }
        if (url) {
          items.push({
            id: `url:${p.id}`,
            category: 'URL',
            title: url,
            subtitle: `${label} · ${ws.name}`,
            haystack: url.toLowerCase(),
            workspaceId: ws.id,
            panelId: p.id,
          });
        }
      }
    });
  });

  // Files (async, via IPC)
  const fileJobs = [];
  workspaces.forEach((ws) => {
    ws.panels.filter((p) => p.type === 'files').forEach((p) => {
      const label = p.name || 'Files';
      fileJobs.push(
        window.boxterAPI?.files?.list(p.id)
          .then((files) => {
            (files || []).forEach((f) => {
              items.push({
                id: `file:${p.id}:${f.name}`,
                category: 'File',
                title: f.name,
                subtitle: `${label} · ${ws.name}`,
                haystack: (f.name || '').toLowerCase(),
                workspaceId: ws.id,
                panelId: p.id,
              });
            });
          })
          .catch(() => {})
      );
    });
  });
  await Promise.all(fileJobs);

  return items;
}

export function searchIndex(index, rawQuery) {
  const q = (rawQuery || '').trim().toLowerCase();
  if (!q) {
    return index
      .filter((i) => i.category === 'Workspace' || i.category === 'Panel')
      .slice(0, 40)
      .map((i) => ({ ...i, score: 0 }));
  }

  const results = [];
  for (const item of index) {
    const h = item.haystack;
    const idx = h.indexOf(q);
    if (idx < 0) continue;
    let score = 2000 - idx * 2;
    if (h === q) score += 1500;
    else if (h.startsWith(q)) score += 900;
    // Prefer exact word boundary
    const before = idx === 0 ? ' ' : h[idx - 1];
    if (/[\s\W]/.test(before)) score += 300;
    // Category weighting: structural results rank above raw content
    if (item.category === 'Panel' || item.category === 'Workspace') score += 250;
    if (item.category === 'URL') score += 100;
    if (item.category === 'Notes') score -= 50;

    const snip = item.body ? snippet(item.body, q) : null;
    results.push({ ...item, score, matchIndex: idx, snippet: snip });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 60);
}
