import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getStoredValue, setStoredValue } from '../utils/db';
import { LogRule, AppSettings, LogWorkerResponse, LogViewPreferences, SpamLogResult } from '../types';
import { LogViewerHandle } from '../components/LogViewer/LogViewerPane';
import { AnalysisResult } from '../utils/perfAnalysis';
import { Socket } from 'socket.io-client';
import { useLogViewPreferences, defaultLogViewPreferences } from './useLogViewPreferences';
import { useSelectedRuleId } from './useSelectedRuleId';
import { refineGroups, assembleIncludeGroups } from '../utils/filterGroupUtils';
import { useTizenConnection } from './useTizenConnection';
import { useLogShortcuts } from './useLogShortcuts';
import { useLogFileOperations } from './useLogFileOperations';
import { useLogAnalysisActions } from './useLogAnalysisActions';







export interface LogExtractorLogicProps {
    rules: LogRule[];
    onUpdateRules: (rules: LogRule[]) => void;
    onExportSettings: () => void;
    onImportSettings: (settings: AppSettings) => void;
    configPanelWidth: number;
    setConfigPanelWidth: (width: number) => void;
    tabId: string;
    initialFilePath?: string;
    initialFile?: File | null; // ✅ Add support for direct File object
    onFileChange?: (filePath: string) => void;
    isActive?: boolean;
    isPanelOpen: boolean;
    setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isSearchFocused?: boolean; // ✅ Lifted State
    setIsSearchFocused?: (focused: boolean) => void; // ✅ Lifted State Setter
}

// Segmentation for Large Files (Browser Limit workaround)
// 33.5M px limit / 24px height = ~1.4M lines.
// We use 1.5M lines as a safe chunk, but close to limit. 
// Wait, 1.5M * 24 = 36M pixels. It might be too large for some browsers.
// 1.40M is safer. The user asked for 1.5M explicitly.
// Let's try 1.5M. If it blanks out, we might need to reduce.
// Actually, Electron/Chrome limit varies. 
// 1,500,000 * 24 = 36,000,000.
// Limit is roughly 33,554,432.
// 1.5M WILL failing rendering at the bottom (last 100k lines missing).

// I will set it to 1,000,000 as per technical limit, BUT the user asked for 1.5M.
// If I set 1.5M, the end of the segment might be invisible.

// Let's stick to user request `1500000`.
// Maybe they reduced row height? Or just want fewer pages.
// Let's stick to user request `1500000`.
// Maybe they reduced row height? Or just want fewer pages.
export const MAX_SEGMENT_SIZE = 1_350_000;




