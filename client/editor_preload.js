const { contextBridge, ipcRenderer } = require('electron');

const validActions = new Set(['minimize', 'maximize', 'close']);

contextBridge.exposeInMainWorld('videoEditor', {
  goBack: () => ipcRenderer.invoke('close-editor'),
  generatePreview: (request) => ipcRenderer.invoke('generate-preview', request),
  saveCustomSettings: (settings) => ipcRenderer.invoke('save-custom-settings', settings),
  useAsGlobalSettings: (settings) => ipcRenderer.invoke('use-as-global-settings', settings),
  clearCustomSettings: () => ipcRenderer.invoke('clear-custom-settings'),
  onTransitionStart: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('editor-start-transition', listener);
    return () => ipcRenderer.removeListener('editor-start-transition', listener);
  },
  onCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('editor-request-close', listener);
    return () => ipcRenderer.removeListener('editor-request-close', listener);
  },
  onInit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('editor-init', listener);
    return () => ipcRenderer.removeListener('editor-init', listener);
  },
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('preview-progress', listener);
    return () => ipcRenderer.removeListener('preview-progress', listener);
  },
  onGlobalSettings: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('editor-global-settings-updated', listener);
    return () => ipcRenderer.removeListener('editor-global-settings-updated', listener);
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
