const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (path) => ipcRenderer.invoke('readFile', path),
    streamReadFile: (path) => ipcRenderer.invoke('streamReadFile', path),
    onFileChunk: (callback) => {
        const subscription = (_event, chunk) => callback(chunk);
        ipcRenderer.on('file-chunk', subscription);
        return () => ipcRenderer.removeListener('file-chunk', subscription);
    },
    onFileStreamComplete: (callback) => {
        const subscription = (_event, ...args) => callback(...args);
        ipcRenderer.on('file-stream-complete', subscription);
        return () => ipcRenderer.removeListener('file-stream-complete', subscription);
    },
    onFileStreamError: (callback) => {
        const subscription = (_event, err) => callback(err);
        ipcRenderer.on('file-stream-error', subscription);
        return () => ipcRenderer.removeListener('file-stream-error', subscription);
    },
    setZoomFactor: (factor) => require('electron').webFrame.setZoomFactor(factor),
    getZoomFactor: () => require('electron').webFrame.getZoomFactor(),
    copyToClipboard: (text) => ipcRenderer.invoke('copyToClipboard', text),
    saveFile: (content) => ipcRenderer.invoke('saveFile', content),
    saveBinaryFile: (data, fileName) => ipcRenderer.invoke('saveBinaryFile', { data, fileName }),
    openExternal: (url) => ipcRenderer.invoke('openExternal', url),
    fetchUrl: (url, type) => ipcRenderer.invoke('fetchUrl', { url, type }),
    getAppPath: () => ipcRenderer.invoke('getAppPath'),
    validateRoslyn: (code) => ipcRenderer.invoke('validateRoslyn', code)
});
