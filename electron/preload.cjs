const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (path) => ipcRenderer.invoke('readFile', path),
    getFileSize: (path) => ipcRenderer.invoke('getFileSize', path),
    readFileSegment: (args) => ipcRenderer.invoke('readFileSegment', args),
    streamReadFile: (path, requestId, options) => ipcRenderer.invoke('streamReadFile', path, requestId, options),
    cancelStream: (requestId) => ipcRenderer.invoke('cancelStream', requestId),
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
    saveNupkgFile: (data, fileName) => ipcRenderer.invoke('saveNupkgFile', { data, fileName }),
    autoSignSoFile: (filePath) => ipcRenderer.invoke('nupkg-auto-sign-so', { filePath }),
    openIsmsLogin: () => ipcRenderer.invoke('open-isms-login'),
    saveFileDirect: (data, filePath, isBase64) => ipcRenderer.invoke('saveFileDirect', { data, filePath, isBase64 }),
    appendFileDirect: (data, filePath) => ipcRenderer.invoke('appendFileDirect', { data, filePath }),
    openExternal: (url) => ipcRenderer.invoke('openExternal', url),
    fetchUrl: (url, type) => ipcRenderer.invoke('fetchUrl', { url, type }),
    proxyRequest: (request) => ipcRenderer.invoke('proxyRequest', request),
    streamProxyRequest: (request) => ipcRenderer.invoke('streamProxyRequest', request),
    onProxyDataChunk: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('proxy-data-chunk', subscription);
        return () => ipcRenderer.removeListener('proxy-data-chunk', subscription);
    },
    onProxyStreamComplete: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('proxy-stream-complete', subscription);
        return () => ipcRenderer.removeListener('proxy-stream-complete', subscription);
    },
    onProxyStreamError: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('proxy-stream-error', subscription);
        return () => ipcRenderer.removeListener('proxy-stream-error', subscription);
    },

    getAppPath: () => ipcRenderer.invoke('getAppPath'),
    validateRoslyn: (code) => ipcRenderer.invoke('validateRoslyn', code),
    validateRoslyn: (code) => ipcRenderer.invoke('validateRoslyn', code),
    parseRxCode: (code) => ipcRenderer.invoke('parseRxCode', code),
    toggleFullscreen: (flag) => ipcRenderer.invoke('toggle-fullscreen', flag),
    getStartupStatus: () => ipcRenderer.invoke('get-startup-status'),
    splashReady: () => ipcRenderer.send('splash-ready'),

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
    },

    // ✅ CLI Methods
    onCliCommand: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('cli-run-command', subscription);
        return () => ipcRenderer.removeListener('cli-run-command', subscription);
    },
    cliReady: () => ipcRenderer.send('cli-ready'),
    cliStdout: (msg) => ipcRenderer.send('cli-stdout', msg),
    cliStderr: (msg) => ipcRenderer.send('cli-stderr', msg),
    cliExit: (code) => ipcRenderer.send('cli-exit', code),

    // ✅ Settings Sync
    saveSettingsToFile: (settings) => ipcRenderer.invoke('save-settings-file', settings),
    getCliSettings: () => ipcRenderer.invoke('get-cli-settings'),

    // ✅ SDB Helper
    runSdbCommand: (cmd) => ipcRenderer.invoke('run-sdb-command', cmd),

    // ✅ RAG Server Helper
    startRagServer: () => ipcRenderer.invoke('start-rag-server')
});

// ✅ Enforce Strict Zoom Limits globally to prevent native browser zoom from interfering with custom UI scaling
// This ensures that Ctrl+Wheel DOES NOT change the browser's viewport scale (which affects kerning/tracking),
// but allows our custom application logic to handle font size changes.
require('electron').webFrame.setVisualZoomLevelLimits(1, 1);
