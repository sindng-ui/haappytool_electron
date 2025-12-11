import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LogRule, AppSettings, LogWorkerResponse } from '../types';
import { LogViewerHandle } from '../components/LogViewer/LogViewerPane';
import { Socket } from 'socket.io-client';

declare global {
    interface Window {
        electronAPI?: {
            readFile: (path: string) => Promise<string>;
            streamReadFile: (path: string) => Promise<{ status: string }>;
            onFileChunk: (callback: (chunk: string) => void) => () => void;
            onFileStreamComplete: (callback: () => void) => () => void;
            onFileStreamError: (callback: (err: string) => void) => () => void;
            setZoomFactor: (factor: number) => void;
            getZoomFactor: () => number;
            copyToClipboard: (text: string) => Promise<void>;
            saveFile: (content: string) => Promise<{ status: string, filePath?: string }>;
            openExternal: (url: string) => Promise<{ status: string, error?: string }>;
            getAppPath: () => Promise<string>;
        };
    }
}

export interface LogExtractorLogicProps {
    rules: LogRule[];
    onUpdateRules: (rules: LogRule[]) => void;
    onExportSettings: () => void;
    onImportSettings: (settings: AppSettings) => void;
    configPanelWidth: number;
    setConfigPanelWidth: (width: number) => void;
    tabId: string;
    initialFilePath?: string;
    onFileChange?: (filePath: string) => void;
}

