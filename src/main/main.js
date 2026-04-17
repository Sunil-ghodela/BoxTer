const { app, BrowserWindow, ipcMain, shell, Menu, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const pty = require('@lydell/node-pty');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const store = new Store({ name: 'boxter-sessions' });
const terminals = new Map();
let mainWindow;

const isDev = !app.isPackaged;

const filesRoot = () => path.join(app.getPath('userData'), 'boxter-files');
const sanitizeId = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_');
const sanitizeName = (s) => {
  const base = path.basename(String(s || 'file'));
  return base.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 200) || 'file';
};
const panelDir = (panelId) => path.join(filesRoot(), sanitizeId(panelId));
const uniquePath = (dir, name) => {
  let candidate = path.join(dir, name);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let i = 1;
  while (fs.existsSync(path.join(dir, `${stem} (${i})${ext}`))) i++;
  return path.join(dir, `${stem} (${i})${ext}`);
};

// Auto-update events — forward to renderer for the in-app banner.
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update:available', { version: info.version });
});
autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update:downloaded', { version: info.version });
});
autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update:error', err?.message || String(err));
});

ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
ipcMain.on('update:check', () => { autoUpdater.checkForUpdates().catch(() => {}); });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'BoxTer',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  attachContextMenu(mainWindow.webContents);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function attachContextMenu(contents) {
  contents.on('context-menu', (_event, params) => {
    const { editFlags = {}, isEditable, selectionText, misspelledWord, dictionarySuggestions } = params;
    const hasText = !!(selectionText && selectionText.trim());
    const items = [];

    if (misspelledWord && Array.isArray(dictionarySuggestions) && dictionarySuggestions.length) {
      for (const s of dictionarySuggestions.slice(0, 5)) {
        items.push({ label: s, click: () => contents.replaceMisspelling(s) });
      }
      items.push({ type: 'separator' });
    }

    items.push(
      { label: 'Cut',   accelerator: 'CmdOrCtrl+X', enabled: !!editFlags.canCut,   click: () => contents.cut() },
      { label: 'Copy',  accelerator: 'CmdOrCtrl+C', enabled: !!editFlags.canCopy || hasText, click: () => contents.copy() },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', enabled: !!editFlags.canPaste, click: () => contents.paste() },
      { type: 'separator' },
      { label: 'Select All', accelerator: 'CmdOrCtrl+A', enabled: !!editFlags.canSelectAll, click: () => contents.selectAll() },
    );

    if (params.linkURL) {
      items.unshift(
        { label: 'Open Link', click: () => shell.openExternal(params.linkURL) },
        { label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }

    if (isDev) {
      items.push(
        { type: 'separator' },
        { label: 'Inspect Element', click: () => contents.inspectElement(params.x, params.y) },
      );
    }

    const hasEnabled = items.some((i) => i.type !== 'separator' && i.enabled !== false);
    if (!hasEnabled && !isDev) return;

    Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(contents) || mainWindow });
  });
}

// Propagate the context menu to embedded <webview> contents (browser panel).
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType && contents.getType() === 'webview') {
    attachContextMenu(contents);
  }
});

// Terminal management via IPC
ipcMain.handle('terminal:create', (event, { id, cols, rows }) => {
  const shellPath = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
  const term = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: os.homedir(),
    env: process.env,
  });

  term.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', { id, data });
    }
  });

  term.onExit(() => {
    terminals.delete(id);
  });

  terminals.set(id, term);
  return { pid: term.pid };
});

ipcMain.on('terminal:write', (event, { id, data }) => {
  const term = terminals.get(id);
  if (term) term.write(data);
});

ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
  const term = terminals.get(id);
  if (term) {
    try { term.resize(cols, rows); } catch (e) { /* ignore resize errors */ }
  }
});

ipcMain.on('terminal:kill', (event, { id }) => {
  const term = terminals.get(id);
  if (term) {
    term.kill();
    terminals.delete(id);
  }
});

// Session persistence
ipcMain.handle('session:save', (event, { name, data }) => {
  const sessions = store.get('sessions', {});
  sessions[name] = { ...data, savedAt: Date.now() };
  store.set('sessions', sessions);
  return true;
});

ipcMain.handle('session:load', (event, { name }) => {
  const sessions = store.get('sessions', {});
  return sessions[name] || null;
});

ipcMain.handle('session:list', () => {
  const sessions = store.get('sessions', {});
  return Object.keys(sessions).map((name) => ({
    name,
    savedAt: sessions[name].savedAt,
  }));
});

ipcMain.handle('session:delete', (event, { name }) => {
  const sessions = store.get('sessions', {});
  delete sessions[name];
  store.set('sessions', sessions);
  return true;
});

