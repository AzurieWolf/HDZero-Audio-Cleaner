const { contextBridge, ipcRenderer, webUtils } = require('electron');

const validActions = new Set(['minimize', 'maximize', 'close']);

contextBridge.exposeInMainWorld('hdzero', {
  selectVideos: () => ipcRenderer.invoke('select-videos'),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openEditor: (payload) => ipcRenderer.invoke('open-editor', payload),
  requestEditorBack: () => ipcRenderer.send('request-editor-back'),
  requestSettings: () => ipcRenderer.send('request-settings'),
  setTheme: (theme) => ipcRenderer.send('theme-changed', theme),
  processQueue: (payload) => ipcRenderer.invoke('process-queue', payload),
  cancel: () => ipcRenderer.send('cancel-processing'),
  pathFromFile: (file) => webUtils.getPathForFile(file),
  onProgress: (callback) => {
    const listener = (_event, update) => callback(update);
    ipcRenderer.on('processing-progress', listener);
    return () => ipcRenderer.removeListener('processing-progress', listener);
  },
  onFinished: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('processing-finished', listener);
    return () => ipcRenderer.removeListener('processing-finished', listener);
  },
  onCustomSettings: (callback) => {
    const listener = (_event, update) => callback(update);
    ipcRenderer.on('custom-settings-updated', listener);
    return () => ipcRenderer.removeListener('custom-settings-updated', listener);
  },
  onGlobalSettings: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('global-settings-updated', listener);
    return () => ipcRenderer.removeListener('global-settings-updated', listener);
  },
  onEditorVisibility: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on('editor-visibility-changed', listener);
    return () => ipcRenderer.removeListener('editor-visibility-changed', listener);
  },
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('open-settings', listener);
    return () => ipcRenderer.removeListener('open-settings', listener);
  },
  onThemeChanged: (callback) => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
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
