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
            let htmlText = '';

            // 1. Fetch HTML
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.fetchUrl) {
                addLog('Using Electron Native Fetch...');
                // @ts-ignore
                htmlText = await window.electronAPI.fetchUrl(targetUrl, 'text');
            } else {
                const response = await fetch(targetUrl);
                if (!response.ok) throw new Error(`Failed to access URL: ${response.status} ${response.statusText}`);
                htmlText = await response.text();
            }

            // 2. Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));

            // Find first .rpm link
            const rpmLink = links.find(a => {
                const href = a.getAttribute('href');
                return href && href.trim().endsWith('.rpm');
            });

            if (!rpmLink) {
                throw new Error('No .rpm link found on the page.');
            }

            // Get the raw href value (which is expected to be the filename)
            const rawHref = rpmLink.getAttribute('href')!.trim();
            // Just the filename part in case it's a path, but User request says "extract name" implies simple concat
            // But to be safe properly, and as user example "~~~~.rpm", we assume it's relative.
            const rpmFilename = rawHref;

            addLog(`Found RPM link: ${rpmFilename}`);

            // Construct full URL manually: UserURL + Filename
            // As per user request: "유저가 입력한 url + ~~~~.rpm 형태로 최종 url이 완성된다." (User URL + RPM Name)
            // We ensure exactly one slash separator if User URL doesn't have one
            let rpmUrl = '';
            // Remove trailing slash from targetUrl if present to normalize
            const baseUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
            // Remove leading slash from filename if present
            const cleanFilename = rpmFilename.startsWith('/') ? rpmFilename.slice(1) : rpmFilename;

            rpmUrl = `${baseUrl}/${cleanFilename}`;

            const rpmName = rpmFilename.split('/').pop() || 'downloaded.rpm';
            addLog(`Target RPM URL: ${rpmUrl}`);
            addLog(`Downloading from: ${rpmUrl}`);

            // 3. Download RPM
            let file: File;

            // @ts-ignore
            if (window.electronAPI && window.electronAPI.fetchUrl) {
                // @ts-ignore
                const buffer = await window.electronAPI.fetchUrl(rpmUrl, 'buffer');
                // Buffer is returned as Uint8Array (Node Buffer -> Uint8Array in IPC)? 
                // Buffer from preload is likely Uint8Array in renderer.

                // Note: The IPC handler returns Buffer.from(arrayBuffer). 
                // In Electron, Buffer is often passed as Uint8Array across context bridge if not explictly optimized?
                // Actually, let's assume it works as Blob/ArrayBuffer compatible.
                file = new File([buffer], rpmName, { type: 'application/x-rpm' });
            } else {
                const rpmRes = await fetch(rpmUrl);
                if (!rpmRes.ok) throw new Error(`Failed to download RPM: ${rpmRes.status}`);
                const blob = await rpmRes.blob();
                file = new File([blob], rpmName, { type: 'application/x-rpm' });
            }

            addLog('Download complete. Starting extraction...');

            // 4. Process
            await processFile(file);

        } catch (err: any) {
            console.error(err);
            setStatus('ERROR');

            // --- Verbose Debugging for "Failed to fetch" ---
            let errorMsg = err.message;
            if (err.message === 'Failed to fetch') {
                errorMsg += ' (서버 연결 실패 또는 CORS 문제)';
                addLog(`Error: ${errorMsg}`);

                // Diagnostic Checks
                addLog(`[진단] 네트워크 상태: ${navigator.onLine ? '온라인' : '오프라인'}`);
                addLog(`[진단] 내부 서버(Port 3001) 접근 시도 중...`);
                try {
                    // Attempt to ping the server root to see if it's alive (standard fetch)
                    // Using no-cors just to check connectivity (status might be opaque but if it throws it's down)
                    await fetch('http://localhost:3001', { mode: 'no-cors' });
                    addLog(`[진단] 내부 서버 연결 확인됨 (응답 있음).`);
                } catch (pingErr) {
                    addLog(`[진단] 내부 서버 연결 실패. 서버가 꺼져있을 수 있습니다.`);
                }
            } else {
                addLog(`Error: ${errorMsg}`);
            }

            // Electron API Check
            // @ts-ignore
            if (!window.electronAPI) {
                addLog('[진단] window.electronAPI가 감지되지 않음 (Preload 스크립트 로드 실패).');
            } else {
                // @ts-ignore
                if (!window.electronAPI.fetchUrl) {
                    addLog('[진단] electronAPI.fetchUrl 기능이 없음. 앱이 최신 코드로 재시작되지 않았습니다.');
                    addLog('>>> 조치 필요: 앱을 완전히 껐다가 다시 실행해주세요 (npm run electron:dev 재실행). <<<');
                }
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
