const { contextBridge, ipcRenderer } = require('electron');

const validActions = new Set(['minimize', 'maximize', 'close']);

contextBridge.exposeInMainWorld('videoEditor', {
  generatePreview: (request) => ipcRenderer.invoke('generate-preview', request),
  saveCustomSettings: (settings) => ipcRenderer.invoke('save-custom-settings', settings),
  clearCustomSettings: () => ipcRenderer.invoke('clear-custom-settings'),
  onInit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('editor-init', listener);
    return () => ipcRenderer.removeListener('editor-init', listener);
  },
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('preview-progress', listener);
    return () => ipcRenderer.removeListener('preview-progress', listener);
  }
});

contextBridge.exposeInMainWorld('windowControls', {
  perform: (action) => { if (validActions.has(action)) ipcRenderer.send('window-control', action); },
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window-state-changed', listener);
    return () => ipcRenderer.removeListener('window-state-changed', listener);
  }
});
