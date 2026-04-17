const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('boxterAPI', {
  // Terminal
  terminal: {
    create: (id, cols, rows) => ipcRenderer.invoke('terminal:create', { id, cols, rows }),
    write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.send('terminal:kill', { id }),
    onData: (callback) => {
      const listener = (event, payload) => callback(payload.id, payload.data);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
  },

  // Sessions
  session: {
    save: (name, data) => ipcRenderer.invoke('session:save', { name, data }),
    load: (name) => ipcRenderer.invoke('session:load', { name }),
    list: () => ipcRenderer.invoke('session:list'),
    delete: (name) => ipcRenderer.invoke('session:delete', { name }),
  },

  // Files (file-drop panel)
  files: {
    list: (panelId) => ipcRenderer.invoke('files:list', { panelId }),
    save: (panelId, name, data) => ipcRenderer.invoke('files:save', { panelId, name, data }),
    importPaths: (panelId, paths) => ipcRenderer.invoke('files:importPaths', { panelId, paths }),
    delete: (panelId, name) => ipcRenderer.invoke('files:delete', { panelId, name }),
    rename: (panelId, oldName, newName) => ipcRenderer.invoke('files:rename', { panelId, oldName, newName }),
    readDataUrl: (panelId, name, mime) => ipcRenderer.invoke('files:readDataUrl', { panelId, name, mime }),
    open: (panelId, name) => ipcRenderer.send('files:open', { panelId, name }),
    reveal: (panelId, name) => ipcRenderer.send('files:reveal', { panelId, name }),
    purgePanel: (panelId) => ipcRenderer.invoke('files:purgePanel', { panelId }),
    // Resolve a File object dropped from the OS to its on-disk path.
    // Returns '' for files that came from memory (e.g. pasted from clipboard).
    pathForFile: (file) => {
      try { return webUtils.getPathForFile(file) || ''; } catch { return ''; }
    },
  },

  // External
  openExternal: (url) => ipcRenderer.send('open:external', url),

  // System
  system: {
    stats: () => ipcRenderer.invoke('system:stats'),
  },

  // Auto-updater
  updater: {
    onAvailable: (cb) => {
      const listener = (_, info) => cb(info);
      ipcRenderer.on('update:available', listener);
      return () => ipcRenderer.removeListener('update:available', listener);
    },
    onDownloaded: (cb) => {
      const listener = (_, info) => cb(info);
      ipcRenderer.on('update:downloaded', listener);
      return () => ipcRenderer.removeListener('update:downloaded', listener);
    },
    onError: (cb) => {
      const listener = (_, msg) => cb(msg);
      ipcRenderer.on('update:error', listener);
      return () => ipcRenderer.removeListener('update:error', listener);
    },
    installAndRestart: () => ipcRenderer.send('update:install'),
    checkNow: () => ipcRenderer.send('update:check'),
  },
});
