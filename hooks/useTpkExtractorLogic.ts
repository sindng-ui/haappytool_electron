import React, { useState, useCallback } from 'react';
import { extractTpkFromRpm } from '../utils/rpmParser';

export type TpkStatus = 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export interface UseTpkExtractorLogicReturn {
    status: TpkStatus;
    fileName: string;
    resultPath: string;
    logs: string[];
    progressStep: number;
    dragActive: boolean;
    handleDrag: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => void;
    handleDownload: () => void;
    reset: () => void;
    processFile: (file: File) => Promise<void>;
    processUrl: (url: string) => Promise<void>;
}

export const useTpkExtractorLogic = (): UseTpkExtractorLogicReturn => {
    const [dragActive, setDragActive] = useState(false);
    const [status, setStatus] = useState<TpkStatus>('IDLE');
    const [fileName, setFileName] = useState('');
    const [resultPath, setResultPath] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [progressStep, setProgressStep] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string>('');
    const [downloadName, setDownloadName] = useState('');
    const [resultBlob, setResultBlob] = useState<Blob | null>(null);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const processFile = async (file: File) => {
        setStatus('PROCESSING');
        setProgressStep(1);
        setLogs([]);
        setFileName(file.name);
        setResultBlob(null);
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl('');

        try {
            addLog(`Analyzing file: ${file.name}`);

            const result = await extractTpkFromRpm(file, (msg, step) => {
                addLog(msg);
                setProgressStep(step);
            });

            const blob = new Blob([result.data as BlobPart], { type: 'application/octet-stream' });
            setResultBlob(blob);

            const finalName = result.name;
            setDownloadName(finalName);

            // Create URL for fallback immediately
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);

            // Handle Save via Electron IPC
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.saveBinaryFile) {
                addLog("Prompting to save...");
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);

                    // @ts-ignore
                    const result = await window.electronAPI.saveBinaryFile(uint8Array, finalName);

                    if (result.status === 'success') {
                        setResultPath(`Saved to ${result.filePath}`);
                        setStatus('COMPLETED');
                        addLog('File saved successfully.');
                        return;
                    } else if (result.status === 'canceled') {
                        addLog("Save cancelled. You can save manually using the button below.");
                    } else {
                        throw new Error(result.error);
                    }
                } catch (err: any) {
                    addLog(`Save failed: ${err.message}`);
                }
            } else {
                addLog("Electron API not found. Saving locally.");
            }

            setResultPath((prev) => prev.startsWith('Saved to') ? prev : `Ready to save: ${finalName}`);
            setStatus('COMPLETED');
            addLog(`Extraction Complete.`);

        } catch (err: any) {
            console.error(err);
            setStatus('ERROR');
            addLog(`Error: ${err.message}`);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            processFile(file);
        }
    }, []);

    const handleDownload = async () => {
        if (!resultBlob || !downloadName) {
            // Fallback if blob is missing but url exists (unlikely given flow)
            if (downloadUrl) {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = downloadName || 'extracted.tpk';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            return;
        }

        // Try Electron Save first
        // @ts-ignore
        if (window.electronAPI && window.electronAPI.saveBinaryFile) {
            try {
                const arrayBuffer = await resultBlob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                // @ts-ignore
                const result = await window.electronAPI.saveBinaryFile(uint8Array, downloadName);

                if (result.status === 'success') {
                    setResultPath(`Saved to ${result.filePath}`);
                    addLog('File saved successfully.');
                } else if (result.status === 'canceled') {
                    addLog('Save canceled.');
                } else {
                    addLog(`Save error: ${result.error}`);
                }
                return; // Stop here to prevent double dialog
            } catch (err) {
                console.error("Save failed, falling back to download", err);
                // If native save crashes, allow fallback
            }
        }

        // Fallback for web or if Electron save failed with exception
        if (downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const processUrl = async (targetUrl: string) => {
        setStatus('PROCESSING');
        setProgressStep(0);
        setLogs([]);
        addLog(`Accessing URL: ${targetUrl}`);

        try {
            // 1. Fetch HTML to find link
            // Note: This relies on Cross-Origin access being enabled in Electron or the target server allowing CORS.
            // If CORS issues arise, this needs to be moved to the main process via IPC.
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error(`Failed to access URL: ${response.status} ${response.statusText}`);

            const htmlText = await response.text();

            // 2. Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));

            // Find first .rpm link by checking the raw 'href' attribute
            const rpmLink = links.find(a => {
                const href = a.getAttribute('href');
                return href && href.trim().endsWith('.rpm');
            });

            if (!rpmLink) {
                throw new Error('No .rpm link found on the page.');
            }

            const rpmFilename = rpmLink.getAttribute('href')!.trim();
            addLog(`Found pattern: ${rpmFilename}`);

            // Construct full URL manually as requested: UserURL + Filename
            // Check for slash consistency
            let rpmUrl = '';
            if (targetUrl.endsWith('/')) {
                // User provided trailing slash
                rpmUrl = targetUrl + rpmFilename;
            } else {
                // No trailing slash, add one
                rpmUrl = targetUrl + '/' + rpmFilename;
            }

            const rpmName = rpmFilename.split('/').pop() || 'downloaded.rpm';
            addLog(`Target RPM URL: ${rpmUrl}`);
            addLog(`Downloading from: ${rpmUrl}`);

            // 3. Download RPM
            // We fetch as blob
            const rpmRes = await fetch(rpmUrl);
            if (!rpmRes.ok) throw new Error(`Failed to download RPM: ${rpmRes.status}`);

            const blob = await rpmRes.blob();
            const file = new File([blob], rpmName, { type: 'application/x-rpm' });

            addLog('Download complete. Starting extraction...');

            // 4. Process
            await processFile(file);

        } catch (err: any) {
            console.error(err);
            setStatus('ERROR');
            addLog(`Error: ${err.message}`);
        }
    };

    const reset = () => {
        setStatus('IDLE');
        setResultPath('');
        setLogs([]);
        setFileName('');
        setProgressStep(0);
        setResultBlob(null);
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl('');
    };

    return {
        status,
        fileName,
        resultPath,
        logs,
        progressStep,
        dragActive,
        handleDrag,
        handleDrop,
        handleDownload,
        reset,

        processFile,
        processUrl
    };
};
