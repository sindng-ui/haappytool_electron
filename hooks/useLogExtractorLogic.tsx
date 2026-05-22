import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getStoredValue, setStoredValue } from '../utils/db';
import { LogRule, AppSettings, LogWorkerResponse, LogViewPreferences, SpamLogResult, LogHighlight } from '../types';
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
import { useLogExportActions } from './useLogExportActions';
import { useLogSelection } from './useLogSelection';
import { useLogWorkerEvents } from './useLogWorkerEvents';
import { workerRegistry } from './LogWorkerRegistry';
// import LogProcessorWorker from '../workers/LogProcessor.worker.ts?worker'; // Registry에서 관리







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
    onAddTab?: (title: string, content: string) => void; // ✅ New Tab Callback
    onOpenFile?: (file: File) => void; // 🎯 전역 파일 오픈 위임
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
    isSearchFocused: propIsSearchFocused, setIsSearchFocused: propSetIsSearchFocused, // ✅ Destructure new props
    onAddTab, // ✅ New Tab Callback
    onOpenFile // 🎯 전역 파일 오픈 위임
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
        splitAnalyzerHeight,
        setSplitAnalyzerHeight,
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
    const [rightFilePath, setRightFilePath] = useState<string>(''); // ✅ Track Right File Path for Persistence
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
    const [splitRatio, setSplitRatio] = useState(0.5); // ✅ Split Ratio for Dual View

    // --- Tab Background Optimization ---
    useEffect(() => {
        if (leftWorkerRef.current) {
            leftWorkerRef.current.postMessage({ type: 'SET_ACTIVE_STATE', payload: isActive });
        }
        if (rightWorkerRef.current) {
            rightWorkerRef.current.postMessage({ type: 'SET_ACTIVE_STATE', payload: isActive });
        }
    }, [isActive]);

    // --- Shared Memory Buffers (Phase 2) ---
    const [leftSharedBuffers, setLeftSharedBuffers] = useState<any>(null);
    const [rightSharedBuffers, setRightSharedBuffers] = useState<any>(null);

    // Stream Request ID (to prevent duplication from React Strict Mode)
    const activeStreamRequestIdLeft = useRef<string | null>(null);
    const activeStreamRequestIdRight = useRef<string | null>(null);

    const [selectedIndicesLeft, setSelectedIndicesLeft] = useState<Set<number>>(new Set());
    const [selectedIndicesRight, setSelectedIndicesRight] = useState<Set<number>>(new Set());
    const selectedIndicesLeftRef = useRef<Set<number>>(new Set());
    const selectedIndicesRightRef = useRef<Set<number>>(new Set());

    useEffect(() => { selectedIndicesLeftRef.current = selectedIndicesLeft; }, [selectedIndicesLeft]);
    useEffect(() => { selectedIndicesRightRef.current = selectedIndicesRight; }, [selectedIndicesRight]);
    const [activeLineIndexLeft, setActiveLineIndexLeft] = useState<number>(-1); // Anchor/Focus
    const [activeLineIndexRight, setActiveLineIndexRight] = useState<number>(-1); // Anchor/Focus
    const currentConfig = rules.find(r => r.id === selectedRuleId);

    // 🐧🎯 형님! 엇박자 해결을 위해 '실제로 적용된 설정' 상태를 도입합니다.
    const [appliedConfig, setAppliedConfig] = useState<any>(currentConfig);

    // Update appliedConfig when currentConfig is stable (no more updates for a while)
    useEffect(() => {
        if (!currentConfig) return;
        const timer = setTimeout(() => {
            setAppliedConfig(currentConfig);
        }, 150); // 🐧 150ms 정도 숨을 고르고 적용합니다. (필터 디바운스와 일치)
        return () => clearTimeout(timer);
    }, [currentConfig]);


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

    // 🐧🎯 형님! 전역 다이얼로그를 위한 상태값입니다.
    const [dialogConfig, setDialogConfig] = useState<any>(null);

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
        setSelectedIndicesLeft,
        setSelectedIndicesRight,
        setRawContextOpen, setRawContextTargetLine, setRawContextSourcePane,
        setRawViewHighlightRange, showToast, addToast,
        leftPendingRequests, rightPendingRequests,
        pendingJumpLineLeft, pendingJumpLineRight,
        MAX_SEGMENT_SIZE,
        leftWorkerReady, rightWorkerReady,
        setLeftWorkerReady, setRightWorkerReady
    });

    // --- Execute Pending Jumps after Render (Page/Segment Switch) ---
    useEffect(() => {
        if (pendingJumpLineLeft.current && leftWorkerReady && leftCurrentSegmentLines > 0) {
            const { index, align } = pendingJumpLineLeft.current;
            pendingJumpLineLeft.current = null;
            setTimeout(() => {
                leftViewerRef.current?.scrollToIndex(index, { align });
            }, 50);
        }
    }, [leftSegmentIndex, leftWorkerReady, leftCurrentSegmentLines, leftViewerRef]);

    useEffect(() => {
        // Dual view일 때만 right logic 발동
        if (pendingJumpLineRight.current && rightWorkerReady && rightCurrentSegmentLines > 0 && isDualView) {
            const { index, align } = pendingJumpLineRight.current;
            pendingJumpLineRight.current = null;
            setTimeout(() => {
                rightViewerRef.current?.scrollToIndex(index, { align });
            }, 50);
        }
    }, [rightSegmentIndex, rightWorkerReady, rightCurrentSegmentLines, rightViewerRef, isDualView]);

    const { handleWorkerMessage } = useLogWorkerEvents();



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
        sendSerialSpecialKey,
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
        leftWorkerRef, rightWorkerRef, leftViewerRef, rightViewerRef, tizenSocket,
        activeStreamRequestIdLeft, activeStreamRequestIdRight, pendingScrollTop,
        setLeftFileName, setLeftFilePath, setLeftWorkerReady, setLeftIndexingProgress,
        setLeftTotalLines, setLeftFilteredCount, setActiveLineIndexLeft, setSelectedIndicesLeft,
        setLeftBookmarks, lastFilterHashLeft,
        setRightFileName, setRightFilePath, setRightWorkerReady, setRightIndexingProgress,
        setRightTotalLines, setRightFilteredCount, setRightBookmarks, lastFilterHashRight,
        leftFilePath, rightFilePath, activeLineIndexLeft,
        isDualView, setIsDualView, // ✅ Pass Dual View state for aggregate persistence
        onOpenFile // 🎯 위임 핸들러 전달
    });
 
    // Initialize Left/Right Workers & Load State
    useEffect(() => {
        let isStale = false;
        let cleanupListeners: (() => void)[] = [];
 
        // 1. Get/Initialize Workers from Registry 🚀
        // This ensures the worker persists even if the component remounts during reordering
        const workers = workerRegistry.getWorkers(tabId);
        leftWorkerRef.current = workers.left.worker;
        rightWorkerRef.current = workers.right.worker;

        // Sync initial state from registry if it was already ready 🐧🛡️
        if (workers.left.ready) {
            setLeftWorkerReady(true);
            setLeftTotalLines(workers.left.totalLines);
        }
        if (workers.right.ready) {
            setRightWorkerReady(true);
            setRightTotalLines(workers.right.totalLines);
        }

        // 2. Set Message Handlers
        leftWorkerRef.current.onmessage = (e: MessageEvent<any>) => {
            if (isStale) return;
            handleWorkerMessage(e, {
                setIndexingProgress: setLeftIndexingProgress,
                setWorkerReady: (ready: boolean) => {
                    setLeftWorkerReady(ready);
                    workerRegistry.updateState(tabId, 'left', { ready });
                },
                setTotalLines: (totalLines: number) => {
                    setLeftTotalLines(totalLines);
                    workerRegistry.updateState(tabId, 'left', { totalLines });
                },
                setFilteredCount: setLeftFilteredCount,
                setBookmarks: setLeftBookmarks,
                setPerformanceHeatmap: setLeftPerformanceHeatmap,
                handleAnalysisMessage,
                setSharedBuffers: setLeftSharedBuffers,
                workerRef: leftWorkerRef,
                pendingRequests: leftPendingRequests,
                pane: 'left'
            });
        };
        leftWorkerRef.current.onerror = (e: any) => {
            console.error('[useLog-left] Worker Error:', e);
            addToast(`Left Worker error: ${e.message || 'Check console'}`, 'error');
        };

        rightWorkerRef.current.onmessage = (e: MessageEvent<any>) => {
            if (isStale) return;
            handleWorkerMessage(e, {
                setIndexingProgress: setRightIndexingProgress,
                setWorkerReady: (ready: boolean) => {
                    setRightWorkerReady(ready);
                    workerRegistry.updateState(tabId, 'right', { ready });
                },
                setTotalLines: (totalLines: number) => {
                    setRightTotalLines(totalLines);
                    workerRegistry.updateState(tabId, 'right', { totalLines });
                },
                setFilteredCount: setRightFilteredCount,
                setBookmarks: setRightBookmarks,
                setPerformanceHeatmap: setRightPerformanceHeatmap,
                setActiveLineIndex: setActiveLineIndexRight,
                setSelectedIndices: setSelectedIndicesRight,
                handleAnalysisMessage,
                setSharedBuffers: setRightSharedBuffers,
                workerRef: rightWorkerRef,
                pendingRequests: rightPendingRequests,
                pane: 'right'
            });
        };
        rightWorkerRef.current.onerror = (e: any) => {
            console.error('[useLog-right] Worker Error:', e);
        };
 
        // 3. Load Saved State (Triggers file loading via workers)
        // Set handlers FIRST, then trigger work to avoid race conditions 🚀
        loadState();
 
        return () => {
            isStale = true;
            // 💡 Important: DO NOT terminate workers here! 
            // The LogWorkerRegistry manages their lifecycle based on actual tab closing. 🐧🛡️
            // leftWorkerRef.current?.terminate();
            // rightWorkerRef.current?.terminate();
            cleanupListeners.forEach(cleanup => cleanup());
        };
    }, []); // Run once on mount


    // Auto-Apply Filter (Left)
    useEffect(() => {
        // ✅ Optimization: Only filter when active and worker is ready
        if (isActive && leftWorkerRef.current && currentConfig && leftWorkerReady) {
            const refinedGroups = assembleIncludeGroups(currentConfig);
            
            const applyFilter = () => {
                const effectiveIncludes = refinedGroups.map(g =>
                    g.map(t => (!currentConfig.happyCombosCaseSensitive ? t.trim().toLowerCase() : t.trim())).filter(t => t !== '')
                ).filter(g => g.length > 0);
                const effectiveExcludes = currentConfig.excludes.map(e => (!currentConfig.blockListCaseSensitive ? e.trim().toLowerCase() : e.trim())).filter(e => e !== '');

                const payloadHash = JSON.stringify({
                    inc: effectiveIncludes,
                    exc: effectiveExcludes,
                    happyCase: !!currentConfig.happyCombosCaseSensitive,
                    blockCase: !!currentConfig.blockListCaseSensitive,
                    quickFilter,
                });

                if (payloadHash === lastFilterHashLeft.current && leftWorkerReady) {
                    return;
                }
                lastFilterHashLeft.current = payloadHash;

                // 🐧🎯 형님! 작업 직전에 캐시를 비워야 설정창 색깔 변화와 화면 갱신이 한 호흡에 일어납니다!
                setLeftWorkerReady(false);
                setLeftSegmentIndex(0);
                leftViewerRef.current?.scrollTo(0);
                if (setClearCacheTick) setClearCacheTick(prev => prev + 1);

                console.log('[useLog-Left] Debounced FILTER_LOGS. hash:', payloadHash);
                leftWorkerRef.current?.postMessage({
                    type: 'FILTER_LOGS',
                    payload: { ...currentConfig, includeGroups: refinedGroups, quickFilter }
                });

                setActiveLineIndexLeft(-1);
                setSelectedIndicesLeft(new Set());
            };

            // 🐧🎯 형님! 콤보 추가나 수정을 할 때 팬이 돌지 않게 150ms 정도 숨을 고르고 필터링합니다. (400ms는 너무 깁니다!)
            const timer = setTimeout(applyFilter, 150);
            return () => clearTimeout(timer);
        }
    }, [currentConfig, tizenSocket, quickFilter, leftWorkerReady, isActive]);

    // Auto-Apply Filter (Right)
    useEffect(() => {
        if (isActive && isDualView && rightWorkerRef.current && currentConfig && rightWorkerReady && rightTotalLines > 0) {
            const refinedGroups = assembleIncludeGroups(currentConfig);

            const applyFilter = () => {
                const effectiveIncludes = refinedGroups.map(g =>
                    g.map(t => (!currentConfig.happyCombosCaseSensitive ? t.trim().toLowerCase() : t.trim())).filter(t => t !== '')
                ).filter(g => g.length > 0);
                const effectiveExcludes = currentConfig.excludes.map(e => (!currentConfig.blockListCaseSensitive ? e.trim().toLowerCase() : e.trim())).filter(e => e !== '');

                const payloadHash = JSON.stringify({
                    inc: effectiveIncludes,
                    exc: effectiveExcludes,
                    happyCase: !!currentConfig.happyCombosCaseSensitive,
                    blockCase: !!currentConfig.blockListCaseSensitive,
                    quickFilter,
                });

                if (payloadHash === lastFilterHashRight.current && rightWorkerReady) {
                    return;
                }
                lastFilterHashRight.current = payloadHash;

                // 🐧🎯 우측 패널도 타이밍 일치 작업!
                setRightWorkerReady(false);
                setRightSegmentIndex(0);
                rightViewerRef.current?.scrollTo(0);
                if (setClearCacheTick) setClearCacheTick(prev => prev + 1);

                console.log('[useLog-Right] Debounced FILTER_LOGS. hash:', payloadHash);
                rightWorkerRef.current?.postMessage({
                    type: 'FILTER_LOGS',
                    payload: { ...currentConfig, includeGroups: refinedGroups, quickFilter }
                });
                setActiveLineIndexRight(-1);
                setSelectedIndicesRight(new Set());
            };

            const timer = setTimeout(applyFilter, 150);
            return () => clearTimeout(timer);
        }
    }, [currentConfig, rightTotalLines, isDualView, quickFilter, rightWorkerReady, isActive]);



    useEffect(() => {
        return () => {
            if (tizenSocket) {
                tizenSocket.emit('disconnect_sdb');
                tizenSocket.emit('disconnect_ssh');
                tizenSocket.emit('disconnect_serial'); // ✅ Added to release COM port
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





    // === Phase 5: Selection Logic (Extracted) ===
    const { handleLineClick } = useLogSelection({
        setActiveLineIndexLeft,
        setActiveLineIndexRight,
        setSelectedIndicesLeft,
        setSelectedIndicesRight,
        activeLineIndexLeftRef,
        activeLineIndexRightRef,
        selectionSnapshotLeftRef,
        selectionSnapshotRightRef
    });






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
    }, [leftSegmentIndex, MAX_SEGMENT_SIZE]);

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
    }, [rightSegmentIndex, MAX_SEGMENT_SIZE]);

    // --- Export & Utility Actions (Extracted) ---
    const {
        handleCopyLogs, handleSaveLogs, handleCopyAsConfluenceTable,
        handleViewRawRangeLeft, handleViewRawRangeRight,
        handleCopyRawRangeLeft, handleCopyRawRangeRight,
        requestLeftRawLines, requestRightRawLines,
        requestBookmarkedLines
    } = useLogExportActions({
        leftWorkerRef, rightWorkerRef,
        leftPendingRequests, rightPendingRequests,
        leftFilteredCount, rightFilteredCount,
        selectedIndicesLeft, selectedIndicesRight,
        setRawContextTargetLine, setRawContextSourcePane,
        setRawViewHighlightRange, setRawContextOpen,
        showToast,
        requestLinesLeft: requestLeftLines,
        requestLinesRight: requestRightLines
    });





    const handleLeftReset = useCallback(() => {
        setLeftFileName('');
        setLeftFilePath(''); // ✅ Clear path for persistence
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
        setRightFilePath(''); // ✅ Clear path for persistence
        setRightWorkerReady(false);
        setRightTotalLines(0);
        setRightFilteredCount(0);
        setActiveLineIndexRight(-1);
        setSelectedIndicesRight(new Set());
        setRightBookmarks(new Set()); // Clear bookmarks
        lastFilterHashRight.current = '';
    }, []);

    const handleSelectAllLogs = useCallback((paneId: 'left' | 'right') => {
        const count = paneId === 'left' ? leftFilteredCount : rightFilteredCount;
        if (count <= 0) return;

        // 🐧🎯 형님, 대용량 로그라도 한 번에 싹 다 선택해버리겠습니다!
        const indices = new Set<number>();
        for (let i = 0; i < count; i++) {
            indices.add(i);
        }

        if (paneId === 'left') {
            setSelectedIndicesLeft(indices);
            showToast(`Selected all ${count.toLocaleString()} logs (Left)`, 'info');
        } else {
            setSelectedIndicesRight(indices);
            showToast(`Selected all ${count.toLocaleString()} logs (Right)`, 'info');
        }
    }, [leftFilteredCount, rightFilteredCount, showToast]);





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
        if (selectedRuleId === 'global-mission') {
            showToast('Global Mission cannot be deleted!', 'error');
            return;
        }

        const currentRule = rules.find(r => r.id === selectedRuleId);
        const ruleName = currentRule?.name || 'this mission';

        setDialogConfig({
            title: 'Delete Mission',
            description: (
                <div className="space-y-2">
                    <p>Are you sure you want to delete the mission "{ruleName}"?</p>
                    <p className="text-red-400 font-bold">All important filters and highlight rules will be deleted.</p>
                </div>
            ),
            confirmLabel: 'Delete',
            isDanger: true,
            onConfirm: () => {
                const updated = rules.filter(r => r.id !== selectedRuleId);
                onUpdateRules(updated);
                setSelectedRuleId(updated.length > 0 ? updated[0].id : '');
            }
        });
    }, [rules, selectedRuleId, onUpdateRules, showToast]);

    const addWordToGlobalMission = useCallback((word: string) => {
        const trimmed = word.trim();
        if (!trimmed) return;

        const globalRule = rules.find(r => r.id === 'global-mission');
        if (!globalRule) {
            showToast('Global Mission not found!', 'error');
            return;
        }

        const currentHappyGroups = globalRule.happyGroups || [];
        const currentHighlights = globalRule.highlights || [];

        const isDuplicateGroup = currentHappyGroups.some(
            g => g.tags.length === 1 && g.tags[0].toLowerCase() === trimmed.toLowerCase()
        );

        let isUpdated = false;
        let newHappyGroups = [...currentHappyGroups];
        let newHighlights = [...currentHighlights];

        if (!isDuplicateGroup) {
            const newGroupId = 'group-' + Math.random().toString(36).substring(7);
            newHappyGroups.push({
                id: newGroupId,
                tags: [trimmed],
                enabled: true
            });
            isUpdated = true;
        }

        const isDuplicateHighlight = currentHighlights.some(
            h => h.keyword.toLowerCase() === trimmed.toLowerCase()
        );

        if (!isDuplicateHighlight) {
            const newHighlightId = 'hl-' + Math.random().toString(36).substring(7);
            const colors = ['bg-yellow-200', 'bg-indigo-200', 'bg-red-200', 'bg-green-200', 'bg-blue-200', 'bg-orange-200'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            newHighlights.push({
                id: newHighlightId,
                keyword: trimmed,
                color: randomColor,
                lineEffect: false
            });
            isUpdated = true;
        }

        if (isUpdated) {
            const updatedRules = rules.map(r => 
                r.id === 'global-mission' 
                    ? { ...r, happyGroups: newHappyGroups, highlights: newHighlights, happyCombosEnabled: true } 
                    : r
            );
            onUpdateRules(updatedRules);
            showToast(`Added "${trimmed}" to Global Mission!`, 'success');
        } else {
            showToast(`"${trimmed}" is already in Global Mission!`, 'info');
        }
    }, [rules, onUpdateRules, showToast]);

    const clearGlobalMission = useCallback(() => {
        const globalRule = rules.find(r => r.id === 'global-mission');
        if (!globalRule) {
            showToast('Global Mission not found!', 'error');
            return;
        }

        setDialogConfig({
            title: 'Clear Global Mission',
            description: (
                <div className="space-y-2">
                    <p>Are you sure you want to clear all words in the Global Mission?</p>
                    <p className="text-red-400 font-bold">This will remove all Happy Combos and highlights in the Global Mission.</p>
                </div>
            ),
            confirmLabel: 'Yes',
            onConfirm: () => {
                const updatedRules = rules.map(r => 
                    r.id === 'global-mission' 
                        ? { ...r, happyGroups: [], highlights: [] } 
                        : r
                );
                onUpdateRules(updatedRules);
                showToast('Global Mission cleared!', 'success');
            }
        });
    }, [rules, onUpdateRules, showToast]);

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

    const getGroupedRoots = useCallback((config: LogRule | undefined) => {
        if (!config) return [];
        const groups = new Map<string, { group: string[], active: boolean, originalIdx: number, id?: string, alias?: string }[]>();

        if (config.happyGroups) {
            config.happyGroups.forEach((hGroup, idx) => {
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
            config.includeGroups.forEach((group, idx) => {
                const root = (group[0] || '').trim();
                if (!root) return;
                if (!groups.has(root)) groups.set(root, []);
                groups.get(root)!.push({ group, active: true, originalIdx: idx });
            });
            if (config.disabledGroups) {
                config.disabledGroups.forEach((group, idx) => {
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
    }, []);

    const groupedRoots = useMemo(() => getGroupedRoots(currentConfig), [currentConfig, getGroupedRoots]);
    const appliedGroupedRoots = useMemo(() => getGroupedRoots(appliedConfig), [appliedConfig, getGroupedRoots]);

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
            // 🐧🎯 형님! 최대 너비를 1200px로 확 키웠습니다. 화면이 작으면 화면 너비에 맞게 조절됩니다.
            const maxAllowedWidth = Math.min(window.innerWidth - 100, 1200);
            const newWidth = Math.max(312, Math.min(maxAllowedWidth, startWidth + deltaX));
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
        activeLineIndexAnchorRight: activeLineIndexRight,
        isPerfOpenLeft: !!leftPerfAnalysisResult || isAnalyzingPerformanceLeft,
        isPerfOpenRight: !!rightPerfAnalysisResult || isAnalyzingPerformanceRight,
        toggleLeftBookmark,
        toggleRightBookmark
    });


    return {
        rules, onUpdateRules, tabId, onExportSettings, onImportSettings,
        selectedRuleId, setSelectedRuleId, currentConfig, appliedConfig,
        groupedRoots, appliedGroupedRoots, collapsedRoots, setCollapsedRoots,
        updateCurrentRule, handleCreateRule, handleDeleteRule, handleToggleRoot,
        isDualView, setIsDualView, toggleDualView,
        splitRatio, setSplitRatio,
        splitAnalyzerHeight, setSplitAnalyzerHeight, // ✅ 펭귄! 높이 조절 노출
        isPanelOpen, setIsPanelOpen,
        configPanelWidth, setConfigPanelWidth, handleConfigResizeStart,
        rawContextOpen, setRawContextOpen, rawContextHeight, handleRawContextResizeStart,
        rawContextTargetLine, rawContextSourcePane,
        isTizenModalOpen, setIsTizenModalOpen, isTizenQuickConnect, setIsTizenQuickConnect,
        fileInputRef, logFileInputRef, leftViewerRef, rightViewerRef, rawViewerRef,
        leftWorkerRef, rightWorkerRef,
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
        handleCopyLogs, handleSaveLogs, handleCopyAsConfluenceTable, jumpToHighlight, findText,
        requestBookmarkedLines, sendTizenCommand, sendSerialSpecialKey, hasEverConnected, handleClearLogs,
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
        dialogConfig, setDialogConfig,
        addWordToGlobalMission, clearGlobalMission,
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
        leftSharedBuffers, rightSharedBuffers,
        clearCacheTick,
        handleViewRawRangeLeft, handleViewRawRangeRight,
        handleCopyRawRangeLeft, handleCopyRawRangeRight,
        handleSelectAllLogs,
        onAddTab,
        addQuickFilter: (keyword: string) => {
            if (!currentConfig || !keyword.trim()) return;
            const targetKeyword = keyword.trim();
            const happyGroups = currentConfig.happyGroups || [];
            
            const existingIdx = happyGroups.findIndex(g => 
                g.tags.length === 1 && g.tags[0].toLowerCase() === targetKeyword.toLowerCase()
            );

            if (existingIdx > -1) {
                const newHappyGroups = happyGroups.filter((_, idx) => idx !== existingIdx);
                updateCurrentRule({ happyGroups: newHappyGroups });
                showToast(`Removed Filter: ${targetKeyword}`, 'info');
            } else {
                const newGroup = {
                    id: `quick-filter-${Math.random().toString(36).substring(7)}`,
                    tags: [targetKeyword],
                    enabled: true
                };
                updateCurrentRule({ happyGroups: [...happyGroups, newGroup] });
                showToast(`Filtered by: ${targetKeyword}`, 'success');
            }
        },
        clearQuickFilters: () => {
            if (!currentConfig) return;
            const happyGroups = currentConfig.happyGroups || [];
            const remainingGroups = happyGroups.filter(g => !g.id.startsWith('quick-filter-'));
            const removedCount = happyGroups.length - remainingGroups.length;
            
            if (removedCount > 0) {
                updateCurrentRule({ happyGroups: remainingGroups });
                showToast(`Cleared ${removedCount} quick filters`, 'info');
            }
        },
        addQuickHighlight: (keyword: string) => {
            if (!currentConfig || !keyword.trim()) return;
            const targetKeyword = keyword.trim();
            const existingIdx = currentConfig.highlights.findIndex(h => 
                h.keyword.toLowerCase() === targetKeyword.toLowerCase()
            );

            if (existingIdx > -1) {
                // Toggle Off: Remove highlight
                const newHighlights = [...currentConfig.highlights];
                newHighlights.splice(existingIdx, 1);
                updateCurrentRule({ highlights: newHighlights });
                showToast(`Removed Highlight: ${targetKeyword}`, 'info');
            } else {
                // Toggle On: Add highlight
                const newHighlight: LogHighlight = {
                    id: `quick-${Math.random().toString(36).substring(7)}`,
                    keyword: targetKeyword,
                    color: 'indigo-500',
                    lineEffect: false
                };
                updateCurrentRule({ highlights: [...currentConfig.highlights, newHighlight] });
                showToast(`Highlighted: ${targetKeyword}`, 'success');
            }
        },
        clearQuickHighlights: () => {
            if (!currentConfig) return;
            const remainingHighlights = currentConfig.highlights.filter(h => !h.id.startsWith('quick-'));
            const removedCount = currentConfig.highlights.length - remainingHighlights.length;
            
            if (removedCount > 0) {
                updateCurrentRule({ highlights: remainingHighlights });
                showToast(`Cleared ${removedCount} quick highlights`, 'info');
            }
        }
    };
};
