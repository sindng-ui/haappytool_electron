import { useEffect, useCallback, useRef } from 'react';
import { getStoredValue, setStoredValue } from '../utils/db';
import { LogViewerHandle } from '../components/LogViewer/LogViewerPane';
import { Socket } from 'socket.io-client';

export interface UseLogFileOperationsProps {
    tabId: string;
    initialFilePath?: string;
    initialFile?: File | null;
    onFileChange?: (path: string) => void;
    leftWorkerRef: React.MutableRefObject<Worker | null>;
    rightWorkerRef: React.MutableRefObject<Worker | null>;
    leftViewerRef: React.MutableRefObject<LogViewerHandle | null>;
    tizenSocket: Socket | null;
    activeStreamRequestId: React.MutableRefObject<string | null>;
    pendingScrollTop: React.MutableRefObject<number | null>;
    // Left Setters
    setLeftFileName: (name: string | null) => void;
    setLeftFilePath: (path: string) => void;
    setLeftWorkerReady: (ready: boolean) => void;
    setLeftIndexingProgress: (prog: number) => void;
    setLeftTotalLines: (lines: number) => void;
    setLeftFilteredCount: (count: number) => void;
    setActiveLineIndexLeft: (idx: number) => void;
    setSelectedIndicesLeft: (indices: Set<number>) => void;
    setLeftBookmarks: (bookmarks: Set<number>) => void;
    lastFilterHashLeft: React.MutableRefObject<string>;
    // Right Setters
    setRightFileName: (name: string) => void;
    setRightWorkerReady: (ready: boolean) => void;
    setRightIndexingProgress: (prog: number) => void;
    setRightTotalLines: (lines: number) => void;
    setRightFilteredCount: (count: number) => void;
    setRightBookmarks: (bookmarks: Set<number>) => void;
    lastFilterHashRight: React.MutableRefObject<string>;
    // Persistence
    leftFilePath: string;
    activeLineIndexLeft: number;
}

