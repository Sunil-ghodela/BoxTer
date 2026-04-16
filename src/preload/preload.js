const { contextBridge, ipcRenderer } = require('electron');

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

  // External
  openExternal: (url) => ipcRenderer.send('open:external', url),

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
