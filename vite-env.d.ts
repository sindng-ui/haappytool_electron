/// <reference types="vite/client" />

interface ElectronAPI {
    readFile: (path: string) => Promise<string>;
    getFileSize: (path: string) => Promise<number>;
    readFileSegment: (args: { path: string, start: number, end: number }) => Promise<Uint8Array>;
    streamReadFile: (path: string, requestId: string, options?: { start?: number }) => Promise<{ status: string; requestId: string }>;
    cancelStream: (requestId: string) => Promise<{ status: string; requestId: string }>;
    onFileChunk: (callback: (data: { chunk: string; requestId: string }) => void) => () => void;
    onFileStreamComplete: (callback: (data: { requestId: string }) => void) => () => void;
    onFileStreamError: (callback: (data: { error: string; requestId: string }) => void) => () => void;
    setZoomFactor: (factor: number) => void;
    getZoomFactor: () => number;
    copyToClipboard: (text: string) => Promise<void>;
    saveFile: (content: string) => Promise<{ status: string, filePath?: string }>; // ✅ Updated return type
    saveBinaryFile: (data: Uint8Array, fileName: string) => Promise<string>;
    openExternal: (url: string) => Promise<{ status: string, error?: string }>; // ✅ Updated return type
    fetchUrl: (url: string, options: any) => Promise<string>;
    proxyRequest: (request: { method: string; url: string; headers: any; body: any }) => Promise<{ status: number; statusText: string; headers: any; data: any; error?: boolean; message?: string }>;
    getAppPath: () => Promise<string>;
    validateRoslyn: (code: string) => Promise<{ isValid: boolean; error?: string }>;
    parseRxCode: (code: string) => Promise<{ isValid: boolean; error?: string }>;
    toggleFullscreen: (flag: boolean) => Promise<void>;
    getStartupStatus: () => Promise<any>;
    splashReady: () => void;
    saveFileDirect: (data: Uint8Array, filePath: string) => Promise<{ status: string; filePath?: string; error?: string }>;

    // Loading events
    on?: (channel: 'loading-progress' | 'loading-log' | 'loading-complete', callback: (...args: any[]) => void) => (() => void) | undefined;
    off?: (channel: 'loading-progress' | 'loading-log' | 'loading-complete', callback: (...args: any[]) => void) => void;
    // File Path Helper
    getFilePath?: (file: File) => string;

    // --- CLI IPC ---
    onCliCommand: (callback: (data: any) => void) => () => void;
    cliReady: () => void;
    cliStdout: (msg: string) => void;
    cliStderr: (msg: string) => void;
    cliExit: (code: number) => void;

    // --- Settings Sync ---
    saveSettingsToFile: (settings: any) => Promise<{ status: string }>;
    getCliSettings: () => Promise<any>;

    // --- SDB Helper ---
    runSdbCommand: (cmd: string) => Promise<{ stdout?: string; error?: boolean; message?: string }>;
}

interface Window {
    electronAPI?: ElectronAPI;
}

declare const __APP_VERSION__: string;

declare module '*.png' {
    const value: string;
    export default value;
}

declare module '*.jpg' {
    const value: string;
    export default value;
}

declare module '*.svg' {
    import React = require('react');
    export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
    const src: string;
    export default src;
}
