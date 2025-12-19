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
        addLog(`Step 1: Accessing User URL: ${targetUrl}`);

        // Helper to fetch text content (HTML)
        const fetchHtmlContent = async (url: string) => {
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.fetchUrl) {
                // @ts-ignore
                return await window.electronAPI.fetchUrl(url, 'text');
            } else {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP Error ${response.status} at ${url}`);
                return await response.text();
            }
        };

        try {
            // --- STEP 1: Parse User URL to find HQ URL ---
            const html1 = await fetchHtmlContent(targetUrl);
            const doc1 = new DOMParser().parseFromString(html1, 'text/html');

            // Strategy: Find element containing "Artifact" text directly, then find next TABLE
            const allElements = Array.from(doc1.body.querySelectorAll('*'));
            let artifactIdx = -1;

            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                // Check direct text nodes to find the specific label element
                const hasText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.includes('Artifacts'));
                if (hasText) {
                    artifactIdx = i;
                    break;
                }
            }

            if (artifactIdx === -1) {
                // Fallback: Check textContent if simple include not found (less precise)
                artifactIdx = allElements.findIndex(el => el.textContent?.includes('Artifacts'));
                if (artifactIdx === -1) throw new Error("'Artifacts' keyword not found on the page.");
            }

            let table: HTMLTableElement | null = null;
            for (let i = artifactIdx + 1; i < allElements.length; i++) {
                if (allElements[i].tagName === 'TABLE') {
                    table = allElements[i] as HTMLTableElement;
                    break;
                }
            }

            if (!table) throw new Error("No table found after 'Artifacts' keyword.");

            // Find 'HQ URL' column
            // Assuming the first row is the header (standard)
            const headerRow = table.rows[0];
            if (!headerRow) throw new Error("Target table has no rows.");

            let hqColIndex = -1;
            for (let i = 0; i < headerRow.cells.length; i++) {
                if (headerRow.cells[i].textContent?.trim() === 'HQ URL') {
                    hqColIndex = i;
                    break;
                }
            }

            if (hqColIndex === -1) throw new Error("'HQ URL' column not found in the table.");

            // Get the URL from the first data row (row 1)
            if (table.rows.length < 2) throw new Error("No data rows in the table.");
            const targetCell = table.rows[1].cells[hqColIndex];

            // Extract URL from <a> or text
            const anchor = targetCell.querySelector('a');
            let hqUrl = anchor ? anchor.getAttribute('href') : targetCell.textContent?.trim();

            if (!hqUrl) throw new Error("No URL found in the 'HQ URL' cell.");

            // Resolve relative URLs
            hqUrl = new URL(hqUrl, targetUrl).href;
            addLog(`[STEP 1 SUCCESS] Found HQ URL from Table: ${hqUrl}`);

            // --- STEP 2: Append Path and Find RPM ---
            // "repos/product/armv7l/packages/armv7l/"
            const suffix = 'repos/product/armv7l/packages/armv7l/';
            const repoUrl = hqUrl.endsWith('/') ? hqUrl + suffix : hqUrl + '/' + suffix;

            addLog(`[STEP 2 OPEN] Accessing Repo URL...`);
            addLog(`> Target: ${repoUrl}`);

            const html2 = await fetchHtmlContent(repoUrl);
            const doc2 = new DOMParser().parseFromString(html2, 'text/html');
            const anchors = Array.from(doc2.querySelectorAll('a'));

            // Find first .rpm link
            const rpmLink = anchors.find(a => a.href && a.href.trim().endsWith('.rpm'));
            if (!rpmLink) throw new Error("No .rpm file found in the repo listing.");

            // Resolve RPM URL (href property of anchor is already absolute in browser DOM, but getAttribute might be relative)
            // But DOMParser doc anchors might have empty origin if parsed from string.
            // Safest to use getAttribute and new URL(..., repoUrl)
            const rpmRawHref = rpmLink.getAttribute('href')!;
            const finalRpmUrl = new URL(rpmRawHref, repoUrl).href;

            const rpmName = finalRpmUrl.split('/').pop() || 'downloaded.rpm';
            addLog(`[STEP 3 SUCCESS] Found RPM File: ${rpmName}`);
            addLog(`> Final Download URL: ${finalRpmUrl}`);

            // --- STEP 3: Download ---
            addLog(`Downloading RPM...`);
            let file: File;

            // @ts-ignore
            if (window.electronAPI && window.electronAPI.fetchUrl) {
                // @ts-ignore
                const buffer = await window.electronAPI.fetchUrl(finalRpmUrl, 'buffer');
                file = new File([buffer], rpmName, { type: 'application/x-rpm' });
            } else {
                const rpmRes = await fetch(finalRpmUrl);
                if (!rpmRes.ok) throw new Error(`Download failed: ${rpmRes.status}`);
                const blob = await rpmRes.blob();
                file = new File([blob], rpmName, { type: 'application/x-rpm' });
            }

            addLog('Download complete. Starting extraction...');
            await processFile(file);

        } catch (err: any) {
            console.error(err);
            setStatus('ERROR');
            let errorMsg = err.message;

            if (err.message === 'Failed to fetch') {
                errorMsg += ' (CORS/Network Error)';
                addLog(`Error: ${errorMsg}`);
                // Basic diagnostic
                try {
                    await fetch('http://127.0.0.1:3002', { mode: 'no-cors' });
                    addLog(`Diagnostic: Local Server reachable.`);
                } catch {
                    addLog(`Diagnostic: Local Server unreachable.`);
                }
            } else {
                addLog(`Error: ${errorMsg}`);
            }
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