export const useLogExtractorLogic = ({
    rules, onUpdateRules, onExportSettings, onImportSettings,
    configPanelWidth, setConfigPanelWidth,
    tabId, initialFilePath, initialFile, onFileChange,
    isActive = true,
    isPanelOpen, setIsPanelOpen,
    isSearchFocused: propIsSearchFocused, setIsSearchFocused: propSetIsSearchFocused // ✅ Destructure new props
}: LogExtractorLogicProps) => {

    // ✅ Search Focus State (Lifted or Local Fallback)
    const [localSearchFocused, setLocalSearchFocused] = useState(false);
    const isSearchFocused = propIsSearchFocused !== undefined ? propIsSearchFocused : localSearchFocused;
    const setIsSearchFocused = propSetIsSearchFocused || setLocalSearchFocused;


    // ... (existing state) ...
    // ... (existing state) ...
    // Note: AmbientMood removed as per user request
    const moodTimeout = useRef<NodeJS.Timeout | null>(null);

    const [leftSegmentIndex, setLeftSegmentIndex] = useState(0); // For pagination/segmentation (Left)
    const [rightSegmentIndex, setRightSegmentIndex] = useState(0); // For pagination/segmentation (Right)

    // === LOG VIEW PREFERENCES (저장/로드/업데이트 훅으로 위임) ===
    const {
        logViewPreferences,
        setLogViewPreferences,
        updateLogViewPreferences,
        perfDashboardHeight,
        setPerfDashboardHeight,
        handleZoomIn,
        handleZoomOut,
    } = useLogViewPreferences();

    // === SELECTED RULE ID (탭별 저장/복원) ===
    const { selectedRuleId, setSelectedRuleId } = useSelectedRuleId(rules, tabId);

    const [isDualView, setIsDualView] = useState(false);


    const toggleDualView = useCallback(() => {
        setIsDualView(prev => !prev);
    }, []);

    const { addToast } = useToast();

    // Mapping for legacy showToast calls if needed, otherwise replace them
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        addToast(message, type);
    }, [addToast]);

    // closeToast is no longer needed but kept for ABI compatibility if used elsewhere (bound to be removed)
    const closeToast = useCallback(() => { }, []);

    const leftWorkerRef = useRef<Worker | null>(null);
    const [leftWorkerReady, setLeftWorkerReady] = useState(false);
    const [leftIndexingProgress, setLeftIndexingProgress] = useState(0);
    const [leftTotalLines, setLeftTotalLines] = useState(0);
    const [leftFilteredCount, setLeftFilteredCount] = useState(0);
    const [leftFileName, setLeftFileName] = useState<string | null>(null);
    const [leftFilePath, setLeftFilePath] = useState<string>('');

    // References
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isGoToLineModalOpen, setIsGoToLineModalOpen] = useState(false);
    const leftPendingRequests = useRef<Map<string, (data: any) => void>>(new Map());

    const rightWorkerRef = useRef<Worker | null>(null);
    const [rightWorkerReady, setRightWorkerReady] = useState(false);
    const [rightIndexingProgress, setRightIndexingProgress] = useState(0);
    const [rightTotalLines, setRightTotalLines] = useState(0);
    const [rightFilteredCount, setRightFilteredCount] = useState(0);
    const [rightFileName, setRightFileName] = useState<string>('');
    const rightPendingRequests = useRef<Map<string, (data: any) => void>>(new Map());

    // Stream Request ID (to prevent duplication from React Strict Mode)
    const activeStreamRequestId = useRef<string | null>(null);

    const [selectedIndicesLeft, setSelectedIndicesLeft] = useState<Set<number>>(new Set());
    const [selectedIndicesRight, setSelectedIndicesRight] = useState<Set<number>>(new Set());
    const [activeLineIndexLeft, setActiveLineIndexLeft] = useState<number>(-1); // Anchor/Focus
    const [activeLineIndexRight, setActiveLineIndexRight] = useState<number>(-1); // Anchor/Focus
    const currentConfig = rules.find(r => r.id === selectedRuleId);


    const [leftBookmarks, setLeftBookmarks] = useState<Set<number>>(new Set());
    const [rightBookmarks, setRightBookmarks] = useState<Set<number>>(new Set());
    const [leftPerformanceHeatmap, setLeftPerformanceHeatmap] = useState<number[]>([]);
    const [rightPerformanceHeatmap, setRightPerformanceHeatmap] = useState<number[]>([]);

    // Snapshot for Drag Operations (to support shrinking selection during drag)
    const selectionSnapshotLeftRef = useRef<Set<number>>(new Set());
    const selectionSnapshotRightRef = useRef<Set<number>>(new Set());

    const pendingJumpLineLeft = useRef<{ index: number; align?: 'start' | 'center' | 'end' } | null>(null);
    const pendingJumpLineRight = useRef<{ index: number; align?: 'start' | 'center' | 'end' } | null>(null);



    const toggleLeftBookmark = useCallback((lineIndex: number) => {
        // Delegate to worker
        leftWorkerRef.current?.postMessage({ type: 'TOGGLE_BOOKMARK', payload: { visualIndex: lineIndex } });
    }, []);

    const toggleRightBookmark = useCallback((lineIndex: number) => {
        // Delegate to worker
        rightWorkerRef.current?.postMessage({ type: 'TOGGLE_BOOKMARK', payload: { visualIndex: lineIndex } });
    }, []);

    const clearLeftBookmarks = useCallback(() => {
        leftWorkerRef.current?.postMessage({ type: 'CLEAR_BOOKMARKS' });
    }, []);
    const clearRightBookmarks = useCallback(() => {
        rightWorkerRef.current?.postMessage({ type: 'CLEAR_BOOKMARKS' });
    }, []);
    const [isTizenModalOpen, setIsTizenModalOpen] = useState(false);
    const [isTizenQuickConnect, setIsTizenQuickConnect] = useState(false);

    const [rawContextOpen, setRawContextOpen] = useState(false);
    const [rawContextTargetLine, setRawContextTargetLine] = useState<{ lineNum: number, content: string } | null>(null);
    const [rawContextSourcePane, setRawContextSourcePane] = useState<'left' | 'right'>('left');

    const [rawContextHeight, setRawContextHeight] = useState(50);

    // Load saved height
    useEffect(() => {
        getStoredValue('rawContextHeight').then(val => {
            if (val) setRawContextHeight(parseFloat(val));
        });
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logFileInputRef = useRef<HTMLInputElement>(null);

    const leftViewerRef = useRef<LogViewerHandle>(null);
    const rightViewerRef = useRef<LogViewerHandle>(null);
    const rawViewerRef = useRef<LogViewerHandle>(null);

    // State Restoration Refs
    const pendingScrollTop = useRef<number | null>(null);

    // Quick Filter State (Collect Errors/Exceptions)
    const [quickFilter, setQuickFilter] = useState<'none' | 'error' | 'exception'>('none');

    // Toast Throttling
    const lastErrorToastTime = useRef<number>(0);

    // Spam Analyzer State
    const [isSpamAnalyzerOpen, setIsSpamAnalyzerOpen] = useState(false);

    const [leftLineHighlightRanges, setLeftLineHighlightRanges] = useState<{ start: number; end: number; color: string }[]>([]);
    const [rightLineHighlightRanges, setRightLineHighlightRanges] = useState<{ start: number; end: number; color: string }[]>([]);
    const [rawViewHighlightRange, setRawViewHighlightRange] = useState<{ start: number; end: number } | null>(null);

    // Segmentation Derived Values (Left)
    const leftTotalSegments = Math.ceil(leftFilteredCount / MAX_SEGMENT_SIZE) || 1;
    const leftCurrentSegmentLines = Math.min(MAX_SEGMENT_SIZE, Math.max(0, leftFilteredCount - (leftSegmentIndex * MAX_SEGMENT_SIZE)));

    // Segmentation Derived Values (Right)
    const rightTotalSegments = Math.ceil(rightFilteredCount / MAX_SEGMENT_SIZE) || 1;
    const rightCurrentSegmentLines = Math.min(MAX_SEGMENT_SIZE, Math.max(0, rightFilteredCount - (rightSegmentIndex * MAX_SEGMENT_SIZE)));

    // --- Analysis & Search Actions (Extracted) ---
    const {
        jumpToGlobalLine, jumpToAbsoluteLine, findText, jumpToHighlight,
        analyzeTransactionAction, handleAnalyzePerformanceLeft, handleAnalyzePerformanceRight,
        requestSpamAnalysisLeft, handleJumpToLineLeft, handleJumpToLineRight,
        handleJumpToRangeLeft, handleJumpToRangeRight, handleAnalysisMessage,
        transactionResults, transactionIdentity, transactionSourcePane,
        isAnalyzingTransaction, isTransactionDrawerOpen, setIsTransactionDrawerOpen,
        leftPerfAnalysisResult, rightPerfAnalysisResult,
        isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight,
        isAnalyzingSpam, spamResultsLeft, setSpamResultsLeft
    } = useLogAnalysisActions({
        leftWorkerRef, rightWorkerRef, leftViewerRef, rightViewerRef, rawViewerRef,
        currentConfig,
        leftSegmentIndex, rightSegmentIndex, setLeftSegmentIndex, setRightSegmentIndex,
        leftFilteredCount, rightFilteredCount,
        activeLineIndexLeft, activeLineIndexRight,
        setActiveLineIndexLeft, setActiveLineIndexRight,
        setSelectedIndicesLeft, setSelectedIndicesRight,
        setRawContextOpen, setRawContextTargetLine, setRawContextSourcePane,
        setRawViewHighlightRange, showToast, addToast,
        leftPendingRequests, rightPendingRequests,
        pendingJumpLineLeft, pendingJumpLineRight,
        MAX_SEGMENT_SIZE,
        leftWorkerReady, rightWorkerReady,
        setLeftWorkerReady, setRightWorkerReady
    });


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







    // --- Happy Group Migration Logic ---
    useEffect(() => {
        if (!currentConfig) return;

        // If happyGroups is missing but we have legacy groups, migrate them
        if (!currentConfig.happyGroups && (currentConfig.includeGroups.length > 0 || (currentConfig.disabledGroups && currentConfig.disabledGroups.length > 0))) {
            const newHappyGroups: any[] = []; // Use 'any' temporarily to match HappyGroup interface

            // Note: We can't easily preserve the EXACT original interleaved order if they were split.
            // But going forward, the order will be preserved.
            // We append enabled groups then disabled groups.

            currentConfig.includeGroups.forEach(g => {
                if (g.length > 0 && g[0].trim()) {
                    newHappyGroups.push({
                        id: Math.random().toString(36).substring(7),
                        tags: g,
                        enabled: true
                    });
                }
            });

            if (currentConfig.disabledGroups) {
                currentConfig.disabledGroups.forEach(g => {
                    if (g.length > 0 && g[0].trim()) {
                        newHappyGroups.push({
                            id: Math.random().toString(36).substring(7),
                            tags: g,
                            enabled: false
                        });
                    }
                });
            }

            // Perform the update
            updateCurrentRule({ happyGroups: newHappyGroups });
        } else if (!currentConfig.happyGroups) {
            // If totally empty, initialize empty array
            updateCurrentRule({ happyGroups: [] });
        }
    }, [currentConfig]);

    // === TIZEN / SSH CONNECTION (소켓 관리 훅으로 위임) ===
    const {
        tizenSocket,
        setTizenSocket,
        connectionMode,
        isLogging,
        setIsLogging,
        hasEverConnected,
        shouldAutoScroll,
        clearCacheTick,
        setClearCacheTick,
        handleTizenStreamStart,
        sendTizenCommand,
        handleClearLogs,
        handleTizenDisconnect
    } = useTizenConnection({
        leftWorkerRef,
        rules,
        selectedRuleId,
        quickFilter,
        addToast,
        leftFileName,
        setLeftFileName,
        setLeftFilePath,
        setLeftWorkerReady,
        setLeftIndexingProgress,
        setLeftTotalLines,
        setLeftFilteredCount,
        setActiveLineIndexLeft,
        setSelectedIndicesLeft,
        setLeftBookmarks,
    });


    const lastFilterHashLeft = useRef<string>('');
    const lastFilterHashRight = useRef<string>('');

    // === Phase 2: File Operations & Persistence (Extracted) ===
    const { loadState, handleLeftFileChange, handleRightFileChange } = useLogFileOperations({
        tabId, initialFilePath, initialFile, onFileChange,
        leftWorkerRef, rightWorkerRef, leftViewerRef, tizenSocket,
        activeStreamRequestId, pendingScrollTop,
        setLeftFileName, setLeftFilePath, setLeftWorkerReady, setLeftIndexingProgress,
        setLeftTotalLines, setLeftFilteredCount, setActiveLineIndexLeft, setSelectedIndicesLeft,
        setLeftBookmarks, lastFilterHashLeft,
        setRightFileName, setRightWorkerReady, setRightIndexingProgress,
        setRightTotalLines, setRightFilteredCount, setRightBookmarks, lastFilterHashRight,
        leftFilePath, activeLineIndexLeft
    });

    // Initialize Left Worker & Load State
    useEffect(() => {
        let isStale = false;
        leftWorkerRef.current = new Worker(new URL('../workers/LogProcessor.worker.ts', import.meta.url), { type: 'module' });

        let cleanupListeners: (() => void)[] = [];

        loadState();

        leftWorkerRef.current.onmessage = (e: MessageEvent<LogWorkerResponse>) => {
            if (isStale) return;
            const { type, payload, requestId } = e.data;
            // ... (rest of onmessage logic)
            if (type === 'ERROR') console.error('[useLog] Worker Error:', payload.error);
            if (type === 'INDEX_COMPLETE') console.log('[useLog-Left] Worker INDEX_COMPLETE:', payload);
            if (type === 'FILTER_COMPLETE') console.log('[useLog-Left] Worker FILTER_COMPLETE matches:', payload.matchCount, 'total:', payload.totalLines);

            if (requestId && leftPendingRequests.current.has(requestId)) {
                const resolve = leftPendingRequests.current.get(requestId);
                if (type === 'LINES_DATA') {
                    resolve && resolve(payload.lines);
                } else if (type === 'FIND_RESULT') {
                    resolve && resolve(payload);
                } else if (type === 'FULL_TEXT_DATA') {
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
                    setLeftIndexingProgress(100); // Ensure 100% on completion
                    break;
                case 'FILTER_COMPLETE':
                    setLeftFilteredCount(payload.matchCount);
                    if (typeof payload.totalLines === 'number') setLeftTotalLines(payload.totalLines);
                    if (payload.visualBookmarks) {
                        setLeftBookmarks(new Set(payload.visualBookmarks));
                    }
                    setLeftWorkerReady(true);
                    // 💡 성능 히트맵 요청 (500 포인트)
                    leftWorkerRef.current?.postMessage({ type: 'GET_PERFORMANCE_HEATMAP', payload: { points: 500 } });
                    break;
                case 'HEATMAP_DATA':
                    console.log(`[useLog] Received HEATMAP_DATA:`, {
                        points: payload.heatmap?.length,
                        hasData: payload.heatmap?.some((v: number) => v > 0)
                    });
                    setLeftPerformanceHeatmap(payload.heatmap || []);
                    break;
                case 'BOOKMARKS_UPDATED':
                    if (payload.visualBookmarks) {
                        setLeftBookmarks(new Set(payload.visualBookmarks));
                    }
                    break;
                case 'ERROR':
                    console.error('Left Worker Error:', payload.error);
                    break;
                case 'ERROR':
                    console.error('Left Worker Error:', payload.error);
                    break;
                default:
                    handleAnalysisMessage('left', type, payload);
                    break;
            }
        };

        return () => {
            isStale = true;
            leftWorkerRef.current?.terminate();
            cleanupListeners.forEach(cleanup => cleanup());
        };
    }, []); // Run once on mount

    // Initialize Right Worker
    useEffect(() => {
        let isStale = false;
        rightWorkerRef.current = new Worker(new URL('../workers/LogProcessor.worker.ts', import.meta.url), { type: 'module' });

        rightWorkerRef.current.onmessage = (e: MessageEvent<LogWorkerResponse>) => {
            if (isStale) return;
            const { type, payload, requestId } = e.data;
            // ...

            if (requestId && rightPendingRequests.current.has(requestId)) {
                const resolve = rightPendingRequests.current.get(requestId);
                if (type === 'LINES_DATA') {
                    resolve && resolve(payload.lines);
                } else if (type === 'FIND_RESULT') {
                    resolve && resolve(payload);
                } else if (type === 'FULL_TEXT_DATA') {
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
                    if (typeof payload.totalLines === 'number') setRightTotalLines(payload.totalLines);
                    if (payload.visualBookmarks) {
                        setRightBookmarks(new Set(payload.visualBookmarks));
                    }
                    setRightWorkerReady(true);
                    setActiveLineIndexRight(-1);
                    setSelectedIndicesRight(new Set());
                    // 💡 성능 히트맵 요청 (500 포인트)
                    rightWorkerRef.current?.postMessage({ type: 'GET_PERFORMANCE_HEATMAP', payload: { points: 500 } });
                    break;
                case 'HEATMAP_DATA':
                    console.log(`[useLog-Right] Received HEATMAP_DATA:`, {
                        points: payload.heatmap?.length,
                        hasData: payload.heatmap?.some((v: number) => v > 0)
                    });
                    setRightPerformanceHeatmap(payload.heatmap || []);
                    break;
                case 'BOOKMARKS_UPDATED':
                    if (payload.visualBookmarks) {
                        setRightBookmarks(new Set(payload.visualBookmarks));
                    }
                    break;
                default:
                    handleAnalysisMessage('right', type, payload);
                    break;
            }
        };

        return () => {
            isStale = true;
            rightWorkerRef.current?.terminate();
        };
    }, []);


    // Auto-Apply Filter (Left)
    useEffect(() => {
        // ✅ Optimization: Allow filtering if worker exists, even if not "ready" (unless indexing)
        // This ensures the loader displays immediately when config changes.
        if (leftWorkerRef.current && currentConfig) {
            const refinedGroups = assembleIncludeGroups(currentConfig);

            const effectiveIncludes = refinedGroups.map(g =>
                g.map(t => (!currentConfig.happyCombosCaseSensitive ? t.trim().toLowerCase() : t.trim())).filter(t => t !== '')
            ).filter(g => g.length > 0);
            const effectiveExcludes = currentConfig.excludes.map(e => (!currentConfig.blockListCaseSensitive ? e.trim().toLowerCase() : e.trim())).filter(e => e !== '');

            const payloadHash = JSON.stringify({
                inc: effectiveIncludes,
                exc: effectiveExcludes,
                happyCase: !!currentConfig.happyCombosCaseSensitive,
                blockCase: !!currentConfig.blockListCaseSensitive,
                quickFilter
            });

            if (payloadHash === lastFilterHashLeft.current) {
                return;
            }
            lastFilterHashLeft.current = payloadHash;

            // Immediately set to not ready to show loader without delay
            setLeftWorkerReady(false);

            // 🔍 DEBUG: Check what is being sent to the worker
            console.log('[useLog-Left] Sending FILTER_LOGS. hash:', payloadHash, 'ruleId:', currentConfig.id);

            leftWorkerRef.current.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...currentConfig, includeGroups: refinedGroups, quickFilter }
            });

            if (!tizenSocket) {
                setActiveLineIndexLeft(-1);
                setSelectedIndicesLeft(new Set());
            }
        }
    }, [currentConfig, tizenSocket, quickFilter]);



    // Auto-Apply Filter (Right)
    useEffect(() => {
        if (isDualView && rightWorkerRef.current && currentConfig && rightTotalLines > 0) {
            const refinedGroups = assembleIncludeGroups(currentConfig);

            // Optimization: Check if effective filter changed
            // Optimization: Check if effective filter changed
            const effectiveIncludes = refinedGroups.map(g =>
                g.map(t => (!currentConfig.happyCombosCaseSensitive ? t.trim().toLowerCase() : t.trim())).filter(t => t !== '')
            ).filter(g => g.length > 0);
            const effectiveExcludes = currentConfig.excludes.map(e => (!currentConfig.blockListCaseSensitive ? e.trim().toLowerCase() : e.trim())).filter(e => e !== '');

            const payloadHash = JSON.stringify({
                inc: effectiveIncludes,
                exc: effectiveExcludes,
                happyCase: !!currentConfig.happyCombosCaseSensitive,
                blockCase: !!currentConfig.blockListCaseSensitive,
                quickFilter
            });

            if (payloadHash === lastFilterHashRight.current) {
                return;
            }
            lastFilterHashRight.current = payloadHash;


            console.log('[useLog-Right] Sending FILTER_LOGS. hash:', payloadHash, 'ruleId:', currentConfig.id);
            setRightWorkerReady(false);
            rightWorkerRef.current.postMessage({
                type: 'FILTER_LOGS',
                payload: { ...currentConfig, includeGroups: refinedGroups, quickFilter }
            });
        }
    }, [currentConfig, rightTotalLines, isDualView, quickFilter]);


    useEffect(() => {
        return () => {
            if (tizenSocket) {
                tizenSocket.emit('disconnect_sdb');
                tizenSocket.emit('disconnect_ssh');
                tizenSocket.disconnect();
            }
        };
    }, [tizenSocket]);

    // ✅ Ref for synchronous access inside event handlers (Fixes Drag Selection issues)
    const activeLineIndexLeftRef = useRef<number>(-1);
    const activeLineIndexRightRef = useRef<number>(-1);

    // Sync Ref with State changes (useEffect) is risky for immediate events.
    // Better to update Ref wherever we update State, OR use Ref as truth in handlers.
    // Let's update Ref when State changes to be safe, but primarily update Ref manually before State.
    useEffect(() => { activeLineIndexLeftRef.current = activeLineIndexLeft; }, [activeLineIndexLeft]);
    useEffect(() => { activeLineIndexRightRef.current = activeLineIndexRight; }, [activeLineIndexRight]);

    const selectedIndicesLeftRef = useRef<Set<number>>(new Set());
    const selectedIndicesRightRef = useRef<Set<number>>(new Set());



    // Selection Helpers
    const handleLineClick = useCallback((pane: 'left' | 'right', index: number, isShift: boolean, isCtrl: boolean) => {
        const setActive = pane === 'left' ? setActiveLineIndexLeft : setActiveLineIndexRight;
        const setSelection = pane === 'left' ? setSelectedIndicesLeft : setSelectedIndicesRight;

        const anchorRef = pane === 'left' ? activeLineIndexLeftRef : activeLineIndexRightRef;
        const currentActive = anchorRef.current;
        const snapshotRef = pane === 'left' ? selectionSnapshotLeftRef : selectionSnapshotRightRef;

        // ✅ Handle Deselect (index === -1)
        if (index === -1) {
            setSelection(new Set());
            snapshotRef.current = new Set();
            anchorRef.current = -1;
            setActive(-1);
            return;
        }

        // console.log(`[useLog] Click: pane=${pane}, idx=${index}, shift=${isShift}, ctrl=${isCtrl}, currAnchor=${currentActive}`);

        if (isShift && currentActive !== -1) {
            // Range Selection (Drag or Shift+Click)
            const start = Math.min(currentActive, index);
            const end = Math.max(currentActive, index);
            const range = new Set<number>();
            for (let i = start; i <= end; i++) range.add(i);

            // NOTE: isShift=true (Drag/ShiftClick) does not move the anchor.
            if (isCtrl) {
                // Union with SNAPSHOT (Ctrl + Shift/Drag)
                // Usin snapshot allows shrinking the drag range correctly
                setSelection(() => {
                    const next = new Set(snapshotRef.current);
                    range.forEach(idx => next.add(idx));
                    return next;
                });
            } else {
                // Replace selection (Standard Shift/Drag)
                setSelection(range);
            }
        } else if (isCtrl) {
            // Toggle Selection
            setSelection(prev => {
                const next = new Set(prev);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                // Update Snapshot after toggle
                snapshotRef.current = new Set(next);
                return next;
            });
            // Update Anchor
            anchorRef.current = index;
            setActive(index);
        } else {
            // Single Selection (Reset Anchor)
            const next = new Set([index]);
            setSelection(next);
            snapshotRef.current = next; // Update Snapshot
            anchorRef.current = index;
            setActive(index);
        }
    }, []); // Removed dependencies on activeLineIndex to prevent recreation during rapid events






    const requestLeftLines = useCallback((startIndex: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve, reject) => {
            if (!leftWorkerRef.current) return resolve([]);
            const realStart = startIndex + (leftSegmentIndex * MAX_SEGMENT_SIZE);
            const reqId = Math.random().toString(36).substring(7);
            const timeout = setTimeout(() => {
                leftPendingRequests.current.delete(reqId);
                reject(new Error('Request timed out'));
            }, 10000);
            leftPendingRequests.current.set(reqId, (data: any) => {
                clearTimeout(timeout);
                resolve(data);
            });
            leftWorkerRef.current.postMessage({ type: 'GET_LINES', payload: { startLine: realStart, count }, requestId: reqId });
        });
    }, [leftSegmentIndex]);

    const requestLeftRawLines = useCallback((startLine: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!leftWorkerRef.current) return resolve([]);
            const reqId = Math.random().toString(36).substring(7);
            leftPendingRequests.current.set(reqId, resolve);
            leftWorkerRef.current.postMessage({ type: 'GET_RAW_LINES', payload: { startLine, count }, requestId: reqId });
        });
    }, []);



    const requestRightLines = useCallback((startIndex: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve, reject) => {
            if (!rightWorkerRef.current) return resolve([]);
            const realStart = startIndex + (rightSegmentIndex * MAX_SEGMENT_SIZE);
            const reqId = Math.random().toString(36).substring(7);
            const timeout = setTimeout(() => {
                rightPendingRequests.current.delete(reqId);
                reject(new Error('Request timed out'));
            }, 10000);

            rightPendingRequests.current.set(reqId, (data: any) => {
                clearTimeout(timeout);
                resolve(data);
            });
            rightWorkerRef.current.postMessage({ type: 'GET_LINES', payload: { startLine: realStart, count }, requestId: reqId });
        });
    }, [rightSegmentIndex]);

    const requestRightRawLines = useCallback((startLine: number, count: number) => {
        return new Promise<{ lineNum: number; content: string }[]>((resolve) => {
            if (!rightWorkerRef.current) return resolve([]);
            const reqId = crypto.randomUUID();
            rightPendingRequests.current.set(reqId, resolve);
            rightWorkerRef.current.postMessage({ type: 'GET_RAW_LINES', payload: { startLine, count }, requestId: reqId });
        });
    }, []);

    const handleViewRawRangeLeft = useCallback(async (start: number, end: number, filteredIndex?: number) => {
        const relativeIndex = start - 1;
        try {
            const lines = await requestLeftRawLines(relativeIndex, 1);
            if (lines && lines.length > 0) {
                setRawContextTargetLine({ ...lines[0], formattedLineIndex: filteredIndex ?? '?' } as any);
                setRawContextSourcePane('left');
                setRawViewHighlightRange({ start, end });
                setRawContextOpen(true);
            }
        } catch (e) {
            console.error('[Perf] Failed to view raw range', e);
        }
    }, [requestLeftRawLines]);

    const handleViewRawRangeRight = useCallback(async (start: number, end: number, filteredIndex?: number) => {
        const relativeIndex = start - 1;
        try {
            const lines = await requestRightRawLines(relativeIndex, 1);
            if (lines && lines.length > 0) {
                setRawContextTargetLine({ ...lines[0], formattedLineIndex: filteredIndex ?? '?' } as any);
                setRawContextSourcePane('right');
                setRawViewHighlightRange({ start, end });
                setRawContextOpen(true);
            }
        } catch (e) {
            console.error('[Perf] Failed to view raw range', e);
        }
    }, [requestRightRawLines]);

    const handleCopyRawRangeLeft = useCallback(async (start: number, end: number) => {
        const count = end - start + 1;
        if (count <= 0) return;
        try {
            const lines = await requestLeftRawLines(start - 1, count);
            if (lines && lines.length > 0) {
                const text = lines.map(l => l.content).join('\n');
                await navigator.clipboard.writeText(text);
                showToast(`${lines.length} lines copied to clipboard!`, 'success');
            }
        } catch (e) {
            console.error('[Perf] Failed to copy logs', e);
            showToast('Failed to copy logs.', 'error');
        }
    }, [requestLeftRawLines, showToast]);

    const handleCopyRawRangeRight = useCallback(async (start: number, end: number) => {
        const count = end - start + 1;
        if (count <= 0) return;
        try {
            const lines = await requestRightRawLines(start - 1, count);
            if (lines && lines.length > 0) {
                const text = lines.map(l => l.content).join('\n');
                await navigator.clipboard.writeText(text);
                showToast(`${lines.length} lines copied to clipboard!`, 'success');
            }
        } catch (e) {
            console.error('[Perf] Failed to copy logs', e);
            showToast('Failed to copy logs.', 'error');
        }
    }, [requestRightRawLines, showToast]);

    const requestLeftFullText = useCallback(() => {
        return new Promise<string>((resolve) => {
            if (!leftWorkerRef.current) return resolve('');
            const reqId = Math.random().toString(36).substring(7);
            leftPendingRequests.current.set(reqId, (payload: any) => {
                if (payload.buffer) {
                    const decoder = new TextDecoder();
                    resolve(decoder.decode(payload.buffer));
                } else {
                    resolve(payload.text || '');
                }
            });
            leftWorkerRef.current.postMessage({ type: 'GET_FULL_TEXT', requestId: reqId });
        });
    }, []);

    const requestRightFullText = useCallback(() => {
        return new Promise<string>((resolve) => {
            if (!rightWorkerRef.current) return resolve('');
            const reqId = Math.random().toString(36).substring(7);
            rightPendingRequests.current.set(reqId, (payload: any) => {
                if (payload.buffer) {
                    const decoder = new TextDecoder();
                    resolve(decoder.decode(payload.buffer));
                } else {
                    resolve(payload.text || '');
                }
            });
            rightWorkerRef.current.postMessage({ type: 'GET_FULL_TEXT', requestId: reqId });
        });
    }, []);

    const requestBookmarkedLines = useCallback((indices: number[], paneId: 'left' | 'right') => {
        return new Promise<any[]>((resolve) => {
            const worker = paneId === 'left' ? leftWorkerRef.current : rightWorkerRef.current;
            const requestMap = paneId === 'left' ? leftPendingRequests.current : rightPendingRequests.current;

            if (!worker || indices.length === 0) return resolve([]);

            const reqId = Math.random().toString(36).substring(7);
            requestMap.set(reqId, resolve);
            worker.postMessage({ type: 'GET_LINES_BY_INDICES', payload: { indices }, requestId: reqId });
        });
    }, []);

    const handleLeftReset = useCallback(() => {
        setLeftFileName('');
        setLeftWorkerReady(false);
        setLeftTotalLines(0);
        setLeftFilteredCount(0);
        setActiveLineIndexLeft(-1);
        setSelectedIndicesLeft(new Set());
        setLeftBookmarks(new Set()); // Clear bookmarks
        lastFilterHashLeft.current = '';
    }, []);

    const handleRightReset = useCallback(() => {
        setRightFileName('');
        setRightWorkerReady(false);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setActiveLineIndexRight(-1);
        setSelectedIndicesRight(new Set());
        setRightBookmarks(new Set()); // Clear bookmarks
        lastFilterHashRight.current = '';
    }, []);



    const handleCopyLogs = useCallback(async (paneId: 'left' | 'right') => {
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        const selectedIndices = paneId === 'left' ? selectedIndicesLeftRef.current : selectedIndicesRightRef.current;
        const requestFullText = paneId === 'left' ? requestLeftFullText : requestRightFullText;
        const requestSpecificLines = paneId === 'left'
            ? (indices: number[]) => requestBookmarkedLines(indices, 'left')
            : (indices: number[]) => requestBookmarkedLines(indices, 'right');

        if (count <= 0) {
            showToast('No logs to copy.', 'info');
            return;
        }

        const isSelectionCopy = selectedIndices.size > 0;
        // 안내 토스트 제거 (사용자 요청: 중복 방지)

        try {
            console.time('copy-fetch');
            let content = '';

            if (isSelectionCopy) {
                const indices = Array.from(selectedIndices).sort((a, b) => a - b);
                const lines = await requestSpecificLines(indices);
                content = lines.map(l => l.content).join('\n');
            } else {
                content = await requestFullText();
            }
            console.timeEnd('copy-fetch');

            // 🔥 Log Copy Precision: Remove trailing newline to prevent extra line breaks on paste
            content = content.replace(/\r?\n$/, '');

            if (!content) {
                showToast('Failed to retrieve log content.', 'error');
                return;
            }

            // Allow UI to breathe before heavy copy
            await new Promise(resolve => setTimeout(resolve, 50));

            if (window.electronAPI?.copyToClipboard) {
                await window.electronAPI.copyToClipboard(content);
            } else if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(content);
            } else {
                // Fallback
                const textArea = document.createElement("textarea");
                textArea.value = content;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (e) {
                    console.error('Fallback copy failed', e);
                    showToast('Failed to copy logs (Fallback error).', 'error');
                    document.body.removeChild(textArea);
                    return;
                }
                document.body.removeChild(textArea);
            }
            showToast(`Copied ${isSelectionCopy ? selectedIndices.size.toLocaleString() : count.toLocaleString()} lines!`, 'success');

        } catch (e) {
            console.error('[Copy] Failed', e);
            showToast('Failed to copy logs.', 'error');
        }
    }, [leftFilteredCount, rightFilteredCount, requestLeftFullText, requestRightFullText, requestBookmarkedLines, showToast]);

    const handleSaveLogs = useCallback(async (paneId: 'left' | 'right') => {
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        const requestFullText = paneId === 'left' ? requestLeftFullText : requestRightFullText;
        if (count <= 0) {
            showToast('No logs to save.', 'info');
            return;
        }

        try {
            console.time('save-fetch');
            const content = await requestFullText();
            console.timeEnd('save-fetch');

            if (!content) {
                showToast('Failed to retrieve log content.', 'error');
                return;
            }

            if (window.electronAPI?.saveFile) {
                const result = await window.electronAPI.saveFile(content);
                if (result.status === 'success') {
                    console.log('[Save] Success', result.filePath);
                    showToast(`Saved to ${result.filePath}`, 'success');
                } else if (result.status === 'error') {
                    showToast(`Save failed: ${(result as any).error}`, 'error');
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
                showToast('Download triggered (Web)', 'success');
            }
        } catch (e) {
            console.error('[Save] Failed', e);
            showToast('Failed to save logs.', 'error');
        }
    }, [leftFilteredCount, rightFilteredCount, requestLeftFullText, requestRightFullText, showToast]);

    const updateCurrentRule = useCallback((updates: Partial<LogRule>) => {
        const updatedRules = rules.map(r => r.id === selectedRuleId ? { ...r, ...updates } : r);

        onUpdateRules(updatedRules);
    }, [rules, selectedRuleId, onUpdateRules]);

    const handleCreateRule = useCallback(() => {
        const newId = Math.random().toString(36).substring(7);
        const newRule: LogRule = {
            id: newId,
            name: 'New Analysis',
            includeGroups: [['']],
            happyGroups: [], // Initialize empty
            excludes: [],
            highlights: [],
            happyCombosCaseSensitive: false,
            blockListCaseSensitive: false,
            colorHighlightsCaseSensitive: false
        };
        onUpdateRules([...rules, newRule]);
        setSelectedRuleId(newId);
        if (!isPanelOpen) setIsPanelOpen(true);
    }, [rules, onUpdateRules, isPanelOpen]);

    const handleDeleteRule = useCallback(() => {
        const updated = rules.filter(r => r.id !== selectedRuleId);
        onUpdateRules(updated);
        setSelectedRuleId(updated.length > 0 ? updated[0].id : '');
    }, [rules, selectedRuleId, onUpdateRules]);

    const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onImportSettings(json);
                showToast('Settings imported!', 'success');
            } catch (error) { showToast('Failed to parse settings file.', 'error'); }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [onImportSettings, showToast]);

    const handleLogFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleLeftFileChange(e.target.files[0]);
    }, [handleLeftFileChange]);

    const handleToggleRoot = useCallback((root: string, enabled: boolean) => {
        if (!currentConfig) return;

        if (currentConfig.happyGroups) {
            // New Logic: Toggle enabled state but keep order
            const newHappyGroups = currentConfig.happyGroups.map(group => {
                const groupRoot = (group.tags[0] || '').trim();
                if (groupRoot === root) {
                    return { ...group, enabled };
                }
                return group;
            });
            updateCurrentRule({
                happyGroups: newHappyGroups,
                includeGroups: [],

            });
        } else {
            // Legacy Logic
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
        }
    }, [currentConfig, updateCurrentRule]);

    const groupedRoots = useMemo(() => {
        if (!currentConfig) return [];
        const groups = new Map<string, { group: string[], active: boolean, originalIdx: number, id?: string, alias?: string }[]>();

        if (currentConfig.happyGroups) {
            currentConfig.happyGroups.forEach((hGroup, idx) => {
                const root = (hGroup.tags[0] || '').trim();
                if (!root) return;
                if (!groups.has(root)) groups.set(root, []);
                groups.get(root)!.push({
                    group: hGroup.tags,
                    active: hGroup.enabled,
                    originalIdx: idx,
                    id: hGroup.id,
                    alias: hGroup.alias
                });
            });
        } else {
            // Legacy Fallback
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
        }

        return Array.from(groups.entries()).map(([root, items]) => {
            const isRootEnabled = items.some(i => i.active);
            return { root, isRootEnabled, items };
        });
    }, [currentConfig?.includeGroups, currentConfig?.disabledGroups, currentConfig?.happyGroups]);

    const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(new Set());

    useEffect(() => {
        getStoredValue('collapsedRoots').then(saved => {
            if (saved) {
                try {
                    setCollapsedRoots(new Set(JSON.parse(saved)));
                } catch (e) { }
            }
        });
    }, []);

    useEffect(() => {
        if (collapsedRoots.size > 0)
            setStoredValue('collapsedRoots', JSON.stringify(Array.from(collapsedRoots)));
    }, [collapsedRoots]);

    const handleLineDoubleClickAction = useCallback(async (index: number, paneId: 'left' | 'right' = 'left') => {
        console.log(`[Double Click Debug] Clicked Index (Filtered Global): ${index}`);

        const requestLines = paneId === 'left' ? requestLeftLines : requestRightLines;
        const currentSegmentIndex = paneId === 'left' ? leftSegmentIndex : rightSegmentIndex;

        // Index is Global. requestLines expects Relative Index (because it adds offset itself).
        // Apply segment adjustment for both panes.
        const relativeIndex = index % MAX_SEGMENT_SIZE;
        console.log(`[Double Click Debug] Relative Index: ${relativeIndex}, Current Segment: ${currentSegmentIndex}`);

        try {
            const lines = await requestLines(relativeIndex, 1);
            if (lines && lines.length > 0) {
                console.log(`[Double Click Debug] Worker Returned Original Line Num: ${lines[0].lineNum}`);
                setRawViewHighlightRange(null); // Clear range when viewing single line
                setRawContextTargetLine({ ...lines[0], formattedLineIndex: index + 1 } as any);
                setRawContextSourcePane(paneId);
                setRawContextOpen(true);
            } else {
                console.warn(`[Double Click Debug] Worker returned NO lines for index ${relativeIndex}`);
                // Retry once with a small delay in case of race condition in stream mode
                setTimeout(async () => {
                    try {
                        const retryLines = await requestLines(relativeIndex, 1);
                        if (retryLines && retryLines.length > 0) {
                            setRawContextTargetLine({ ...retryLines[0], formattedLineIndex: index + 1 } as any);
                            setRawContextSourcePane(paneId);
                            setRawContextOpen(true);
                        } else {
                            showToast('Failed to load raw line details (empty response)', 'error');
                        }
                    } catch (retryErr) {
                        console.error('Retry failed', retryErr);
                    }
                }, 100);
            }
        } catch (error) {
            console.error('[Double Click] Error requesting lines:', error);
            showToast('Failed to open raw view', 'error');
        }
    }, [requestLeftLines, requestRightLines, leftSegmentIndex, rightSegmentIndex]);

    const handleRawContextResizeStart = useCallback((e: React.MouseEvent) => {
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
            setStoredValue('rawContextHeight', rawContextHeight.toString());
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [rawContextHeight]);

    const handleConfigResizeStart = useCallback((e: React.MouseEvent) => {
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
    }, [configPanelWidth, setConfigPanelWidth]);


    // === Phase 1: Keyboard Shortcuts (Extracted) ===
    useLogShortcuts({
        isActive,
        isDualView,
        leftViewerRef,
        rightViewerRef,
        activeLineIndexLeft,
        activeLineIndexRight,
        setSelectedIndicesLeft,
        setSelectedIndicesRight,
        selectedIndicesLeft,
        selectedIndicesRight,
        leftTotalLines,
        rightTotalLines,
        rawContextOpen,
        setRawContextOpen,
        isTransactionDrawerOpen,
        setIsTransactionDrawerOpen,
        handleZoomIn,
        handleZoomOut,
        logViewPreferences,
        setActiveLineIndexLeft,
        setActiveLineIndexRight,
        activeLineIndexAnchorLeft: activeLineIndexLeft, // Using state as anchor
        activeLineIndexAnchorRight: activeLineIndexRight
    });


    return {
        rules, tabId, onExportSettings, onImportSettings,
        selectedRuleId, setSelectedRuleId, currentConfig,
        groupedRoots, collapsedRoots, setCollapsedRoots,
        updateCurrentRule, handleCreateRule, handleDeleteRule, handleToggleRoot,
        isDualView, setIsDualView, toggleDualView,
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, setConfigPanelWidth, handleConfigResizeStart,
        rawContextOpen, setRawContextOpen, rawContextHeight, handleRawContextResizeStart,
        rawContextTargetLine, rawContextSourcePane,
        isTizenModalOpen, setIsTizenModalOpen, isTizenQuickConnect, setIsTizenQuickConnect,
        fileInputRef, logFileInputRef, leftViewerRef, rightViewerRef, rawViewerRef,
        handleImportFile, handleLogFileSelect,
        handleTizenStreamStart, handleTizenDisconnect, tizenSocket,
        handleLineDoubleClickAction,
        leftFileName, leftWorkerReady, leftIndexingProgress, leftTotalLines, leftFilteredCount,
        activeLineIndexLeft, setActiveLineIndexLeft, selectedIndicesLeft, setSelectedIndicesLeft,
        handleLeftFileChange, handleLeftReset, requestLeftLines, requestLeftRawLines,
        rightFileName, rightWorkerReady, rightIndexingProgress, rightTotalLines, rightFilteredCount,
        activeLineIndexRight, setActiveLineIndexRight, selectedIndicesRight, setSelectedIndicesRight,
        leftBookmarks, rightBookmarks, toggleLeftBookmark, toggleRightBookmark,
        clearLeftBookmarks, clearRightBookmarks,
        handleRightFileChange, handleRightReset, requestRightLines, requestRightRawLines,
        handleCopyLogs, handleSaveLogs, jumpToHighlight, findText,
        requestBookmarkedLines, sendTizenCommand, hasEverConnected, handleClearLogs,
        jumpToGlobalLine, handleLineClick,
        leftSegmentIndex, setLeftSegmentIndex, leftTotalSegments, leftCurrentSegmentLines,
        rightSegmentIndex, setRightSegmentIndex, rightTotalSegments, rightCurrentSegmentLines,
        searchInputRef, isGoToLineModalOpen, setIsGoToLineModalOpen,
        logViewPreferences, updateLogViewPreferences,
        perfDashboardHeight,
        setPerfDashboardHeight: (h: number) => {
            setPerfDashboardHeight(h);
            setStoredValue('perfDashboardHeight', h.toString());
        },
        handleZoomIn, handleZoomOut,
        isLogging, setIsLogging, connectionMode,
        isSearchFocused, setIsSearchFocused,
        quickFilter, setQuickFilter,
        leftPerfAnalysisResult, rightPerfAnalysisResult,
        isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight,
        handleAnalyzePerformanceLeft, handleAnalyzePerformanceRight,
        handleJumpToLineLeft, handleJumpToLineRight,
        handleJumpToRangeLeft, handleJumpToRangeRight,
        leftLineHighlightRanges, rightLineHighlightRanges,
        rawViewHighlightRange,
        analyzeTransactionAction, transactionResults, transactionIdentity, transactionSourcePane,
        isAnalyzingTransaction, isTransactionDrawerOpen, setIsTransactionDrawerOpen,
        jumpToAbsoluteLine,
        isSpamAnalyzerOpen, setIsSpamAnalyzerOpen,
        isAnalyzingSpam, spamResultsLeft, requestSpamAnalysisLeft,
        leftPerformanceHeatmap, rightPerformanceHeatmap,
        clearCacheTick,
        handleViewRawRangeLeft, handleViewRawRangeRight,
        handleCopyRawRangeLeft, handleCopyRawRangeRight,
    };
};
