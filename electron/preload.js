const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (path) => ipcRenderer.invoke('readFile', path),
    streamReadFile: (path, requestId) => ipcRenderer.invoke('streamReadFile', path, requestId),
    onFileChunk: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('file-chunk', subscription);
        return () => ipcRenderer.removeListener('file-chunk', subscription);
    },
    onFileStreamComplete: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('file-stream-complete', subscription);
        return () => ipcRenderer.removeListener('file-stream-complete', subscription);
    },
    onFileStreamError: (callback) => {
        const subscription = (_event, data) => callback(data);
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
    proxyRequest: (request) => ipcRenderer.invoke('proxyRequest', request),
    getAppPath: () => ipcRenderer.invoke('getAppPath'),
    validateRoslyn: (code) => ipcRenderer.invoke('validateRoslyn', code),
    parseRxCode: (code) => ipcRenderer.invoke('parseRxCode', code),

    // Loading events
    on: (channel, callback) => {
        const validChannels = ['loading-progress', 'loading-log', 'loading-complete'];
        if (validChannels.includes(channel)) {
            const subscription = (_event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
    },
    off: (channel, callback) => {
        const validChannels = ['loading-progress', 'loading-log', 'loading-complete'];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeListener(channel, callback);
        }
    },
    // ✅ File Path Helper (Required for Context Isolation)
    getFilePath: (file) => {
        const { webUtils } = require('electron');
        return webUtils.getPathForFile(file);
    }
});
