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
    rightViewerRef: React.MutableRefObject<LogViewerHandle | null>; // ✅ Added
    tizenSocket: Socket | null;
    activeStreamRequestIdLeft: React.MutableRefObject<string | null>;
    activeStreamRequestIdRight: React.MutableRefObject<string | null>;
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
    setRightFilePath: (path: string) => void; // ✅ Added
    setRightWorkerReady: (ready: boolean) => void;
    setRightIndexingProgress: (prog: number) => void;
    setRightTotalLines: (lines: number) => void;
    setRightFilteredCount: (count: number) => void;
    setRightBookmarks: (bookmarks: Set<number>) => void;
    lastFilterHashRight: React.MutableRefObject<string>;
    // Persistence
    leftFilePath: string;
    rightFilePath: string; // ✅ Added
    activeLineIndexLeft: number;
    isDualView: boolean; // ✅ Added
    setIsDualView: (val: boolean) => void; // ✅ Added
}

export const useLogFileOperations = (props: UseLogFileOperationsProps) => {
    const {
        tabId, initialFilePath, initialFile, onFileChange,
        leftWorkerRef, rightWorkerRef, leftViewerRef, rightViewerRef, tizenSocket,
        activeStreamRequestIdLeft, activeStreamRequestIdRight, pendingScrollTop,
        setLeftFileName, setLeftFilePath, setLeftWorkerReady, setLeftIndexingProgress,
        setLeftTotalLines, setLeftFilteredCount, setActiveLineIndexLeft, setSelectedIndicesLeft,
        setLeftBookmarks, lastFilterHashLeft,
        setRightFileName, setRightFilePath, setRightWorkerReady, setRightIndexingProgress,
        setRightTotalLines, setRightFilteredCount, setRightBookmarks, lastFilterHashRight,
        leftFilePath, rightFilePath, activeLineIndexLeft,
        isDualView, setIsDualView
    } = props;

    // Use a ref to track staleness (similar to original code's isStale)
    const isComponentStale = useRef(false);
    const lastLoadingPathRefLeft = useRef<string | null>(null);
    const lastLoadingPathRefRight = useRef<string | null>(null);
    const isLoadedRef = useRef(false); // ✅ Prevent persistence before loadState completes

    useEffect(() => {
        isComponentStale.current = false;
        return () => {
            isComponentStale.current = true;
            // 💡 We keep the path cache now because workers are persistent via Registry. 🐧🛡️
            // Removing the reset ensures we skip redundant loadFile on remount.
            // lastLoadingPathRefLeft.current = null;
            // lastLoadingPathRefRight.current = null;
        };
    }, []);

    // ✅ Register listeners ONCE to prevent duplication
    useEffect(() => {
        if (!window.electronAPI) return;

        let unsubChunk: (() => void) | undefined;
        let unsubComplete: (() => void) | undefined;

        if (window.electronAPI.onFileChunk) {
            unsubChunk = window.electronAPI.onFileChunk((data: any) => {
                if (isComponentStale.current) return;
                if (data.requestId === activeStreamRequestIdLeft.current) {
                    leftWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: data.chunk });
                } else if (data.requestId === activeStreamRequestIdRight.current) {
                    rightWorkerRef.current?.postMessage({ type: 'PROCESS_CHUNK', payload: data.chunk });
                }
            });
        }

        if (window.electronAPI.onFileStreamComplete) {
            unsubComplete = window.electronAPI.onFileStreamComplete((data: any) => {
                if (isComponentStale.current) return;
                if (data?.requestId === activeStreamRequestIdLeft.current) {
                    leftWorkerRef.current?.postMessage({ type: 'STREAM_DONE' });
                } else if (data?.requestId === activeStreamRequestIdRight.current) {
                    rightWorkerRef.current?.postMessage({ type: 'STREAM_DONE' });
                }
            });
        }

        return () => {
            if (unsubChunk) unsubChunk();
            if (unsubComplete) unsubComplete();
        };
    }, [leftWorkerRef, rightWorkerRef]); // Need refs in deps or handle dynamically

    const loadFile = useCallback(async (targetPath: string, pane: 'left' | 'right' = 'left') => {
        if (window.electronAPI) {
            const lastLoadingPathRef = pane === 'left' ? lastLoadingPathRefLeft : lastLoadingPathRefRight;
            const workerRef = pane === 'left' ? leftWorkerRef : rightWorkerRef;
            const setFileName = pane === 'left' ? setLeftFileName : setRightFileName;
            const setFilePath = pane === 'left' ? setLeftFilePath : setRightFilePath;
            const setWorkerReady = pane === 'left' ? setLeftWorkerReady : setRightWorkerReady;
            const setIndexingProgress = pane === 'left' ? setLeftIndexingProgress : setRightIndexingProgress;
            const setTotalLines = pane === 'left' ? setLeftTotalLines : setRightTotalLines;
            const setFilteredCount = pane === 'left' ? setLeftFilteredCount : setRightFilteredCount;
            const lastFilterHash = pane === 'left' ? lastFilterHashLeft : lastFilterHashRight;

            // 중복 로딩 방지 (동일 파일이 이미 로딩 중인 경우 무시)
            if (lastLoadingPathRef.current === targetPath && !tizenSocket) {
                console.log(`[useLog-${pane}] Skip redundant loadFile for:`, targetPath);
                return;
            }
            lastLoadingPathRef.current = targetPath;

            const fileName = targetPath.split(/[/\\]/).pop() || 'log_file.log';
            setFileName(fileName);
            setFilePath(targetPath);

            if (pane === 'left' && onFileChange) {
                onFileChange(targetPath);
            }

            setWorkerReady(false);
            setIndexingProgress(0);
            setTotalLines(0);
            setFilteredCount(0);
            // 필터 캐시 강제 무효화를 위해 해시 리셋
            lastFilterHash.current = '';

            // ✅ OOM-Safe Local File Loading Route! (2GB+ Support)
            if (window.electronAPI.getFileSize) {
                try {
                    const size = await window.electronAPI.getFileSize(targetPath);
                    console.log(`[useLog-${pane}] Initiating LOCAL_FILE_STREAM for ${fileName}, size: ${Math.round(size / 1024 / 1024)}MB`);
                    workerRef.current?.postMessage({
                        type: 'INIT_LOCAL_FILE_STREAM',
                        payload: { path: targetPath, size }
                    });
                    return; // 🚀 Use the new efficient route instead of string buffers!
                } catch (e) {
                    console.error(`[useLog-${pane}] Failed to get file size, falling back to string mode`, e);
                }
            }

            // Fallback (old memory-heavy way)
            if (pane === 'left' && window.electronAPI.streamReadFile) {
                const requestId = `stream-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                activeStreamRequestIdLeft.current = requestId;

                workerRef.current?.postMessage({ type: 'INIT_STREAM', payload: { isLive: false } });
                window.electronAPI.streamReadFile(targetPath, requestId).catch(() => {
                    if (isComponentStale.current) return;
                    window.electronAPI!.readFile(targetPath).then(content => {
                        if (isComponentStale.current) return;
                        const file = new File([content], fileName);
                        (file as any).path = targetPath;
                        workerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                    });
                });
            } else {
                const requestId = `read-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                if (pane === 'left') activeStreamRequestIdLeft.current = requestId;
                else activeStreamRequestIdRight.current = requestId;

                window.electronAPI.readFile(targetPath).then(content => {
                    if (isComponentStale.current) return;
                    const file = new File([content], fileName);
                    (file as any).path = targetPath;
                    workerRef.current?.postMessage({ type: 'INIT_FILE', payload: file });
                });
            }
        }
    }, [onFileChange, tizenSocket]);

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

        let leftTargetPath = initialFilePath;
        let rightTargetPath = '';
        let savedIsDualView = false;
        let savedScrollTopLeft = 0;
        let savedSelectedLineLeft = -1;

        if (savedStateStr) {
            try {
                const saved = JSON.parse(savedStateStr);
                if (saved.scrollTop) savedScrollTopLeft = saved.scrollTop;
                if (saved.selectedLine) savedSelectedLineLeft = saved.selectedLine;
                if (saved.filePath && !initialFilePath) leftTargetPath = saved.filePath;
                if (saved.rightFilePath) rightTargetPath = saved.rightFilePath;
                if (saved.isDualView) savedIsDualView = saved.isDualView;
            } catch (e) { }
        }

        if (isComponentStale.current) return;

        if (savedScrollTopLeft > 0) pendingScrollTop.current = savedScrollTopLeft;
        if (savedSelectedLineLeft >= 0) {
            setActiveLineIndexLeft(savedSelectedLineLeft);
            setSelectedIndicesLeft(new Set([savedSelectedLineLeft]));
        }

        if (savedIsDualView) {
            setIsDualView(true);
        }

        if (leftTargetPath) {
            loadFile(leftTargetPath, 'left');
        }

        if (savedIsDualView && rightTargetPath) {
            loadFile(rightTargetPath, 'right');
        }

        isLoadedRef.current = true; // ✅ Mark loaded to allow persistence
    }, [tabId, initialFile, initialFilePath, loadFile, setIsDualView]);

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
                rightFilePath: rightFilePath,
                isDualView: isDualView,
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
    }, [tabId, onFileChange, rightFilePath, isDualView]);

    const handleRightFileChange = useCallback((file: File) => {
        if (!rightWorkerRef.current) return;
        let path = '';
        if (window.electronAPI && window.electronAPI.getFilePath) {
            path = window.electronAPI.getFilePath(file);
        } else {
            path = ('path' in file && (file as any).path) || '';
        }

        if (path) {
            setRightFilePath(path);
            setStoredValue(`tabState_${tabId}`, JSON.stringify({
                filePath: leftFilePath,
                rightFilePath: path,
                isDualView: isDualView,
                selectedLine: activeLineIndexLeft,
                scrollTop: leftViewerRef.current?.getScrollTop() || 0
            }));
        }

        setRightFileName(file.name);
        setRightWorkerReady(false);
        setRightIndexingProgress(0);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setRightBookmarks(new Set());
        lastFilterHashRight.current = '';
        rightWorkerRef.current.postMessage({ type: 'INIT_FILE', payload: file });
    }, [tabId, leftFilePath, isDualView, activeLineIndexLeft]);

    const lastSavedState = useRef<string>('');

    // Periodic Persistence
    useEffect(() => {
        if (tizenSocket) return;

        const timer = setInterval(() => {
            if (!isLoadedRef.current) return; // ✅ Exit if loadState hasn't finished to avoid overwriting with defaults

            const scrollTop = leftViewerRef.current?.getScrollTop() || 0;
            const state = {
                filePath: leftFilePath,
                rightFilePath: rightFilePath,
                isDualView: isDualView,
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
    }, [tabId, leftFilePath, rightFilePath, isDualView, activeLineIndexLeft, tizenSocket]);

    return {
        loadState,
        loadFile,
        handleLeftFileChange,
        handleRightFileChange
    };
};
