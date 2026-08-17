const { contextBridge, ipcRenderer, webUtils } = require('electron');

const validActions = new Set(['minimize', 'maximize', 'close']);

contextBridge.exposeInMainWorld('hdzero', {
  selectVideos: () => ipcRenderer.invoke('select-videos'),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
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
