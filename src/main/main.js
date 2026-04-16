const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const pty = require('@lydell/node-pty');
const Store = require('electron-store');

const store = new Store({ name: 'boxter-sessions' });
const terminals = new Map();
let mainWindow;

const isDev = !app.isPackaged;

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

app.whenReady().then(createWindow);

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