export const useLogFileOperations = (props: UseLogFileOperationsProps) => {
    const {
        tabId, initialFilePath, initialFile, onFileChange,
        leftWorkerRef, rightWorkerRef, leftViewerRef, tizenSocket,
        activeStreamRequestId, pendingScrollTop,
        setLeftFileName, setLeftFilePath, setLeftWorkerReady, setLeftIndexingProgress,
        setLeftTotalLines, setLeftFilteredCount, setActiveLineIndexLeft, setSelectedIndicesLeft,
        setLeftBookmarks, lastFilterHashLeft,
        setRightFileName, setRightWorkerReady, setRightIndexingProgress,
        setRightTotalLines, setRightFilteredCount, setRightBookmarks, lastFilterHashRight,
        leftFilePath, activeLineIndexLeft
    } = props;

    // Use a ref to track staleness (similar to original code's isStale)
    const isComponentStale = useRef(false);
    const lastLoadingPathRef = useRef<string | null>(null);

    useEffect(() => {
        isComponentStale.current = false;
        return () => { isComponentStale.current = true; };
    }, []);

    // ✅ Register listeners ONCE to prevent duplication
    useEffect(() => {
        if (!window.electronAPI) return;

        let unsubChunk: (() => void) | undefined;
        let unsubComplete: (() => void) | undefined;

        if (window.electronAPI.onFileChunk) {
            unsubChunk = window.electronAPI.onFileChunk((data: any) => {
                if (isComponentStale.current || data.requestId !== activeStreamRequestId.current) return;
                leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: data.chunk });
            });
        }

        if (window.electronAPI.onFileStreamComplete) {
            unsubComplete = window.electronAPI.onFileStreamComplete((data: any) => {
                if (isComponentStale.current || data?.requestId !== activeStreamRequestId.current) return;
                // 스트림 완료 신호를 워커에게 전달하여 최종 필터링 결과를 단 한번만 갱신하도록 함
                leftWorkerRef.current?.postMessage({ type: 'STREAM_DONE' });
            });
        }

        return () => {
            if (unsubChunk) unsubChunk();
            if (unsubComplete) unsubComplete();
        };
    }, [leftWorkerRef, rightWorkerRef]); // Need refs in deps or handle dynamically

    const loadFile = useCallback(async (targetPath: string) => {
        if (window.electronAPI) {
            // 중복 로딩 방지 (동일 파일이 이미 로딩 중인 경우 무시)
            if (lastLoadingPathRef.current === targetPath && !tizenSocket) {
                console.log('[useLog] Skip redundant loadFile for:', targetPath);
                return;
            }
            lastLoadingPathRef.current = targetPath;

            const fileName = targetPath.split(/[/\\]/).pop() || 'log_file.log';
            setLeftFileName(fileName);
            setLeftFilePath(targetPath);

            if (onFileChange) {
                onFileChange(targetPath);
            }

            setLeftWorkerReady(false);
            setLeftIndexingProgress(0);
            setLeftTotalLines(0);
            setLeftFilteredCount(0);
            // 필터 캐시 강제 무효화를 위해 해시 리셋
            lastFilterHashLeft.current = '';

            // ✅ OOM-Safe Local File Loading Route! (2GB+ Support)
            if (window.electronAPI.getFileSize) {
                try {
                    const size = await window.electronAPI.getFileSize(targetPath);
                    console.log(`[useLog] Initiating LOCAL_FILE_STREAM for ${fileName}, size: ${Math.round(size / 1024 / 1024)}MB`);
                    leftWorkerRef.current?.postMessage({
                        type: 'INIT_LOCAL_FILE_STREAM',
                        payload: { path: targetPath, size }
                    });
                    return; // 🚀 Use the new efficient route instead of string buffers!
                } catch (e) {
                    console.error('[useLog] Failed to get file size, falling back to string mode', e);
                }
            }

            // Fallback (old memory-heavy way)
            if (window.electronAPI.streamReadFile) {
                const requestId = `stream-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                activeStreamRequestId.current = requestId;

                leftWorkerRef.current?.postMessage({ type: 'INIT_STREAM', payload: { isLive: false } });
                window.electronAPI.streamReadFile(targetPath, requestId).catch(() => {
                    if (isComponentStale.current) return;
                    window.electronAPI!.readFile(targetPath).then(content => {
                        if (isComponentStale.current) return;
                        const file = new File([content], fileName);
                        (file as any).path = targetPath;
                        leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                    });
                });
            } else {
                window.electronAPI.readFile(targetPath).then(content => {
                    if (isComponentStale.current) return;
                    const file = new File([content], fileName);
                    (file as any).path = targetPath;
                    leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                });
            }
        }
    }, [onFileChange]);

    const loadState = useCallback(async () => {
        // Priority 1: Direct File Object
        if (initialFile) {
            console.log('[useLog] Loading from initialFile object:', initialFile.name);
            setLeftFileName(initialFile.name);
            setLeftFilePath((initialFile as any).path || '');
            setLeftWorkerReady(false);
            setLeftIndexingProgress(0);
            setLeftTotalLines(0);
            setLeftFilteredCount(0);
            leftWorkerRef.current?.postMessage({ type: 'INIT_FILE', payload: initialFile });
            return;
        }

        // Priority 2: Saved State
        const savedStateStr = await getStoredValue(`tabState_${tabId}`);
        if (isComponentStale.current) return;

        let targetPath = initialFilePath;
        let savedScrollTop = 0;
        let savedSelectedLine = -1;

        if (savedStateStr) {
            try {
                const saved = JSON.parse(savedStateStr);
                if (saved.scrollTop) savedScrollTop = saved.scrollTop;
                if (saved.selectedLine) savedSelectedLine = saved.selectedLine;
                if (saved.filePath && !initialFilePath) targetPath = saved.filePath;
            } catch (e) { }
        }

        if (isComponentStale.current) return;

        if (savedScrollTop > 0) pendingScrollTop.current = savedScrollTop;
        if (savedSelectedLine >= 0) {
            setActiveLineIndexLeft(savedSelectedLine);
            setSelectedIndicesLeft(new Set([savedSelectedLine]));
        }

        if (targetPath) {
            loadFile(targetPath);
        }
    }, [tabId, initialFile, initialFilePath, loadFile]);

    const handleLeftFileChange = useCallback((file: File) => {
        if (!leftWorkerRef.current) return;
        let path = '';
        if (window.electronAPI && window.electronAPI.getFilePath) {
            path = window.electronAPI.getFilePath(file);
        } else {
            path = ('path' in file && (file as any).path) || '';
        }

        if (path) {
            setStoredValue(`tabState_${tabId}`, JSON.stringify({
                filePath: path,
                selectedLine: -1,
                scrollTop: 0
            }));
            if (onFileChange) onFileChange(path);
        }

        setLeftFileName(file.name);
        setLeftWorkerReady(false);
        setLeftIndexingProgress(0);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setActiveLineIndexLeft(-1);
        setSelectedIndicesLeft(new Set());
        setLeftBookmarks(new Set());
        lastFilterHashLeft.current = '';
        leftWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, [tabId, onFileChange]);

    const handleRightFileChange = useCallback((file: File) => {
        if (!rightWorkerRef.current) return;
        setRightFileName(file.name);
        setRightWorkerReady(false);
        setRightIndexingProgress(0);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setRightBookmarks(new Set());
        lastFilterHashRight.current = '';
        rightWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, []);

    const lastSavedState = useRef<string>('');

    // Periodic Persistence
    useEffect(() => {
        if (!leftFilePath || tizenSocket) return;

        const timer = setInterval(() => {
            const scrollTop = leftViewerRef.current?.getScrollTop() || 0;
            const state = {
                filePath: leftFilePath,
                selectedLine: activeLineIndexLeft,
                scrollTop
            };

            const newStateStr = JSON.stringify(state);
            if (lastSavedState.current !== newStateStr) {
                lastSavedState.current = newStateStr;
                setStoredValue(`tabState_${tabId}`, newStateStr);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [tabId, leftFilePath, activeLineIndexLeft]);

    return {
        loadState,
        loadFile,
        handleLeftFileChange,
        handleRightFileChange
    };
};