// Open external links
ipcMain.on('open:external', (event, url) => {
  shell.openExternal(url);
});

// System stats (for StatusBanner)
ipcMain.handle('system:stats', () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    mem: {
      totalMB: Math.round(total / 1048576),
      usedMB: Math.round(used / 1048576),
      pct: Math.round((used / total) * 100),
    },
    cpu: {
      count: os.cpus().length,
      load1: os.loadavg()[0],
    },
    uptimeSec: Math.floor(os.uptime()),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    terminals: terminals.size,
    appVersion: app.getVersion(),
  };
});

// --- File-drop panel storage ---------------------------------------------
// Files are kept under userData/boxter-files/<panelId>/. All paths are
// normalized + confined to that directory to avoid traversal.
const assertInside = (dir, target) => {
  const rel = path.relative(dir, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('path escapes panel directory');
  }
};

ipcMain.handle('files:list', async (_e, { panelId }) => {
  const dir = panelDir(panelId);
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const full = path.join(dir, ent.name);
      const stat = await fsp.stat(full);
      out.push({
        name: ent.name,
        size: stat.size,
        mtime: stat.mtimeMs,
        path: full,
      });
    }
    out.sort((a, b) => b.mtime - a.mtime);
    return out;
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
});

ipcMain.handle('files:save', async (_e, { panelId, name, data }) => {
  const dir = panelDir(panelId);
  await fsp.mkdir(dir, { recursive: true });
  const clean = sanitizeName(name);
  const target = uniquePath(dir, clean);
  assertInside(dir, target);
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await fsp.writeFile(target, buf);
  const stat = await fsp.stat(target);
  return { name: path.basename(target), size: stat.size, mtime: stat.mtimeMs, path: target };
});

ipcMain.handle('files:importPaths', async (_e, { panelId, paths }) => {
  const dir = panelDir(panelId);
  await fsp.mkdir(dir, { recursive: true });
  const out = [];
  for (const src of paths || []) {
    try {
      const stat = await fsp.stat(src);
      if (!stat.isFile()) continue;
      const target = uniquePath(dir, sanitizeName(path.basename(src)));
      assertInside(dir, target);
      await fsp.copyFile(src, target);
      const s = await fsp.stat(target);
      out.push({ name: path.basename(target), size: s.size, mtime: s.mtimeMs, path: target });
    } catch (err) { /* skip bad entries */ }
  }
  return out;
});

ipcMain.handle('files:delete', async (_e, { panelId, name }) => {
  const dir = panelDir(panelId);
  const target = path.join(dir, sanitizeName(name));
  assertInside(dir, target);
  try { await fsp.unlink(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return true;
});

ipcMain.handle('files:rename', async (_e, { panelId, oldName, newName }) => {
  const dir = panelDir(panelId);
  const from = path.join(dir, sanitizeName(oldName));
  const to = uniquePath(dir, sanitizeName(newName));
  assertInside(dir, from);
  assertInside(dir, to);
  await fsp.rename(from, to);
  const s = await fsp.stat(to);
  return { name: path.basename(to), size: s.size, mtime: s.mtimeMs, path: to };
});

ipcMain.handle('files:readDataUrl', async (_e, { panelId, name, mime }) => {
  const dir = panelDir(panelId);
  const target = path.join(dir, sanitizeName(name));
  assertInside(dir, target);
  const buf = await fsp.readFile(target);
  const m = mime || 'application/octet-stream';
  return `data:${m};base64,${buf.toString('base64')}`;
});

ipcMain.on('files:open', (_e, { panelId, name }) => {
  const dir = panelDir(panelId);
  const target = path.join(dir, sanitizeName(name));
  try { assertInside(dir, target); shell.openPath(target); } catch (err) { /* ignore */ }
});

ipcMain.on('files:reveal', (_e, { panelId, name }) => {
  const dir = panelDir(panelId);
  const target = path.join(dir, sanitizeName(name));
  try { assertInside(dir, target); shell.showItemInFolder(target); } catch (err) { /* ignore */ }
});

ipcMain.handle('files:purgePanel', async (_e, { panelId }) => {
  const dir = panelDir(panelId);
  try { await fsp.rm(dir, { recursive: true, force: true }); } catch (err) { /* ignore */ }
  return true;
});

app.whenReady().then(() => {
  createWindow();
  if (!isDev) {
    autoUpdater.checkForUpdates().catch(() => {});
  }
});

app.on('window-all-closed', () => {
  // Kill all terminals
  for (const [id, term] of terminals) {
    term.kill();
  }
  terminals.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
