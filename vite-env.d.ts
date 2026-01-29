/// <reference types="vite/client" />

interface ElectronAPI {
    readFile: (path: string) => Promise<string>;
    streamReadFile: (path: string) => Promise<{ status: string }>; // ✅ Updated to match usage
    onFileChunk: (callback: (chunk: string) => void) => () => void;
    onFileStreamComplete: (callback: () => void) => () => void;
    onFileStreamError: (callback: (err: string) => void) => () => void; // ✅ Updated parameter type
    setZoomFactor: (factor: number) => void;
    getZoomFactor: () => number;
    copyToClipboard: (text: string) => Promise<void>;
    saveFile: (content: string) => Promise<{ status: string, filePath?: string }>; // ✅ Updated return type
    saveBinaryFile: (data: Uint8Array, fileName: string) => Promise<string>;
    openExternal: (url: string) => Promise<{ status: string, error?: string }>; // ✅ Updated return type
    fetchUrl: (url: string, options: any) => Promise<string>;
    getAppPath: () => Promise<string>;
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
