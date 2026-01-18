/// <reference types="vite/client" />

interface ElectronAPI {
    readFile: (path: string) => Promise<string>;
    streamReadFile: (path: string) => Promise<void>;
    onFileChunk: (callback: (chunk: string) => void) => () => void;
    onFileStreamComplete: (callback: () => void) => () => void;
    onFileStreamError: (callback: (error: any) => void) => () => void;
    setZoomFactor: (factor: number) => void;
    getZoomFactor: () => number;
    copyToClipboard: (text: string) => Promise<void>;
    saveFile: (content: string) => Promise<string>;
    saveBinaryFile: (data: Uint8Array, fileName: string) => Promise<string>;
    openExternal: (url: string) => Promise<void>;
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