export const useLogExtractorLogic = ({
    rules, onUpdateRules, onExportSettings, onImportSettings,
    configPanelWidth, setConfigPanelWidth,
    tabId, initialFilePath, onFileChange
}: LogExtractorLogicProps) => {
    const [selectedRuleId, setSelectedRuleId] = useState<string>(() => {
        const saved = localStorage.getItem('lastSelectedRuleId');
        if (saved && rules.find(r => r.id === saved)) return saved;
        return rules.length > 0 ? rules[0].id : '';
    });

    useEffect(() => {
        if (selectedRuleId) {
            localStorage.setItem('lastSelectedRuleId', selectedRuleId);
        }
    }, [selectedRuleId]);

    const [isDualView, setIsDualView] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    const toggleDualView = useCallback(() => {
        setIsDualView(prev => !prev);
    }, []);

    const leftWorkerRef = useRef<Worker | null>(null);
    const [leftWorkerReady, setLeftWorkerReady] = useState(false);
    const [leftIndexingProgress, setLeftIndexingProgress] = useState(0);
    const [leftTotalLines, setLeftTotalLines] = useState(0);
    const [leftFilteredCount, setLeftFilteredCount] = useState(0);
    const [leftFileName, setLeftFileName] = useState<string>('');
    const [leftFilePath, setLeftFilePath] = useState<string>('');
    const leftPendingRequests = useRef<Map<string, (data: any) => void>>(new Map());

    const rightWorkerRef = useRef<Worker | null>(null);
    const [rightWorkerReady, setRightWorkerReady] = useState(false);
    const [rightIndexingProgress, setRightIndexingProgress] = useState(0);
    const [rightTotalLines, setRightTotalLines] = useState(0);
    const [rightFilteredCount, setRightFilteredCount] = useState(0);
    const [rightFileName, setRightFileName] = useState<string>('');
    const rightPendingRequests = useRef<Map<string, (data: any) => void>>(new Map());

    const [selectedLineIndexLeft, setSelectedLineIndexLeft] = useState<number>(-1);
    const [selectedLineIndexRight, setSelectedLineIndexRight] = useState<number>(-1);

    const [leftBookmarks, setLeftBookmarks] = useState<Set<number>>(new Set());
    const [rightBookmarks, setRightBookmarks] = useState<Set<number>>(new Set());

    const toggleLeftBookmark = useCallback((lineIndex: number) => {
        setLeftBookmarks(prev => {
            const next = new Set(prev);
            if (next.has(lineIndex)) next.delete(lineIndex);
            else next.add(lineIndex);
            return next;
        });
    }, []);

    const toggleRightBookmark = useCallback((lineIndex: number) => {
        setRightBookmarks(prev => {
            const next = new Set(prev);
            if (next.has(lineIndex)) next.delete(lineIndex);
            else next.add(lineIndex);
            return next;
        });
    }, []);
    const [isTizenModalOpen, setIsTizenModalOpen] = useState(false);

    const [rawContextOpen, setRawContextOpen] = useState(false);
    const [rawContextTargetLine, setRawContextTargetLine] = useState<{ lineNum: number, content: string } | null>(null);
    const [rawContextSourcePane, setRawContextSourcePane] = useState<'left' | 'right'>('left');

    const [rawContextHeight, setRawContextHeight] = useState(() => {
        const saved = localStorage.getItem('rawContextHeight');
        return saved ? parseFloat(saved) : 50;
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logFileInputRef = useRef<HTMLInputElement>(null);

    const leftViewerRef = useRef<LogViewerHandle>(null);
    const rightViewerRef = useRef<LogViewerHandle>(null);
    const rawViewerRef = useRef<LogViewerHandle>(null);

    // State Restoration Refs
    const pendingScrollTop = useRef<number | null>(null);

    // Initialize Left Worker & Load State
    useEffect(() => {
        console.log(`[useLog] Mounting tab ${tabId}. initialFilePath:`, initialFilePath);

        leftWorkerRef.current = new Worker(new URL('../workers/LogProcessor.worker.ts', import.meta.url), { type: 'module' });

        let cleanupListeners: (() => void)[] = [];

        // Load saved state or initial file
        const savedStateStr = localStorage.getItem(`tabState_${tabId}`);
        console.log(`[useLog] Raw saved state for ${tabId}:`, savedStateStr);

        let targetPath = initialFilePath;
        let savedScrollTop = 0;
        let savedSelectedLine = -1;

        if (savedStateStr) {
            try {
                const saved = JSON.parse(savedStateStr);
                if (saved.filePath) {
                    console.log(`[useLog] Found saved filePath:`, saved.filePath);
                    targetPath = saved.filePath;
                }
                if (saved.scrollTop) savedScrollTop = saved.scrollTop;
                if (saved.selectedLine) savedSelectedLine = saved.selectedLine;
            } catch (e) {
                console.error(`[Persistence] Failed to parse state for ${tabId}`, e);
            }
        }

        console.log(`[useLog] Final targetPath:`, targetPath);

        if (savedScrollTop > 0) pendingScrollTop.current = savedScrollTop;
        if (savedSelectedLine >= 0) setSelectedLineIndexLeft(savedSelectedLine);

        if (targetPath) {
            if (window.electronAPI) {
                console.log(`[useLog] Loading file via Electron:`, targetPath);
                const fileName = targetPath.split(/[/\\]/).pop() || 'log_file.log';
                setLeftFileName(fileName);
                setLeftFilePath(targetPath);
                setLeftWorkerReady(false);
                setLeftIndexingProgress(0);
                setLeftTotalLines(0);
                setLeftFilteredCount(0);

                if (window.electronAPI.streamReadFile) {
                    console.log('[useLog] Using streamReadFile');
                    // Stream Mode
                    leftWorkerRef.current?.postMessage({ type: 'INIT_STREAM' });

                    const unsubChunk = window.electronAPI.onFileChunk((chunk) => {
                        leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: chunk });
                    });
                    const unsubComplete = window.electronAPI.onFileStreamComplete(() => {
                        console.log('[useLog] Stream load complete');
                    });
                    cleanupListeners.push(unsubChunk, unsubComplete);

                    window.electronAPI.streamReadFile(targetPath).catch(e => {
                        console.error('[useLog] streamReadFile failed:', e);
                    });
                } else {
                    console.log('[useLog] Using readFile (Legacy)');
                    // Legacy Mode
                    window.electronAPI.readFile(targetPath).then(content => {
                        console.log(`[useLog] File read success. size=${content.length}`);
                        const file = new File([content], fileName);
                        // Store path for persistence if valid
                        (file as any).path = targetPath;
                        leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                        console.log('[useLog] Sent INIT_FILE to worker');
                    }).catch(e => {
                        console.error('[useLog] readFile failed:', e);
                    });
                }
            } else {
                console.error('[useLog] window.electronAPI is MISSING!');
            }
        }

        leftWorkerRef.current.onmessage = (e: MessageEvent<LogWorkerResponse>) => {
            const { type, payload, requestId } = e.data;
            if (type === 'ERROR') console.error('[useLog] Worker Error:', payload.error);
            if (type === 'INDEX_COMPLETE') console.log('[useLog] Worker INDEX_COMPLETE:', payload);
            if (type === 'FILTER_COMPLETE') console.log('[useLog] Worker FILTER_COMPLETE matches:', payload.matchCount);

            if (requestId && leftPendingRequests.current.has(requestId)) {
                const resolve = leftPendingRequests.current.get(requestId);
                if (type === 'LINES_DATA') {
                    resolve && resolve(payload.lines);
                } else if (type === 'FIND_RESULT') {
                    resolve && resolve(payload);
                }
                leftPendingRequests.current.delete(requestId);
                return;
            }

            switch (type) {
                case 'STATUS_UPDATE':
                    if (payload.status === 'indexing') setLeftIndexingProgress(payload.progress);
                    if (payload.status === 'ready') setLeftWorkerReady(true);
                    break;
                case 'INDEX_COMPLETE':
                    setLeftTotalLines(payload.totalLines);
                    setLeftIndexingProgress(100);
                    break;
                case 'FILTER_COMPLETE':
                    setLeftFilteredCount(payload.matchCount);
                    setLeftWorkerReady(true);
                    break;
                case 'ERROR':
                    console.error('Left Worker Error:', payload.error);
                    break;
            }
        };

        return () => {
            leftWorkerRef.current?.terminate();
            cleanupListeners.forEach(cleanup => cleanup());
        };
    }, []); // Run once on mount

    // Restore scroll position
    useEffect(() => {
        if (leftFilteredCount > 0 && pendingScrollTop.current !== null) {
            // Small timeout to allow rendering
            setTimeout(() => {
                if (leftViewerRef.current && pendingScrollTop.current !== null) {
                    leftViewerRef.current.scrollTo(pendingScrollTop.current);
                    pendingScrollTop.current = null;
                }
            }, 100);
        }
    }, [leftFilteredCount]);

    // Initialize Right Worker
    useEffect(() => {
        rightWorkerRef.current = new Worker(new URL('../workers/LogProcessor.worker.ts', import.meta.url), { type: 'module' });

        rightWorkerRef.current.onmessage = (e: MessageEvent<LogWorkerResponse>) => {
            const { type, payload, requestId } = e.data;

            if (requestId && rightPendingRequests.current.has(requestId)) {
                const resolve = rightPendingRequests.current.get(requestId);
                if (type === 'LINES_DATA') {
                    resolve && resolve(payload.lines);
                } else if (type === 'FIND_RESULT') {
                    resolve && resolve(payload);
                }
                rightPendingRequests.current.delete(requestId);
                return;
            }

            switch (type) {
                case 'STATUS_UPDATE':
                    if (payload.status === 'indexing') setRightIndexingProgress(payload.progress);
                    if (payload.status === 'ready') setRightWorkerReady(true);
                    break;
                case 'INDEX_COMPLETE':
                    setRightTotalLines(payload.totalLines);
                    setRightIndexingProgress(100);
                    break;
                case 'FILTER_COMPLETE':
                    setRightFilteredCount(payload.matchCount);
                    setRightWorkerReady(true);
                    setSelectedLineIndexRight(-1);
                    break;
            }
        };

        return () => {
            rightWorkerRef.current?.terminate();
        };
    }, []);

    // Global Keyboard Event Listener
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) {
                // Throttle repeated keys if necessary, but standard execution is usually fine
            }

            // Sync Scroll (Shift + Arrow Up/Down)
            if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const direction = e.key === 'ArrowUp' ? -1 : 1;
                // We'll rely on refs to scroll both panes
                if (isDualView) {
                    leftViewerRef.current?.scrollByLines(direction);
                    rightViewerRef.current?.scrollByLines(direction);
                } else {
                    leftViewerRef.current?.scrollByLines(direction);
                }
                return;
            }

            // Page Up / Down
            if (e.key === 'PageUp' || e.key === 'PageDown') {
                e.preventDefault();
                const direction = e.key === 'PageUp' ? -1 : 1;
                const targetRef = isDualView && selectedLineIndexRight !== -1 ? rightViewerRef : leftViewerRef;
                targetRef.current?.scrollByPage(direction);
                return;
            }

            // Focus Switch (Ctrl + Arrow Left/Right)
            if (e.ctrlKey && isDualView) {
                if (e.key === 'ArrowLeft') {
                    // Logic to focus left pane logic if needed, visually handled by selectedLineIndex
                    setSelectedLineIndexRight(-1); // Deselect right
                    // Ideally we should set focus to left container, but here we just manage selection state mostly
                } else if (e.key === 'ArrowRight') {
                    setSelectedLineIndexLeft(-1); // Deselect left
                }
            }

            // Bookmark Navigation
            if (e.key === 'F3') {
                e.preventDefault();
                if (e.shiftKey && isDualView) {
                    rightViewerRef.current?.jumpToPrevBookmark();
                } else {
                    leftViewerRef.current?.jumpToPrevBookmark();
                }
            }
            if (e.key === 'F4') {
                e.preventDefault();
                if (e.shiftKey && isDualView) {
                    rightViewerRef.current?.jumpToNextBookmark();
                } else {
                    leftViewerRef.current?.jumpToNextBookmark();
                }
            }
            if (e.key === 'Escape') {
                if (rawContextOpen) {
                    e.preventDefault();
                    setRawContextOpen(false);
                }
            }

            // Custom Zoom Handling
            if (e.ctrlKey) {
                if (e.shiftKey) {
                    if (e.key === '+' || e.key === '=') {
                        e.preventDefault();
                        const current = window.electronAPI?.getZoomFactor ? window.electronAPI.getZoomFactor() : 1;
                        window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(current + 0.1);
                    } else if (e.key === '-' || e.key === '_') {
                        e.preventDefault();
                        const current = window.electronAPI?.getZoomFactor ? window.electronAPI.getZoomFactor() : 1;
                        window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(Math.max(0.5, current - 0.1));
                    }
                } else {
                    // Disable default Zoom Out (Ctrl -) to enforce Ctrl+Shift+-
                    if (e.key === '-') {
                        e.preventDefault();
                    }
                }
                // Ctrl + 0 Reset
                if (e.key === '0') {
                    e.preventDefault();
                    window.electronAPI?.setZoomFactor && window.electronAPI.setZoomFactor(1);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isDualView, rawContextOpen, selectedLineIndexRight, selectedLineIndexLeft]);

    const currentConfig = rules.find(r => r.id === selectedRuleId);

    const refineGroups = (rawGroups: string[][]) => {
        const refinedGroups: string[][] = [];
        const groupsByRoot = new Map<string, string[][]>();
        rawGroups.forEach(group => {
            const root = (group[0] || '').trim();
            if (!root) return;
            if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
            groupsByRoot.get(root)!.push(group);
        });

        groupsByRoot.forEach((rootGroups) => {
            const hasBranches = rootGroups.some(g => g.length > 1 && g.slice(1).some(t => t.trim() !== ''));
            if (hasBranches) {
                const branchOnly = rootGroups.filter(g => g.length > 1 && g.slice(1).some(t => t.trim() !== ''));
                refinedGroups.push(...branchOnly);
            } else {
                refinedGroups.push(...rootGroups);
            }
        });
        return refinedGroups;
    };

    // Auto-Apply Filter (Left)
    useEffect(() => {
        if (leftWorkerRef.current && currentConfig && leftTotalLines > 0) {
            const refinedGroups = refineGroups(currentConfig.includeGroups);

            // Optimization: Check if effective filter changed
            const effectiveIncludes = refinedGroups.map(g =>
                g.map(t => t.trim().toLowerCase()).filter(t => t !== '')
            ).filter(g => g.length > 0);
            const effectiveExcludes = currentConfig.excludes.map(e => e.trim().toLowerCase()).filter(e => e !== '');

            const payloadHash = JSON.stringify({ inc: effectiveIncludes, exc: effectiveExcludes });

            if (payloadHash === lastFilterHashLeft.current) {
                return;
            }
            lastFilterHashLeft.current = payloadHash;

            setLeftWorkerReady(false);
            leftWorkerRef.current.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...currentConfig, includeGroups: refinedGroups }
            });
            setSelectedLineIndexLeft(-1);
        }
    }, [currentConfig, leftTotalLines]);

    // Tizen Socket State
    const [tizenSocket, setTizenSocket] = useState<Socket | null>(null);
    const tizenBuffer = useRef<string[]>([]);
    const tizenBufferTimeout = useRef<NodeJS.Timeout | null>(null);
    const shouldAutoScroll = useRef(true);

    const lastFilterHashLeft = useRef<string>('');
    const lastFilterHashRight = useRef<string>('');

    const [hasEverConnected, setHasEverConnected] = useState(false);

    const flushTizenBuffer = useCallback(() => {
        if (tizenBuffer.current.length === 0) return;
        const combined = tizenBuffer.current.join('');
        tizenBuffer.current = [];
        leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: combined });
    }, []);

    const handleTizenStreamStart = useCallback((socket: Socket, deviceName: string) => {
        setHasEverConnected(true);
        setTizenSocket(socket); // Save socket for disconnect
        setLeftFileName(deviceName);
        setLeftWorkerReady(false);
        setLeftIndexingProgress(0);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setSelectedLineIndexLeft(-1);
        shouldAutoScroll.current = true; // Default to auto-scroll on start
        lastFilterHashLeft.current = '';

        leftWorkerRef.current?.postMessage({ type: 'INIT_STREAM' });

        socket.on('log_data', (data: any) => {
            const chunk = typeof data === 'string' ? data : (data.chunk || data.log || JSON.stringify(data));
            tizenBuffer.current.push(chunk);

            if (!tizenBufferTimeout.current) {
                tizenBufferTimeout.current = setTimeout(() => {
                    // Check if we should maintain auto-scroll before processing
                    if (leftViewerRef.current) {
                        const scrollTop = leftViewerRef.current.getScrollTop();
                        // This logic is imperfect without exact dimensions, but we can assume
                        // if user scrolled up significantly, stop auto-scrolling
                        // But since we can't easily get scrollHeight here, we rely on user action
                        // For now, let's keep it simple: always auto-scroll if it was enabled.
                        // We will add scroll listener in LogViewerPane to toggle shouldAutoScroll.
                    }
                    flushTizenBuffer();
                    tizenBufferTimeout.current = null;
                }, 100); // 100ms buffering
            }
        });

        // Handle disconnect from server side
        socket.on('disconnect', () => {
            setTizenSocket(null);
        });

        // Handle logical disconnects (e.g. commands failed or finished)
        const handleLogicalDisconnect = (data: { status: string }) => {
            if (data.status === 'disconnected') {
                setTizenSocket(null);
            }
        };

        socket.on('sdb_status', handleLogicalDisconnect);
        socket.on('ssh_status', handleLogicalDisconnect);
    }, []);

    // Auto-scroll effect for Tizen
    useEffect(() => {
        if (tizenSocket && leftFilteredCount > 0 && shouldAutoScroll.current) {
            // Scroll to bottom
            if (leftViewerRef.current) {
                const totalHeight = leftFilteredCount * 24; // ROW_HEIGHT
                leftViewerRef.current.scrollTo(totalHeight);
            }
        }
    }, [leftFilteredCount, tizenSocket]);

    const sendTizenCommand = useCallback((cmd: string) => {
        if (tizenSocket) {
            tizenSocket.emit('sdb_write', cmd);
        }
    }, [tizenSocket]);

    // Auto-Apply Filter (Right)
    useEffect(() => {
        if (isDualView && rightWorkerRef.current && currentConfig && rightTotalLines > 0) {
            const refinedGroups = refineGroups(currentConfig.includeGroups);

            // Optimization: Check if effective filter changed
            const effectiveIncludes = refinedGroups.map(g =>
                g.map(t => t.trim().toLowerCase()).filter(t => t !== '')
            ).filter(g => g.length > 0);
            const effectiveExcludes = currentConfig.excludes.map(e => e.trim().toLowerCase()).filter(e => e !== '');

            const payloadHash = JSON.stringify({ inc: effectiveIncludes, exc: effectiveExcludes });

            if (payloadHash === lastFilterHashRight.current) {
                return;
            }
            lastFilterHashRight.current = payloadHash;

            setRightWorkerReady(false);
            rightWorkerRef.current.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...currentConfig, includeGroups: refinedGroups }
            });
        }
    }, [currentConfig, rightTotalLines, isDualView]);

    const handleTizenDisconnect = useCallback(() => {
        if (tizenSocket) {
            // Try to notify server to stop processes cleanly
            tizenSocket.emit('disconnect_sdb');
            tizenSocket.emit('disconnect_ssh');

            // Allow time for events to be sent before closing socket
            setTimeout(() => {
                tizenSocket.disconnect();
                setTizenSocket(null);
            }, 100);
        }
    }, [tizenSocket]);

    const handleLeftFileChange = useCallback((file: File) => {
        if (!leftWorkerRef.current) return;

        const path = ('path' in file) ? (file as any).path : '';
        setLeftFilePath(path);

        // Update local state immediately
        if (path) {
            localStorage.setItem(`tabState_${tabId}`, JSON.stringify({
                filePath: path,
                selectedLine: -1,
                scrollTop: 0
            }));
            // Notify parent to update tab state
            if (onFileChange) onFileChange(path);
        }

        setLeftFileName(file.name);
        setLeftWorkerReady(false);
        setLeftIndexingProgress(0);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setSelectedLineIndexLeft(-1);
        lastFilterHashLeft.current = '';
        leftWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, [tabId]);

    const requestLeftLines = useCallback((startIndex: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!leftWorkerRef.current) return resolve([]);
            const reqId = crypto.randomUUID();
            leftPendingRequests.current.set(reqId, resolve);
            leftWorkerRef.current.postMessage({ type: 'GET_LINES', payload: { startLine: startIndex, count }, requestId: reqId });
        });
    }, []);

    const requestLeftRawLines = useCallback((startLine: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!leftWorkerRef.current) return resolve([]);
            const reqId = crypto.randomUUID();
            leftPendingRequests.current.set(reqId, resolve);
            leftWorkerRef.current.postMessage({ type: 'GET_RAW_LINES', payload: { startLine, count }, requestId: reqId });
        });
    }, []);

    const handleRightFileChange = useCallback((file: File) => {
        if (!rightWorkerRef.current) return;
        setRightFileName(file.name);
        setRightWorkerReady(false);
        setRightIndexingProgress(0);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        lastFilterHashRight.current = '';
        rightWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, []);

    const requestRightLines = useCallback((startIndex: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!rightWorkerRef.current) return resolve([]);
            const reqId = crypto.randomUUID();
            rightPendingRequests.current.set(reqId, resolve);
            rightWorkerRef.current.postMessage({ type: 'GET_LINES', payload: { startLine: startIndex, count }, requestId: reqId });
        });
    }, []);

    const requestRightRawLines = useCallback((startLine: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!rightWorkerRef.current) return resolve([]);
            const reqId = crypto.randomUUID();
            rightPendingRequests.current.set(reqId, resolve);
            rightWorkerRef.current.postMessage({ type: 'GET_RAW_LINES', payload: { startLine, count }, requestId: reqId });
        });
    }, []);

    const handleLeftReset = useCallback(() => {
        setLeftFileName('');
        setLeftWorkerReady(false);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setSelectedLineIndexLeft(-1);
        lastFilterHashLeft.current = '';
    }, []);

    const handleRightReset = useCallback(() => {
        setRightFileName('');
        setRightWorkerReady(false);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setSelectedLineIndexRight(-1);
        lastFilterHashRight.current = '';
    }, []);

    // Periodic State Persistence
    useEffect(() => {
        if (!leftFilePath) return;
        const timer = setInterval(() => {
            const scrollTop = leftViewerRef.current?.getScrollTop() || 0;
            const state = {
                filePath: leftFilePath,
                selectedLine: selectedLineIndexLeft,
                scrollTop
            };
            localStorage.setItem(`tabState_${tabId}`, JSON.stringify(state));
        }, 1000); // 1s interval
        return () => clearInterval(timer);
    }, [tabId, leftFilePath, selectedLineIndexLeft]);

    const handleCopyLogs = useCallback(async (paneId: 'left' | 'right') => {
        alert(`Copy button clicked for ${paneId} pane!`);
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        console.log(`[Copy] Request for ${paneId}, count=${count}`);
        const requestLines = paneId === 'left' ? requestLeftLines : requestRightLines;
        if (count <= 0) {
            console.warn('[Copy] No logs to copy');
            alert('No logs to copy.');
            return;
        }

        try {
            const lines = await requestLines(0, count);
            console.log(`[Copy] Received ${lines.length} lines`);
            const content = lines.map(l => l.content).join('\n');
            if (window.electronAPI?.copyToClipboard) {
                window.electronAPI.copyToClipboard(content);
            } else {
                await navigator.clipboard.writeText(content);
            }
            console.log('[Copy] Success');
            alert(`Copied ${count} lines from ${paneId === 'left' ? 'Left' : 'Right'} pane!`);
        } catch (e) {
            console.error('[Copy] Failed', e);
            alert('Failed to copy. Check console for details.');
        }
    }, [leftFilteredCount, rightFilteredCount, requestLeftLines, requestRightLines]);

    const handleSaveLogs = useCallback(async (paneId: 'left' | 'right') => {
        alert(`Save button clicked for ${paneId} pane!`);
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        console.log(`[Save] Request for ${paneId}, count=${count}`);
        const requestLines = paneId === 'left' ? requestLeftLines : requestRightLines;
        if (count <= 0) {
            alert('No logs to save.');
            return;
        }

        try {
            const lines = await requestLines(0, count);
            console.log(`[Save] Received ${lines.length} lines`);
            const content = lines.map(l => l.content).join('\n');

            if (window.electronAPI?.saveFile) {
                const result = await window.electronAPI.saveFile(content);
                if (result.status === 'success') {
                    console.log('[Save] Success', result.filePath);
                    alert('Saved successfully!');
                } else {
                    console.log('[Save] Canceled');
                }
            } else {
                // Fallback for web
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `filtered_logs_${paneId}_${new Date().getTime()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('[Save] Download triggered (Web)');
            }
        } catch (e) {
            console.error('[Save] Failed', e);
            alert('Failed to save logs.');
        }
    }, [leftFilteredCount, rightFilteredCount, requestLeftLines, requestRightLines]);

    const updateCurrentRule = (updates: Partial<LogRule>) => {
        const updatedRules = rules.map(r => r.id === selectedRuleId ? { ...r, ...updates } : r);
        onUpdateRules(updatedRules);
    };

    const handleCreateRule = () => {
        const newId = crypto.randomUUID();
        const newRule: LogRule = { id: newId, name: 'New Analysis', includeGroups: [['']], excludes: [], highlights: [] };
        onUpdateRules([...rules, newRule]);
        setSelectedRuleId(newId);
        if (!isPanelOpen) setIsPanelOpen(true);
    };

    const handleDeleteRule = () => {
        const updated = rules.filter(r => r.id !== selectedRuleId);
        onUpdateRules(updated);
        setSelectedRuleId(updated.length > 0 ? updated[0].id : '');
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onImportSettings(json);
                alert('Settings imported!');
            } catch (error) { alert('Failed to parse settings file.'); }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleLogFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleLeftFileChange(e.target.files[0]);
    };

    const handleToggleRoot = (root: string, enabled: boolean) => {
        if (!currentConfig) return;
        const newIncludes = [...currentConfig.includeGroups];
        const newDisabled = [...(currentConfig.disabledGroups || [])];
        const allGroups = [...newIncludes.map(g => ({ g, active: true })), ...newDisabled.map(g => ({ g, active: false }))];
        const targetGroups = allGroups.filter(item => (item.g[0] || '').trim() === root);
        targetGroups.forEach(item => {
            if (item.active) {
                const idx = newIncludes.indexOf(item.g);
                if (idx > -1) newIncludes.splice(idx, 1);
            } else {
                const idx = newDisabled.indexOf(item.g);
                if (idx > -1) newDisabled.splice(idx, 1);
            }
            if (enabled) newIncludes.push(item.g);
            else newDisabled.push(item.g);
        });
        updateCurrentRule({ includeGroups: newIncludes, disabledGroups: newDisabled });
    };

    const groupedRoots = useMemo(() => {
        if (!currentConfig) return [];
        const groups = new Map<string, { group: string[], active: boolean, originalIdx: number }[]>();
        currentConfig.includeGroups.forEach((group, idx) => {
            const root = (group[0] || '').trim();
            if (!root) return;
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root)!.push({ group, active: true, originalIdx: idx });
        });
        if (currentConfig.disabledGroups) {
            currentConfig.disabledGroups.forEach((group, idx) => {
                const root = (group[0] || '').trim();
                if (!root) return;
                if (!groups.has(root)) groups.set(root, []);
                groups.get(root)!.push({ group, active: false, originalIdx: idx });
            });
        }
        return Array.from(groups.entries()).map(([root, items]) => {
            const isRootEnabled = items.some(i => i.active);
            return { root, isRootEnabled, items };
        });
    }, [currentConfig]);

    const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('collapsedRoots');
        if (saved) {
            try { return new Set(JSON.parse(saved)); } catch (e) { return new Set(); }
        }
        return new Set();
    });

    useEffect(() => {
        localStorage.setItem('collapsedRoots', JSON.stringify(Array.from(collapsedRoots)));
    }, [collapsedRoots]);

    const handleLineDoubleClickAction = async (index: number, paneId: 'left' | 'right' = 'left') => {
        const requestLines = paneId === 'left' ? requestLeftLines : requestRightLines;
        const lines = await requestLines(index, 1);
        if (lines && lines.length > 0) {
            setRawContextTargetLine(lines[0]);
            setRawContextSourcePane(paneId);
            setRawContextOpen(true);
            setTimeout(() => {
                if (rawViewerRef.current && lines[0].lineNum > 0) {
                    const targetIndex = lines[0].lineNum - 1;
                    const scrollTop = targetIndex * 24;
                    rawViewerRef.current.scrollTo(scrollTop);
                }
            }, 100);
        }
    };

    const handleRawContextResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = rawContextHeight;
        const windowHeight = window.innerHeight - 64;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaPercent = (deltaY / windowHeight) * 100;
            const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
            setRawContextHeight(newHeight);
        };
        const handleMouseUp = () => {
            localStorage.setItem('rawContextHeight', rawContextHeight.toString());
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleConfigResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = configPanelWidth;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(312, Math.min(800, startWidth + deltaX));
            setConfigPanelWidth(newWidth);
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const jumpToHighlight = useCallback(async (highlightIndex: number, paneId: 'left' | 'right') => {
        if (!currentConfig || !currentConfig.highlights || !currentConfig.highlights[highlightIndex]) return;

        const keyword = currentConfig.highlights[highlightIndex].keyword;
        const worker = paneId === 'left' ? leftWorkerRef.current : rightWorkerRef.current;
        const viewer = paneId === 'left' ? leftViewerRef.current : rightViewerRef.current;
        const currentLineIdx = paneId === 'left' ? selectedLineIndexLeft : selectedLineIndexRight;
        const requestMap = paneId === 'left' ? leftPendingRequests : rightPendingRequests;

        const startIdx = currentLineIdx !== -1 ? currentLineIdx : (viewer?.getScrollTop() ? Math.floor(viewer.getScrollTop() / 24) : 0);

        if (!worker) return;

        const result: any = await new Promise((resolve) => {
            const reqId = crypto.randomUUID();
            requestMap.current.set(reqId, resolve);
            worker.postMessage({
                type: 'FIND_HIGHLIGHT',
                payload: { keyword, startIndex: startIdx, direction: 'next' },
                requestId: reqId
            });
        });

        if (result && result.foundIndex !== -1 && viewer) {
            const ROW_HEIGHT = 24;
            const scrollTop = Math.max(0, (result.foundIndex * ROW_HEIGHT) - (viewer.getScrollTop() ? 100 : 100)); // Little offset
            viewer.scrollTo(result.foundIndex * ROW_HEIGHT);

            if (paneId === 'left') setSelectedLineIndexLeft(result.foundIndex);
            else setSelectedLineIndexRight(result.foundIndex);
        }
    }, [currentConfig, selectedLineIndexLeft, selectedLineIndexRight]);

    return {
        rules, onExportSettings,
        selectedRuleId, setSelectedRuleId,
        currentConfig,
        groupedRoots, collapsedRoots, setCollapsedRoots,
        updateCurrentRule, handleCreateRule, handleDeleteRule,
        handleToggleRoot,
        isDualView, setIsDualView, toggleDualView,
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, setConfigPanelWidth, handleConfigResizeStart,
        rawContextOpen, setRawContextOpen,
        rawContextHeight, handleRawContextResizeStart,
        rawContextTargetLine, rawContextSourcePane,
        isTizenModalOpen, setIsTizenModalOpen,
        fileInputRef, logFileInputRef,
        leftViewerRef, rightViewerRef, rawViewerRef,
        handleImportFile, handleLogFileSelect,
        handleTizenStreamStart, handleTizenDisconnect, tizenSocket,
        handleLineDoubleClickAction,
        leftFileName, leftWorkerReady, leftIndexingProgress, leftTotalLines, leftFilteredCount,
        selectedLineIndexLeft, setSelectedLineIndexLeft,
        handleLeftFileChange, handleLeftReset, requestLeftLines, requestLeftRawLines,
        rightFileName, rightWorkerReady, rightIndexingProgress, rightTotalLines, rightFilteredCount,
        selectedLineIndexRight, setSelectedLineIndexRight,
        leftBookmarks, rightBookmarks, toggleLeftBookmark, toggleRightBookmark,
        handleRightFileChange, handleRightReset, requestRightLines, requestRightRawLines,
        handleCopyLogs, handleSaveLogs, jumpToHighlight,
        sendTizenCommand,
        hasEverConnected
    };
};
