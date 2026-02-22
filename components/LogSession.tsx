import React from 'react';
import * as Lucide from 'lucide-react';
import LogViewerPane, { LogViewerHandle } from './LogViewer/LogViewerPane';
import ConfigurationPanel from './LogViewer/ConfigurationPanel';
import TizenConnectionModal from './TizenConnectionModal';
import { useLogContext } from './LogViewer/LogContext';
import { MAX_SEGMENT_SIZE } from '../hooks/useLogExtractorLogic';
import TopBar from './LogViewer/TopBar';
import LoadingOverlay from './ui/LoadingOverlay';
import { BookmarksModal } from './BookmarksModal';
import GoToLineModal from './GoToLineModal';
import { useLogSelection } from './LogArchive/hooks/useLogSelection';
// FloatingActionButton removed
import { useLogArchiveContext } from './LogArchive/LogArchiveProvider';
import { useContextMenu } from './ContextMenu';
import { useToast } from '../contexts/ToastContext';
import { useHappyTool } from '../contexts/HappyToolContext';
import TransactionDrawer from './LogViewer/TransactionDrawer';
import { extractTransactionIds } from '../utils/transactionAnalysis';

const { X, Eraser, ChevronLeft, ChevronRight, GripHorizontal } = Lucide;

interface RawContextViewerProps {
    sourcePane: 'left' | 'right';
    leftFileName: string;
    rightFileName: string;
    targetLine: { lineNum: number; content: string; formattedLineIndex?: number | string };
    onClose: () => void;
    heightPercent: number;
    onResizeStart: (e: React.MouseEvent) => void;
    leftTotalLines: number;
    rightTotalLines: number;
    requestLeftRawLines: (start: number, count: number) => Promise<any>;
    requestRightRawLines: (start: number, count: number) => Promise<any>;
    preferences?: any;
    highlightRange?: { start: number; end: number } | null; // Added
}

const RawContextViewer: React.FC<RawContextViewerProps> = ({
    sourcePane, leftFileName, rightFileName, targetLine, onClose, heightPercent, onResizeStart,
    leftTotalLines, rightTotalLines, requestLeftRawLines, requestRightRawLines, preferences,
    highlightRange // Added
}) => {
    const rawViewerRef = React.useRef<LogViewerHandle>(null);
    const rawTotalLines = sourcePane === 'left' ? leftTotalLines : rightTotalLines;
    const rawTargetLineIndex = targetLine.lineNum - 1;
    const rawSegmentIndex = Math.floor(rawTargetLineIndex / MAX_SEGMENT_SIZE);
    const rawSegmentOffset = rawSegmentIndex * MAX_SEGMENT_SIZE;
    const rawSegmentLength = Math.min(MAX_SEGMENT_SIZE, Math.max(0, rawTotalLines - rawSegmentOffset));

    const handleRawScrollRequest = React.useCallback((start: number, count: number) => {
        const globalStart = start + rawSegmentOffset;
        const fn = sourcePane === 'left' ? requestLeftRawLines : requestRightRawLines;
        return fn(globalStart, count);
    }, [rawSegmentOffset, sourcePane, requestLeftRawLines, requestRightRawLines]);

    return (
        <div className="absolute left-0 right-0 top-16 bottom-0 z-40 flex flex-col pointer-events-none">
            <div className="flex flex-col bg-slate-950 pointer-events-auto border-b-2 border-indigo-500 shadow-2xl relative" style={{ height: `${heightPercent}%` }}>
                <div className="bg-indigo-950/80 px-4 py-1 flex justify-between items-center border-b border-indigo-500/30 backdrop-blur">
                    <span className="text-xs font-bold text-indigo-300">
                        Raw View ({sourcePane === 'left' ? leftFileName : rightFileName})
                        <span className="mx-2 opacity-50">|</span>
                        Original Line: <span className="text-white">{targetLine.lineNum}</span>
                        <span className="mx-2 opacity-50">|</span>
                        Filtered Row: <span className="text-yellow-400">#{targetLine.formattedLineIndex ?? '?'}</span>
                    </span>
                    <button onClick={onClose} className="text-indigo-400 hover:text-white"><X size={14} /></button>
                </div>
                <LogViewerPane
                    key={`raw-${sourcePane}-${rawTargetLineIndex}`}
                    ref={rawViewerRef}
                    workerReady={true}
                    totalMatches={rawSegmentLength}
                    onScrollRequest={handleRawScrollRequest}
                    absoluteOffset={rawSegmentOffset}
                    placeholderText=""
                    isRawMode={true}
                    activeLineIndex={rawTargetLineIndex}
                    initialScrollIndex={rawTargetLineIndex - rawSegmentOffset}
                    isActive={true} // Raw View is an modal-like overlay, usually only active when visible
                    preferences={preferences}
                    lineHighlightRanges={highlightRange ? [{
                        start: highlightRange.start - 1,
                        end: highlightRange.end - 1,
                        color: 'rgba(99, 102, 241, 0.3)'
                    }] : []}
                />
                {/* Resizer Handle (Bottom) - Refined Pill Design */}
                <div
                    className="absolute -bottom-2 left-0 right-0 h-4 cursor-ns-resize z-[100] flex justify-end px-12 group/resizer"
                    onMouseDown={onResizeStart}
                >
                    <div className="w-10 h-3 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-b-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-x border-b border-white/20 group-hover/resizer:h-4 group-hover/resizer:from-indigo-400 group-hover/resizer:to-indigo-600 transition-all duration-200 origin-top">
                        <div className="flex gap-0.5">
                            <div className="w-0.5 h-0.5 bg-white/80 rounded-full shadow-sm" />
                            <div className="w-0.5 h-0.5 bg-white/80 rounded-full shadow-sm" />
                            <div className="w-0.5 h-0.5 bg-white/80 rounded-full shadow-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface LogSessionProps {
    isActive: boolean;
    currentTitle?: string;
    onTitleChange?: (title: string) => void;
}

const LogSession: React.FC<LogSessionProps> = ({ isActive, currentTitle, onTitleChange }) => {
    const leftFileInputRef = React.useRef<HTMLInputElement>(null);
    const rightFileInputRef = React.useRef<HTMLInputElement>(null);
    const { isFocusMode } = useHappyTool(); // ✅ Use global focus mode state

    const defaultLogCommand = 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &';

    // ✅ Resize Detection for Smart Transitions
    const [isResizing, setIsResizing] = React.useState(false);
    React.useEffect(() => {
        let timeout: NodeJS.Timeout;
        const handleResize = () => {
            setIsResizing(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => setIsResizing(false), 200);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeout);
        };
    }, []);


    // Bookmark Modal States
    const [isLeftBookmarksOpen, setLeftBookmarksOpen] = React.useState(false);
    const [isRightBookmarksOpen, setRightBookmarksOpen] = React.useState(false);

    const {
        leftFileName, isDualView, rightFileName,
        setIsTizenModalOpen, isTizenModalOpen, handleTizenStreamStart,
        isTizenQuickConnect, setIsTizenQuickConnect, // Added for Quick Connect
        rawContextOpen, rawContextTargetLine, rawContextHeight, rawContextSourcePane,
        setRawContextOpen, handleRawContextResizeStart,
        leftTotalLines, rightTotalLines, requestLeftRawLines, requestRightRawLines,
        rawViewerRef,
        currentConfig,

        leftViewerRef, leftWorkerReady, leftFilteredCount, requestLeftLines, setActiveLineIndexLeft,
        handleLineDoubleClickAction, activeLineIndexLeft, selectedIndicesLeft, setSelectedIndicesLeft, handleLeftFileChange, handleLeftReset, leftIndexingProgress,

        rightViewerRef, rightWorkerReady, rightFilteredCount, requestRightLines, setActiveLineIndexRight,
        activeLineIndexRight, selectedIndicesRight, setSelectedIndicesRight, handleRightFileChange, handleRightReset, rightIndexingProgress,
        handleCopyLogs, handleSaveLogs,
        leftBookmarks, rightBookmarks, toggleLeftBookmark, toggleRightBookmark,
        clearLeftBookmarks, clearRightBookmarks,
        jumpToHighlight, requestBookmarkedLines, jumpToGlobalLine,
        tizenSocket, sendTizenCommand, handleClearLogs, handleTizenDisconnect,
        handleLineClick,

        // Segmentation
        leftSegmentIndex, setLeftSegmentIndex, leftTotalSegments, leftCurrentSegmentLines,
        rightSegmentIndex, setRightSegmentIndex, rightTotalSegments, rightCurrentSegmentLines,
        isGoToLineModalOpen, setIsGoToLineModalOpen,
        searchInputRef,
        logViewPreferences, // Added
        isPanelOpen, setIsPanelOpen, updateLogViewPreferences, // Added for shortcuts
        isSearchFocused, // Added for Focus Mode
        leftPerformanceHeatmap,
        rightPerformanceHeatmap,
        // Performance Analysis (New)
        leftPerfAnalysisResult, rightPerfAnalysisResult,
        isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight,
        handleAnalyzePerformanceLeft, handleAnalyzePerformanceRight,
        handleJumpToLineLeft, handleJumpToLineRight,
        leftLineHighlightRanges, rightLineHighlightRanges,
        handleJumpToRangeLeft, handleJumpToRangeRight,
        handleViewRawRangeLeft, handleViewRawRangeRight,
        handleCopyRawRangeLeft, handleCopyRawRangeRight,
        rawViewHighlightRange,
        perfDashboardHeight, setPerfDashboardHeight,
        // Transaction Analyzer
        transactionResults, transactionIdentity, transactionSourcePane, isAnalyzingTransaction, isTransactionDrawerOpen,
        setIsTransactionDrawerOpen, analyzeTransactionAction,
        handleZoomIn, handleZoomOut // ✅ Consumed
    } = useLogContext();

    // Log Archive: Text Selection
    // Log Archive: Text Selection & Line Selection
    const { openSaveDialog, isSaveDialogOpen, isViewerOpen } = useLogArchiveContext();
    const { showContextMenu, ContextMenuComponent } = useContextMenu();
    const { addToast } = useToast(); // ✅ Use Toast for copy feedback
    const logContentRef = React.useRef<HTMLDivElement>(null);
    const { selection: nativeSelection, handleSave: handleNativeSave } = useLogSelection(
        logContentRef,
        isDualView ? undefined : (leftFileName || undefined)
    );

    // === ARCHIVE SAVE (full file) === //
    const MAX_ARCHIVE_LINES = 300_000; // ~30MB @ ~100 bytes/line
    const isLeftArchiveEnabled = leftWorkerReady && leftFilteredCount > 0 && leftFilteredCount <= MAX_ARCHIVE_LINES && !tizenSocket;
    const isRightArchiveEnabled = rightWorkerReady && rightFilteredCount > 0 && rightFilteredCount <= MAX_ARCHIVE_LINES;

    const onArchiveSaveLeft = React.useCallback(async () => {
        if (!leftWorkerReady || leftFilteredCount === 0) return;
        try {
            const lines = await requestLeftLines(0, leftFilteredCount);
            const content = lines.map(l => l.content).join('\n');
            openSaveDialog({
                content,
                sourceFile: leftFileName || undefined,
                startLine: 1,
                endLine: leftFilteredCount,
            });
        } catch (e) {
            console.error('[LogSession] Failed to fetch lines for archive', e);
        }
    }, [leftWorkerReady, leftFilteredCount, requestLeftLines, leftFileName, openSaveDialog]);

    const onArchiveSaveRight = React.useCallback(async () => {
        if (!rightWorkerReady || rightFilteredCount === 0) return;
        try {
            const lines = await requestRightLines(0, rightFilteredCount);
            const content = lines.map(l => l.content).join('\n');
            openSaveDialog({
                content,
                sourceFile: rightFileName || undefined,
                startLine: 1,
                endLine: rightFilteredCount,
            });
        } catch (e) {
            console.error('[LogSession] Failed to fetch lines for archive', e);
        }
    }, [rightWorkerReady, rightFilteredCount, requestRightLines, rightFileName, openSaveDialog]);

    // === NEW CONTEXT MENU LOGIC === //
    const handleUnifiedSave = async () => {
        // 1. 브라우저의 현재 텍스트 선택 영역을 최우선으로 확인합니다 (Alt+Drag 대응)
        const currentSel = window.getSelection();
        const browserText = currentSel && !currentSel.isCollapsed ? currentSel.toString().trim() : null;

        if (browserText || nativeSelection) {
            const content = browserText || nativeSelection?.text || '';
            const sourceFile = isDualView ? undefined : (leftFileName || undefined);

            openSaveDialog({
                content,
                sourceFile,
                // 텍스트 선택의 경우 정확한 라인 번호를 알기 어려우므로 undefined로 유지
                startLine: undefined,
                endLine: undefined,
            });
        } else {
            // 2. 라인 단위 선택(클릭/드래그) 저장 로직
            const targetIsLeft = (selectedIndicesLeft && selectedIndicesLeft.size > 0);
            const indices = targetIsLeft ? selectedIndicesLeft : selectedIndicesRight;
            const requestFn = targetIsLeft ? requestLeftLines : requestRightLines;
            const fName = targetIsLeft ? leftFileName : rightFileName;

            if (!indices || indices.size === 0) return;

            const sorted = Array.from(indices).sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const count = max - min + 1;

            try {
                const lines = await requestFn(min, count);
                const content = lines
                    .filter((_, idx) => indices.has(min + idx))
                    .map(l => l.content)
                    .join('\n');

                if (content) {
                    openSaveDialog({
                        content,
                        sourceFile: fName,
                        startLine: min + 1,
                        endLine: max + 1
                    });
                }
            } catch (e) {
                console.error('[LogSession] Failed to retrieve selected lines', e);
            }
        }
    };

    const handleContextMenu = React.useCallback(async (e: React.MouseEvent) => {
        // ✅ Prevent default immediately to ensure custom menu works correctly even with async logic
        e.preventDefault();

        // 브라우저의 실시간 선택 영역을 확인합니다.
        const currentSelection = window.getSelection();
        const hasTextSelection = currentSelection && !currentSelection.isCollapsed && currentSelection.toString().trim().length > 0;

        const hasNative = !!nativeSelection || hasTextSelection;
        const hasLeftLine = selectedIndicesLeft && selectedIndicesLeft.size > 0;
        const hasRightLine = isDualView && selectedIndicesRight && selectedIndicesRight.size > 0;

        const menuItems = [];

        // Determine which pane we are clicking on (best effort)
        const targetPane: 'left' | 'right' = (e.currentTarget as HTMLElement).closest('[data-pane-id="right"]') ? 'right' : 'left';

        const hasSelectionInTarget = targetPane === 'left' ? hasLeftLine : hasRightLine;

        if (hasNative || hasLeftLine || hasRightLine) {
            menuItems.push({
                label: 'Save Selection to Archive',
                icon: <Lucide.Archive size={16} />,
                action: handleUnifiedSave
            });
        }

        // --- Transaction Analysis Entry Point ---
        try {
            const indices = targetPane === 'left' ? selectedIndicesLeft : selectedIndicesRight;
            console.log(`[ContextMenu] Checking selection for ${targetPane}:`, {
                indicesCount: indices?.size || 0,
                indices: Array.from(indices || [])
            });

            if (indices && indices.size >= 1) {
                const activeIdx = targetPane === 'left' ? activeLineIndexLeft : activeLineIndexRight;
                const lineIdx = indices.has(activeIdx) ? activeIdx : Array.from(indices)[0];
                const requestFn = targetPane === 'left' ? requestLeftLines : requestRightLines;

                const lines = await requestFn(lineIdx, 1);
                console.log(`[ContextMenu] Requested line content for idx ${lineIdx}:`, lines?.[0]?.content);

                if (lines && lines.length > 0) {
                    const content = lines[0].content;
                    const extractedIds = extractTransactionIds(content);
                    console.log(`[ContextMenu] IDs extracted from line:`, extractedIds);

                    if (extractedIds.length > 0) {
                        menuItems.push({ type: 'separator' });
                        extractedIds.forEach(id => {
                            menuItems.push({
                                label: `Analyze Transaction: ${id.type.toUpperCase()} (${id.value})`,
                                icon: <Lucide.Activity size={16} />,
                                action: () => analyzeTransactionAction(id, targetPane)
                            });
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[LogSession] Context menu analysis check failed', err);
        }

        if (menuItems.length > 0) {
            showContextMenu(e, menuItems);
        }
    }, [nativeSelection, selectedIndicesLeft, selectedIndicesRight, activeLineIndexLeft, activeLineIndexRight, isDualView, showContextMenu, requestLeftLines, requestRightLines, analyzeTransactionAction]);

    // --- Line Selection Logic (Fallback for when native selection is blocked) ---
    const mousePosRef = React.useRef({ x: 0, y: 0 });
    const [lineSelection, setLineSelection] = React.useState<{ text: string, x: number, y: number } | null>(null);

    // Track Mouse Position
    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);


    // --- Log Time Difference Calculation ---
    const [leftSelectionDuration, setLeftSelectionDuration] = React.useState<string | null>(null);
    const [rightSelectionDuration, setRightSelectionDuration] = React.useState<string | null>(null);

    // Calculate Duration when selection changes
    React.useEffect(() => {
        const calculateDuration = async () => {
            // Helper to calculation duration for a specific pane
            const calc = async (indices: Set<number>, requestFn: (start: number, count: number) => Promise<any[]>) => {
                if (!indices || indices.size < 2) return null;

                const sorted = Array.from(indices).sort((a, b) => a - b);
                const firstIdx = sorted[0];
                const lastIdx = sorted[sorted.length - 1];

                try {
                    const [firstLine, lastLine] = await Promise.all([
                        requestFn(firstIdx, 1),
                        requestFn(lastIdx, 1)
                    ]);

                    if (firstLine && firstLine.length > 0 && lastLine && lastLine.length > 0) {
                        const { extractTimestamp, formatDuration } = await import('../utils/logTime');
                        const startTime = extractTimestamp(firstLine[0].content);
                        const endTime = extractTimestamp(lastLine[0].content);

                        if (startTime !== null && endTime !== null) {
                            const diff = Math.abs(endTime - startTime);
                            return formatDuration(diff);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to calculate time difference', e);
                }
                return null;
            };

            // Left Pane
            if (selectedIndicesLeft && selectedIndicesLeft.size > 1) {
                setLeftSelectionDuration(await calc(selectedIndicesLeft, requestLeftLines));
            } else {
                setLeftSelectionDuration(null);
            }

            // Right Pane
            if (isDualView && selectedIndicesRight && selectedIndicesRight.size > 1) {
                setRightSelectionDuration(await calc(selectedIndicesRight, requestRightLines));
            } else {
                setRightSelectionDuration(null);
            }
        };

        const timer = setTimeout(calculateDuration, 200); // Debounce
        return () => clearTimeout(timer);
    }, [selectedIndicesLeft, selectedIndicesRight, isDualView, requestLeftLines, requestRightLines]);

    // Native Selection Logic reused (no lineSelection state needed anymore)
    const activeSelection = nativeSelection; // Keep simple reference if needed, or remove usage



    const handleUnifiedSave_Legacy = async () => {
        if (nativeSelection) {
            handleNativeSave();
        } else {
            // Line Selection Save
            const targetIsLeft = (selectedIndicesLeft && selectedIndicesLeft.size > 0);
            const indices = targetIsLeft ? selectedIndicesLeft : selectedIndicesRight;
            const requestFn = targetIsLeft ? requestLeftLines : requestRightLines;
            const fName = targetIsLeft ? leftFileName : rightFileName;

            if (!indices || indices.size === 0) return;

            const sorted = Array.from(indices).sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const count = max - min + 1;

            try {
                const lines = await requestFn(min, count);
                const content = lines
                    .filter((_, idx) => indices.has(min + idx))
                    .map(l => l.content)
                    .join('\n');

                if (content) {
                    openSaveDialog({
                        content,
                        sourceFile: fName,
                        startLine: min + 1,
                        endLine: max + 1
                    });
                }
            } catch (e) {
                console.error('[LogSession] Failed to retrieve selected lines', e);
            }
        }
    };

    const rowHeight = logViewPreferences?.rowHeight || 24; // Use preference or default

    const requestLeftBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'left'), [requestBookmarkedLines]);
    const requestRightBookmarkedLines = React.useCallback((indices: number[]) => requestBookmarkedLines(indices, 'right'), [requestBookmarkedLines]);

    // Track latest state for global shortcuts
    const stateRef = React.useRef({ activeLineIndexLeft, activeLineIndexRight, selectedIndicesLeft, selectedIndicesRight, leftBookmarks, rightBookmarks });
    React.useEffect(() => {
        stateRef.current = { activeLineIndexLeft, activeLineIndexRight, selectedIndicesLeft, selectedIndicesRight, leftBookmarks, rightBookmarks };
    });

    // Update Tab Title based on file name
    React.useEffect(() => {
        if (onTitleChange) {
            const newTitle = leftFileName || 'New Log';
            // Only update if title actually changed to prevent loops
            if (newTitle !== currentTitle) {
                onTitleChange(newTitle);
            }
        }
    }, [leftFileName, onTitleChange, currentTitle]);

    const handleFocusPaneRequest = (direction: 'left' | 'right', visualY?: number) => {
        const targetRef = direction === 'left' ? leftViewerRef : rightViewerRef;
        const targetSetter = direction === 'left' ? setActiveLineIndexLeft : setActiveLineIndexRight;
        const targetSelectionSetter = direction === 'left' ? setSelectedIndicesLeft : setSelectedIndicesRight;
        const targetCount = direction === 'left' ? leftFilteredCount : rightFilteredCount;
        const targetOffset = direction === 'left' ? leftSegmentIndex * MAX_SEGMENT_SIZE : rightSegmentIndex * MAX_SEGMENT_SIZE;

        targetRef.current?.focus();

        if (visualY !== undefined && targetRef.current && targetCount > 0) {
            const targetScrollTop = targetRef.current.getScrollTop();
            const targetAbsY = targetScrollTop + visualY;
            const targetLocalIndex = Math.floor(targetAbsY / rowHeight);
            const targetGlobalIndex = targetLocalIndex + targetOffset;

            const clampedIndex = Math.max(0, Math.min(targetGlobalIndex, targetCount - 1));
            targetSetter(clampedIndex);
            targetSelectionSetter(new Set([clampedIndex]));
        }
    };

    const handleSyncScroll = React.useCallback((scrollTop: number, source: 'left' | 'right') => {
        if (!isDualView) return;
        const targetRef = source === 'left' ? rightViewerRef : leftViewerRef;
        if (targetRef.current) {
            // ✅ Only sync if the difference is significant (> 1px) to avoid jitter/rounding loops
            const currentTop = targetRef.current.getScrollTop();
            if (Math.abs(currentTop - scrollTop) >= 1) {
                targetRef.current.scrollTo(scrollTop);
            }
        }
    }, [isDualView]);

    // Memoized handlers for Left Pane
    const onLineClickLeft = React.useCallback((index: number, isShift?: boolean, isCtrl?: boolean) => handleLineClick('left', index, !!isShift, !!isCtrl), [handleLineClick]);
    const onLineDoubleClickLeft = React.useCallback((index: number) => handleLineDoubleClickAction(index, 'left'), [handleLineDoubleClickAction]);
    const onBrowseLeft = React.useCallback(() => leftFileInputRef.current?.click(), []);
    const onCopyLeft = React.useCallback(() => handleCopyLogs('left'), [handleCopyLogs]);
    const onSaveLeft = React.useCallback(() => handleSaveLogs('left'), [handleSaveLogs]);
    const onSyncScrollLeft = React.useCallback((dy: number) => handleSyncScroll(dy, 'left'), [handleSyncScroll]);
    const onHighlightJumpLeft = React.useCallback((idx: number) => jumpToHighlight(idx, 'left'), [jumpToHighlight]);
    const onShowBookmarksLeft = React.useCallback(() => setLeftBookmarksOpen(true), []);

    // Helper to generate consistent colors from strings
    const stringToColor = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Use consistent Highlighting Colors (avoiding too dark or too light)
        // We use HSL logic but convert to HEX to avoid CSS parsing issues in some environments/tooling
        const h = Math.abs(hash % 360);
        const s = 70 + (Math.abs(hash) % 30); // 70-100%
        const l = 50 + (Math.abs(hash) % 10); // 50-60% (Keep it in middle range for text contrast)

        // HSL to RGB conversion
        const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l / 100 - c / 2;
        let r_ = 0, g_ = 0, b_ = 0;

        if (0 <= h && h < 60) { r_ = c; g_ = x; b_ = 0; }
        else if (60 <= h && h < 120) { r_ = x; g_ = c; b_ = 0; }
        else if (120 <= h && h < 180) { r_ = 0; g_ = c; b_ = x; }
        else if (180 <= h && h < 240) { r_ = 0; g_ = x; b_ = c; }
        else if (240 <= h && h < 300) { r_ = x; g_ = 0; b_ = c; }
        else if (300 <= h && h < 360) { r_ = c; g_ = 0; b_ = x; }

        const r = Math.round((r_ + m) * 255).toString(16).padStart(2, '0');
        const g = Math.round((g_ + m) * 255).toString(16).padStart(2, '0');
        const b = Math.round((b_ + m) * 255).toString(16).padStart(2, '0');

        return `#${r}${g}${b}`;
    };

    // Prepare Effective Highlights (Explicit + Auto-generated Highlighting for Happy Combos)
    const effectiveHighlights = React.useMemo(() => {
        const baseHighlights = currentConfig?.highlights || [];

        // Determine case sensitivity for deduplication
        // 형님, 어느 한 쪽이라도 켜져 있으면 중복 체크할 때 대소문자를 구분합니다.
        const isCaseSensitive = !!currentConfig?.happyCombosCaseSensitive || !!currentConfig?.colorHighlightsCaseSensitive;

        // Only classify highlights with ACTUAL color as "existing/colliding"
        // Deduplicate based on case sensitivity setting
        const validExistingKeywords = new Set(
            baseHighlights
                .filter(h => h.color && h.color.trim().length > 0)
                .map(h => isCaseSensitive ? h.keyword : h.keyword.toLowerCase())
        );

        const autoHighlights: any[] = [];
        const termsToHighlight = new Set<string>();

        // Collect terms from Happy Groups
        if (currentConfig?.happyGroups) {
            currentConfig.happyGroups.forEach(group => {
                // Check if group is enabled (default true if undefined)
                if (group.enabled !== false) {
                    group.tags.forEach(tag => {
                        if (tag && tag.trim()) termsToHighlight.add(tag.trim());
                    });
                }
            });
        }

        // Legacy Support
        if (currentConfig?.includeGroups) {
            currentConfig.includeGroups.forEach(group => {
                group.forEach(tag => {
                    if (tag && tag.trim()) termsToHighlight.add(tag.trim());
                });
            });
        }



        termsToHighlight.forEach(term => {
            const checkTerm = isCaseSensitive ? term : term.toLowerCase();
            // Only add auto-highlight if NO manual highlight exists for this term
            if (!validExistingKeywords.has(checkTerm)) {
                const color = stringToColor(term);
                autoHighlights.push({
                    id: `auto-${term}`,
                    keyword: term,
                    color: color,
                    lineEffect: false,
                    enabled: true // EXPLICITLY ENABLE
                });
            }
        });

        // Precedence: Manual Updates > Auto Generated
        // We put baseHighlights FIRST so find() returns manual highlight if both exist 
        // (though we try to filter duplicates, partial matches might still occur)
        return [...baseHighlights, ...autoHighlights];
    }, [currentConfig?.highlights, currentConfig?.happyGroups, currentConfig?.includeGroups, currentConfig?.colorHighlightsCaseSensitive, currentConfig?.happyCombosCaseSensitive]);

    // Memoized handlers for Right Pane
    const onLineClickRight = React.useCallback((index: number, isShift?: boolean, isCtrl?: boolean) => handleLineClick('right', index, !!isShift, !!isCtrl), [handleLineClick]);
    const onLineDoubleClickRight = React.useCallback((index: number) => handleLineDoubleClickAction(index, 'right'), [handleLineDoubleClickAction]);
    const onBrowseRight = React.useCallback(() => rightFileInputRef.current?.click(), []);
    const onCopyRight = React.useCallback(() => handleCopyLogs('right'), [handleCopyLogs]);
    const onSaveRight = React.useCallback(() => handleSaveLogs('right'), [handleSaveLogs]);
    const onSyncScrollRight = React.useCallback((dy: number) => handleSyncScroll(dy, 'right'), [handleSyncScroll]);
    const onHighlightJumpRight = React.useCallback((idx: number) => jumpToHighlight(idx, 'right'), [jumpToHighlight]);
    const onShowBookmarksRight = React.useCallback(() => setRightBookmarksOpen(true), []);

    const onBookmarkJumpLeft = React.useCallback((index: number) => {
        setActiveLineIndexLeft(index);
        setSelectedIndicesLeft(new Set([index]));
        leftViewerRef.current?.scrollToIndex(index);
    }, [setActiveLineIndexLeft, setSelectedIndicesLeft]);

    const onBookmarkJumpRight = React.useCallback((index: number) => {
        setActiveLineIndexRight(index);
        setSelectedIndicesRight(new Set([index]));
        rightViewerRef.current?.scrollToIndex(index);
    }, [setActiveLineIndexRight, setSelectedIndicesRight]);

    // Page Navigation Handlers
    const handlePageNavRequestLeft = React.useCallback((direction: 'next' | 'prev') => {
        if (direction === 'next') {
            if (leftSegmentIndex < leftTotalSegments - 1) {
                // Jump to the START of the NEXT page
                const target = (leftSegmentIndex + 1) * MAX_SEGMENT_SIZE;
                console.log(`[LogSession] PageDown (Left): Jumping to start of next segment (Index ${target})`);
                jumpToGlobalLine(target, 'left', 'start');
            }
        } else {
            if (leftSegmentIndex > 0) {
                // Jump to the END of the PREVIOUS page
                const target = (leftSegmentIndex * MAX_SEGMENT_SIZE) - 1;
                console.log(`[LogSession] PageUp (Left): Jumping to end of prev segment (Index ${target})`);
                jumpToGlobalLine(target, 'left', 'end');
            }
        }
    }, [leftSegmentIndex, leftTotalSegments, jumpToGlobalLine]);

    const handlePageNavRequestRight = React.useCallback((direction: 'next' | 'prev') => {
        if (direction === 'next') {
            if (rightSegmentIndex < rightTotalSegments - 1) {
                const target = (rightSegmentIndex + 1) * MAX_SEGMENT_SIZE;
                console.log(`[LogSession] PageDown (Right): Jumping to start of next segment (Index ${target})`);
                jumpToGlobalLine(target, 'right', 'start');
            }
        } else {
            if (rightSegmentIndex > 0) {
                const target = (rightSegmentIndex * MAX_SEGMENT_SIZE) - 1;
                console.log(`[LogSession] PageUp (Right): Jumping to end of prev segment (Index ${target})`);
                jumpToGlobalLine(target, 'right', 'end');
            }
        }
    }, [rightSegmentIndex, rightTotalSegments, jumpToGlobalLine]);

    // Scroll To Bottom Handlers
    const handleScrollToBottomRequestLeft = React.useCallback(() => {
        // Jump to very last global line
        if (leftFilteredCount > 0) {
            jumpToGlobalLine(leftFilteredCount - 1, 'left', 'end');
        }
    }, [leftFilteredCount, jumpToGlobalLine]);

    const handleScrollToBottomRequestRight = React.useCallback(() => {
        if (rightFilteredCount > 0) {
            jumpToGlobalLine(rightFilteredCount - 1, 'right', 'end');
        }
    }, [rightFilteredCount, jumpToGlobalLine]);

    // ✅ Ctrl + Wheel Zoom Support (Uses shared logic)
    // We use a native Ref and event listener because React's onWheel is passive by default in some browsers/versions
    // and might not reliably prevent the native browser zoom (Ctrl+Wheel).
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isActive) return;

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                // ✅ 형님, Perf Dashboard가 활성화된 경우 폰트 줌 대신 Flame Map 줌이 작동하도록 양보합니다.
                const target = e.target as HTMLElement;
                if (!target || typeof target.closest !== 'function') return;

                const logPane = target.closest('.log-viewer-pane');
                const targetPaneId = logPane?.getAttribute('data-pane-id');
                const isOverDashboard = !!target.closest('.perf-dashboard-container');

                // ✅ 형님, 오직 현재 마우스가 올라가 있는 Pane에 분석 결과가 있을 때만 폰트 줌을 양보합니다.
                let shouldSkipForPerf = false;
                if (targetPaneId === 'left') {
                    shouldSkipForPerf = !!(leftPerfAnalysisResult || isAnalyzingPerformanceLeft);
                } else if (targetPaneId === 'right') {
                    shouldSkipForPerf = !!(rightPerfAnalysisResult || isAnalyzingPerformanceRight);
                } else if (isOverDashboard) {
                    // 대시보드 위라면 무조건 양보 (대시보드가 줌 처리)
                    shouldSkipForPerf = true;
                } else if (!targetPaneId && (leftPerfAnalysisResult || rightPerfAnalysisResult)) {
                    // 싱글 뷰 모드 등
                    shouldSkipForPerf = true;
                }

                if (shouldSkipForPerf) {
                    return;
                }

                // ✅ Aggressively prevent default at the window level during capture phase
                e.preventDefault();
                e.stopPropagation();

                const delta = e.deltaY; // Negative is UP (Zoom In), Positive is DOWN (Zoom Out)

                if (delta < 0) {
                    handleZoomIn('mouse');
                } else {
                    handleZoomOut('mouse');
                }
            }
        };

        // ✅ Use 'capture: true' to intercept the event before it reaches any children or the browser
        window.addEventListener('wheel', onWheel, { passive: false, capture: true });

        return () => {
            window.removeEventListener('wheel', onWheel, { capture: true });
        };
    }, [isActive, handleZoomIn, handleZoomOut, leftPerfAnalysisResult, rightPerfAnalysisResult, isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight]);

    return (
        <div
            ref={containerRef}
            className="flex h-full flex-col font-sans overflow-hidden"
            style={{ display: isActive ? 'flex' : 'none' }}
        // onWheel={handleWheel} // Removed in favor of native listener
        >

            {/* Header Area with Hide Animation in Focus Mode */}
            {/* Header Area with Hide Animation in Focus Mode */}
            <div className={`transition-[margin-top] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] z-50 will-change-[margin-top] ${(isFocusMode && !isPanelOpen && !isSearchFocused) ? '-mt-16 delay-100 pointer-events-none' : 'mt-0 delay-0 pointer-events-auto'}`}>
                <TopBar onReturnFocus={() => {
                    // Logic to determine which pane to focus
                    if (isDualView) {
                        // If Right has selection and Left doesn't, focus Right
                        if (selectedIndicesRight?.size > 0 && (!selectedIndicesLeft || selectedIndicesLeft.size === 0)) {
                            handleFocusPaneRequest('right');
                            return;
                        }
                    }
                    handleFocusPaneRequest('left');
                }} />
            </div>

            {/* Main Content Area */}
            {/* Added transition-all to synchronize with header movement */}
            {/* Main Content Area - Placeholder for transition if needed, but real content is below */}


            {/* Global Shortcut Handler for Ctrl+B */}
            {React.createElement(
                React.Fragment,
                null,
                // Inline effect for global shortcut
                (() => {
                    React.useEffect(() => {
                        const handleGlobalKeyDown = (e: KeyboardEvent) => {
                            // 1. ESC: Close Transaction Drawer (Highest priority, works even if not "active" tab context)
                            if (e.key === 'Escape') {
                                if (isTransactionDrawerOpen) {
                                    setIsTransactionDrawerOpen(false);
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                }
                            }

                            // If Save Dialog or Archive Viewer is open, disable all shortcuts to allow typing/local shortcuts
                            if (isSaveDialogOpen || isViewerOpen) return;

                            // All other shortcuts require the session to be active
                            if (!isActive) return;

                            // F3: Next Bookmark, F4 (or Shift+F3): Prev Bookmark
                            if (e.key === 'F3' || e.key === 'F4') {
                                // If inside input, ignore? No, usually F3 works globally unless consumed.
                                e.preventDefault();
                                e.stopPropagation();

                                if (!isActive) return;

                                if (!isDualView && e.shiftKey) return;

                                let targetPane = 'left';
                                if (e.shiftKey) {
                                    if (!isDualView) return;
                                    targetPane = 'right';
                                } else {
                                    targetPane = 'left';
                                }

                                const isPrev = e.key === 'F3'; // F3 (and Shift+F3) = Prev, F4 (and Shift+F4) = Next
                                const st = stateRef.current;
                                const bookmarks = targetPane === 'right' ? st.rightBookmarks : st.leftBookmarks;
                                const currentLine = targetPane === 'right' ? st.activeLineIndexRight : st.activeLineIndexLeft;

                                const sorted = Array.from(bookmarks).sort((a, b) => a - b);
                                if (sorted.length === 0) return;

                                let targetIdx = -1;

                                if (isPrev) {
                                    // Find largest bookmark < currentLine
                                    const prevs = sorted.filter(b => b < currentLine);
                                    if (prevs.length > 0) targetIdx = prevs[prevs.length - 1];
                                    else targetIdx = sorted[sorted.length - 1]; // Wrap to last
                                } else {
                                    // Find smallest bookmark > currentLine
                                    const nexts = sorted.filter(b => b > currentLine);
                                    if (nexts.length > 0) targetIdx = nexts[0];
                                    else targetIdx = sorted[0]; // Wrap to first
                                }

                                if (targetIdx !== -1) {
                                    jumpToGlobalLine(targetIdx, targetPane as 'left' | 'right');
                                }

                                return;
                            }


                            if (e.code === 'Space') {
                                console.log('[LogSession] Space Key Pressed', { isActive, target: (e.target as HTMLElement).tagName });

                                if (!isActive) {
                                    console.log('[LogSession] Ignored: Not Active');
                                    return;
                                }

                                // Ignore if typing in an input
                                const target = e.target as HTMLElement;
                                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                                    console.log('[LogSession] Ignored: Input Focus');
                                    return;
                                }

                                e.preventDefault();
                                e.stopPropagation();

                                let targetPane = 'left';
                                if (isDualView) {
                                    const activeEl = document.activeElement;
                                    if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                                        targetPane = 'right';
                                    }
                                }

                                const st = stateRef.current;
                                const currentIndex = targetPane === 'right' ? st.activeLineIndexRight : st.activeLineIndexLeft;

                                console.log(`[LogSession] Attempting Toggle: Pane=${targetPane}, Index=${currentIndex}`);

                                if (currentIndex !== -1) {
                                    if (targetPane === 'right') toggleRightBookmark(currentIndex);
                                    else toggleLeftBookmark(currentIndex);
                                } else {
                                    console.warn('[LogSession] No line selected to bookmark');
                                }
                                return;
                            }


                            if (e.key === 'PageDown' || e.key === 'PageUp') {
                                if (!isActive) return;

                                let targetPane = 'left';
                                if (isDualView) {
                                    const activeEl = document.activeElement;
                                    if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                                        targetPane = 'right';
                                    }
                                }

                                const viewer = targetPane === 'left' ? leftViewerRef.current : rightViewerRef.current;
                                if (!viewer) return;

                                if (e.key === 'PageDown') {
                                    if (viewer.isAtBottom()) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const handler = targetPane === 'left' ? handlePageNavRequestLeft : handlePageNavRequestRight;
                                        // We need to access the LATEST callback.
                                        // Since we are inside useEffect with deps...
                                        // We must depend on handlePageNavRequestLeft/Right in useEffect
                                        // OR use stateRef approach?
                                        // But handlePageNavRequestLeft depends on state.
                                        // Adding handlePageNavRequestLeft to dependency array is correct.
                                        if (targetPane === 'left') handlePageNavRequestLeft('next');
                                        else handlePageNavRequestRight('next');
                                    }
                                } else {
                                    if (viewer.isAtTop()) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (targetPane === 'left') handlePageNavRequestLeft('prev');
                                        else handlePageNavRequestRight('prev');
                                    }
                                }
                                return;
                            }

                            if (e.ctrlKey || e.metaKey) {
                                // Check if we are in this session (should be active)
                                if (!isActive) return;

                                // Ctrl + Shift + X: Clear Logs (SSH/SDB connection only)
                                if (e.shiftKey && (e.key === 'x' || e.key === 'X')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (tizenSocket) {
                                        handleClearLogs();
                                    }
                                    return;
                                }

                                // Ctrl + ` : Toggle Configuration Panel
                                if (e.key === '`' || e.key === '~') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsPanelOpen(prev => !prev);
                                    return;
                                }

                                // Ctrl + B: View Bookmarks
                                if (e.key === 'b' || e.key === 'B') {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Determine target based on focus or default to left
                                    let target = 'left';
                                    if (isDualView) {
                                        const activeEl = document.activeElement;
                                        if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                                            target = 'right';
                                        }
                                    }

                                    if (target === 'right') onShowBookmarksRight();
                                    else onShowBookmarksLeft();
                                }

                                // Ctrl + 1~5: Jump to Highlight #N
                                if (['1', '2', '3', '4', '5'].includes(e.key)) {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    const highlightIdx = parseInt(e.key, 10) - 1;

                                    let targetPath = 'left';
                                    if (isDualView) {
                                        const activeEl = document.activeElement;
                                        if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                                            targetPath = 'right';
                                        }
                                    }

                                    jumpToHighlight(highlightIdx, targetPath as 'left' | 'right');
                                }

                                // Ctrl + F (Find) - Ensure Shift is NOT pressed so we don't trap Ctrl+Shift+F
                                if ((e.key === 'f' || e.key === 'F') && !e.shiftKey) {
                                    // If PerfDashboard is open, let PerfDashboard handle Ctrl+F
                                    if (leftPerfAnalysisResult || rightPerfAnalysisResult || isAnalyzingPerformanceLeft || isAnalyzingPerformanceRight) {
                                        return; // Don't intercept - PerfDashboard's listener will handle it
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    searchInputRef.current?.focus();
                                }

                                // Ctrl + G (Go To Line)
                                if (e.key === 'g' || e.key === 'G') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsGoToLineModalOpen((prev: boolean) => !prev);
                                }

                                // ✅ Ctrl + C (Copy) - Explicit Handling
                                if (e.key === 'c' || e.key === 'C') {
                                    // 1. Check native text selection first
                                    const selection = window.getSelection()?.toString();
                                    if (selection && selection.length > 0) {
                                        // 🔥 Log Copy Precision: Remove trailing newline from native selection
                                        navigator.clipboard.writeText(selection.replace(/\r?\n$/, ''));
                                        addToast('Selection copied!', 'success'); // ✅ 형님, Alt+드래그 복사 피드백 추가했습니다!
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                    }

                                    // 2. If no text selection, try copying selected lines (Custom Logic)
                                    // Determine pane
                                    let targetPane = 'left';
                                    if (isDualView) {
                                        const activeEl = document.activeElement;
                                        if (activeEl && activeEl.closest('[data-pane-id="right"]')) {
                                            targetPane = 'right';
                                        }
                                    }

                                    // Check if lines are selected
                                    const st = stateRef.current;
                                    const selectedIndices = targetPane === 'right' ? st.selectedIndicesRight : st.selectedIndicesLeft;

                                    if (selectedIndices.size > 0) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCopyLogs(targetPane as 'left' | 'right');
                                    }
                                }
                            }
                        };

                        // ✅ 글로벌 복사 이벤트 감지 (우클릭 등 앱 전역 복사 피드백 보강)
                        const handleGlobalCopy = () => {
                            const selection = window.getSelection()?.toString();
                            if (selection && selection.length > 0) {
                                // 단, Ctrl+C 핸들러에서 이미 toast를 띄우므로 중복 방지를 위해 
                                // activeElement가 input이나 textarea인 경우는 제외하거나 로직 고민 가능.
                                // 여기서는 단순 텍스트 선택이 있는 경우에만 띄웁니다.
                                // (Ctrl+C 핸들러에서 preventDefault를 하므로 이 이벤트는 trigger 되지 않을 수도 있음)
                                console.log('[LogSession] Native copy detected');
                                if (!document.activeElement?.matches('input, textarea')) {
                                    addToast('Selection copied to clipboard!', 'success'); // ✅ 우클릭 복사 시에도 피드백 제공
                                }
                            }
                        };

                        window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
                        window.addEventListener('copy', handleGlobalCopy);
                        return () => {
                            window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
                            window.removeEventListener('copy', handleGlobalCopy);
                        };
                    }, [isActive, isDualView, onShowBookmarksLeft, onShowBookmarksRight, jumpToHighlight, handlePageNavRequestLeft, handlePageNavRequestRight, toggleLeftBookmark, toggleRightBookmark, setIsGoToLineModalOpen, setIsPanelOpen, updateLogViewPreferences, logViewPreferences, handleCopyLogs, isSaveDialogOpen, isViewerOpen, tizenSocket, handleClearLogs, isTransactionDrawerOpen, setIsTransactionDrawerOpen, addToast, leftPerfAnalysisResult, rightPerfAnalysisResult, isAnalyzingPerformanceLeft, isAnalyzingPerformanceRight]);
                    return null;
                })()
            )}

            {/* Hidden File Inputs for Click-to-Upload */}
            <input type="file" ref={leftFileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleLeftFileChange(e.target.files[0]); e.target.value = ''; } }} />
            <input type="file" ref={rightFileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleRightFileChange(e.target.files[0]); e.target.value = ''; } }} />

            {/* Tizen Connection Modal */}
            <TizenConnectionModal
                isOpen={isTizenModalOpen}
                onClose={() => setIsTizenModalOpen(false)}
                onStreamStart={handleTizenStreamStart}
                isConnected={!!tizenSocket}
                onDisconnect={handleTizenDisconnect}
                currentConnectionInfo={leftFileName}
                isQuickConnect={isTizenQuickConnect}
                tags={currentConfig?.logTags || []}
                logCommand={(() => {
                    if (!currentConfig) return undefined;
                    const cmd = currentConfig.logCommand ?? defaultLogCommand;
                    const tags = (currentConfig.logTags || []).join(' ');
                    // Explicitly substitute tags client-side to ensure server gets the final command
                    // especially for SDB reconnects where server-side substitution might be flaky or unimplemented
                    return cmd.replace(/\$\(TAGS\)/g, tags);
                })()}
            />



            {/* Raw Context View */}
            {rawContextOpen && rawContextTargetLine && (
                <RawContextViewer
                    sourcePane={rawContextSourcePane}
                    leftFileName={leftFileName || ''}
                    rightFileName={rightFileName || ''}
                    targetLine={rawContextTargetLine}
                    onClose={() => setRawContextOpen(false)}
                    heightPercent={rawContextHeight}
                    onResizeStart={handleRawContextResizeStart}
                    leftTotalLines={leftTotalLines}
                    rightTotalLines={rightTotalLines}
                    requestLeftRawLines={requestLeftRawLines}
                    requestRightRawLines={requestRightRawLines}
                    preferences={logViewPreferences}
                    highlightRange={rawViewHighlightRange}
                />
            )}

            <div ref={logContentRef} className="flex-1 flex overflow-hidden h-full relative group/layout">
                {/* Configuration Panel with Resize Handle - Always visible even in Focus Mode */}
                <div className="block h-full flex-none">
                    <ConfigurationPanel />
                </div>

                <div className={`flex-1 flex flex-col overflow-hidden relative z-0 transition-[padding-top] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${isFocusMode ? 'pt-0' : 'pt-8'}`}>

                    {/* Render Tab Bar here (passed from parent) - REMOVED, now global in LogExtractor */}



                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex w-full h-full">
                            {/* Left Pane */}
                            <div className={`flex flex-col h-full min-w-0 ${!isResizing ? 'transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]' : 'transition-none'} relative ${isDualView ? 'w-1/2' : 'w-full'}`}>
                                <LoadingOverlay
                                    isVisible={!!leftFileName && !leftWorkerReady && leftIndexingProgress < 100}
                                    fileName={leftFileName || ''}
                                    progress={leftIndexingProgress}
                                />
                                <LogViewerPane
                                    key={`left-pane-${leftFileName || 'empty'}-${leftSegmentIndex}`} // Force remount on segment change to clear cache
                                    ref={leftViewerRef}
                                    workerReady={leftWorkerReady}
                                    totalMatches={leftCurrentSegmentLines} // Show limited segment count
                                    onScrollRequest={requestLeftLines}
                                    absoluteOffset={leftSegmentIndex * MAX_SEGMENT_SIZE}
                                    placeholderText={leftFileName || (isDualView ? "Drag log file here" : "Drop a log file to start")}
                                    highlights={effectiveHighlights}
                                    highlightCaseSensitive={!!currentConfig?.happyCombosCaseSensitive || !!currentConfig?.colorHighlightsCaseSensitive}
                                    onLineClick={onLineClickLeft}
                                    onLineDoubleClick={onLineDoubleClickLeft}
                                    activeLineIndex={activeLineIndexLeft}
                                    selectedIndices={selectedIndicesLeft}
                                    onDrop={handleLeftFileChange}
                                    onBrowse={onBrowseLeft}
                                    paneId="left"
                                    fileName={leftFileName || undefined}
                                    onReset={handleLeftReset}
                                    onCopy={onCopyLeft}
                                    onSave={onSaveLeft}
                                    bookmarks={leftBookmarks}
                                    onToggleBookmark={toggleLeftBookmark}
                                    onFocusPaneRequest={handleFocusPaneRequest}
                                    onSyncScroll={onSyncScrollLeft}
                                    onHighlightJump={onHighlightJumpLeft}
                                    isActive={isActive}
                                    onShowBookmarks={onShowBookmarksLeft}
                                    performanceHeatmap={leftPerformanceHeatmap}
                                    onAnalyzePerformance={handleAnalyzePerformanceLeft}
                                    perfAnalysisResult={leftPerfAnalysisResult}
                                    isAnalyzingPerformance={isAnalyzingPerformanceLeft}
                                    onJumpToLine={handleJumpToLineLeft}
                                    onJumpToRange={handleJumpToRangeLeft}
                                    onViewRawRange={handleViewRawRangeLeft}
                                    onCopyRawRange={handleCopyRawRangeLeft}
                                    dashboardHeight={perfDashboardHeight}
                                    onDashboardHeightChange={setPerfDashboardHeight}
                                    lineHighlightRanges={leftLineHighlightRanges}
                                    onPageNavRequest={handlePageNavRequestLeft}
                                    onScrollToBottomRequest={handleScrollToBottomRequestLeft}
                                    preferences={logViewPreferences}
                                    onContextMenu={handleContextMenu}
                                    onArchiveSave={onArchiveSaveLeft}
                                    isArchiveSaveEnabled={isLeftArchiveEnabled}
                                />
                                {(leftTotalSegments > 1 || leftSelectionDuration) && (
                                    <div className="h-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 py-1 text-[10px] font-mono select-none z-30 shrink-0 shadow-inner">
                                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">PAGE {leftSegmentIndex + 1}/{leftTotalSegments}</span>
                                            <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                            <span className="font-medium">{(leftSegmentIndex * MAX_SEGMENT_SIZE + 1).toLocaleString()} - {Math.min((leftSegmentIndex + 1) * MAX_SEGMENT_SIZE, leftFilteredCount).toLocaleString()}</span>
                                            <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                            <span className="opacity-70">Total: {leftFilteredCount.toLocaleString()}</span>
                                            {leftSelectionDuration && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                                    <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                                                        ⏱ {leftSelectionDuration}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                disabled={leftSegmentIndex === 0}
                                                onClick={() => setLeftSegmentIndex(Math.max(0, leftSegmentIndex - 1))}
                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300 transition-colors"
                                                title="Previous Page (1.5M lines)"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <button
                                                disabled={leftSegmentIndex >= leftTotalSegments - 1}
                                                onClick={() => setLeftSegmentIndex(Math.min(leftTotalSegments - 1, leftSegmentIndex + 1))}
                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300 transition-colors"
                                                title="Next Page (1.5M lines)"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Pane */}
                            <div className={`flex flex-col h-full min-w-0 bg-slate-950 relative ${isDualView ? 'flex w-1/2' : 'hidden w-0'}`} data-pane-id="right">
                                <LoadingOverlay
                                    isVisible={!!rightFileName && !rightWorkerReady && rightIndexingProgress < 100}
                                    fileName={rightFileName}
                                    progress={rightIndexingProgress}
                                />
                                <div className="flex w-full h-full">
                                    <div className="w-1 bg-slate-900 hover:bg-indigo-600 transition-colors cursor-col-resize z-30 shadow-xl"></div>
                                    <div className="flex-1 h-full min-w-0 flex flex-col">
                                        <LogViewerPane
                                            key={`right-pane-${rightFileName || 'empty'}-${rightSegmentIndex}`}
                                            ref={rightViewerRef}
                                            workerReady={rightWorkerReady}
                                            totalMatches={rightCurrentSegmentLines}
                                            onScrollRequest={requestRightLines}
                                            absoluteOffset={rightSegmentIndex * MAX_SEGMENT_SIZE}
                                            placeholderText={rightFileName || "Drag log file here"}
                                            highlights={effectiveHighlights}
                                            highlightCaseSensitive={!!currentConfig?.happyCombosCaseSensitive || !!currentConfig?.colorHighlightsCaseSensitive}
                                            hotkeyScope="alt"
                                            onLineClick={onLineClickRight}
                                            onLineDoubleClick={onLineDoubleClickRight}
                                            activeLineIndex={activeLineIndexRight}
                                            selectedIndices={selectedIndicesRight}
                                            onDrop={handleRightFileChange}
                                            onBrowse={onBrowseRight}
                                            paneId="right"
                                            fileName={rightFileName || undefined}
                                            onReset={handleRightReset}
                                            onCopy={onCopyRight}
                                            onSave={onSaveRight}
                                            bookmarks={rightBookmarks}
                                            onToggleBookmark={toggleRightBookmark}
                                            onFocusPaneRequest={handleFocusPaneRequest}
                                            onSyncScroll={onSyncScrollRight}
                                            onHighlightJump={onHighlightJumpRight}

                                            isActive={isActive}
                                            onShowBookmarks={onShowBookmarksRight}
                                            performanceHeatmap={rightPerformanceHeatmap}
                                            onAnalyzePerformance={handleAnalyzePerformanceRight}
                                            perfAnalysisResult={rightPerfAnalysisResult}
                                            isAnalyzingPerformance={isAnalyzingPerformanceRight}
                                            onJumpToLine={handleJumpToLineRight}
                                            onJumpToRange={handleJumpToRangeRight}
                                            onViewRawRange={handleViewRawRangeRight}
                                            lineHighlightRanges={rightLineHighlightRanges}
                                            onPageNavRequest={handlePageNavRequestRight}
                                            onScrollToBottomRequest={handleScrollToBottomRequestRight}
                                            preferences={logViewPreferences}
                                            onContextMenu={handleContextMenu}
                                            onArchiveSave={onArchiveSaveRight}
                                            isArchiveSaveEnabled={isRightArchiveEnabled}
                                        />
                                        {(rightTotalSegments > 1 || rightSelectionDuration) && (
                                            <div className="h-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 py-1 text-[10px] font-mono select-none z-30 shrink-0 shadow-inner">
                                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">PAGE {rightSegmentIndex + 1}/{rightTotalSegments}</span>
                                                    <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                                    <span className="font-medium">{(rightSegmentIndex * MAX_SEGMENT_SIZE + 1).toLocaleString()} - {Math.min((rightSegmentIndex + 1) * MAX_SEGMENT_SIZE, rightFilteredCount).toLocaleString()}</span>
                                                    <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                                    <span className="opacity-70">Total: {rightFilteredCount.toLocaleString()}</span>
                                                    {rightSelectionDuration && (
                                                        <>
                                                            <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                                            <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                                                                ⏱ {rightSelectionDuration}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        disabled={rightSegmentIndex === 0}
                                                        onClick={() => setRightSegmentIndex(Math.max(0, rightSegmentIndex - 1))}
                                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300 transition-colors"
                                                        title="Previous Page (1.5M lines)"
                                                    >
                                                        <ChevronLeft size={14} />
                                                    </button>
                                                    <button
                                                        disabled={rightSegmentIndex >= rightTotalSegments - 1}
                                                        onClick={() => setRightSegmentIndex(Math.min(rightTotalSegments - 1, rightSegmentIndex + 1))}
                                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300 transition-colors"
                                                        title="Next Page (1.5M lines)"
                                                    >
                                                        <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Tizen Command Input */}
                        {tizenSocket && (
                            <div className="h-10 bg-slate-950 border-t border-slate-800 flex items-center px-4 gap-3 shrink-0 z-30">
                                <span className="text-indigo-400 font-bold text-xs whitespace-nowrap flex items-center gap-1"><Lucide.Terminal size={12} /> SHELL &gt;</span>
                                <input
                                    className="flex-1 bg-transparent text-slate-200 text-sm focus:outline-none font-mono placeholder-slate-600"
                                    placeholder="Type sdb shell command..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            sendTizenCommand(e.currentTarget.value + '\n');
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleClearLogs}
                                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                                    title="Clear Logs"
                                >
                                    <Eraser size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Go To Line Modal */}
            <GoToLineModal
                isOpen={isGoToLineModalOpen}
                onClose={() => setIsGoToLineModalOpen(false)}
                onGo={(lineIndex, pane) => jumpToGlobalLine(lineIndex, pane)}
                isDualView={isDualView}
                leftTotalLines={leftFilteredCount || 0}
                rightTotalLines={rightFilteredCount || 0}
                leftFileName={leftFileName || 'Left'}
                rightFileName={rightFileName || 'Right'}
            />

            {/* Bookmarks Modal - Left */}
            <BookmarksModal
                isOpen={isLeftBookmarksOpen}
                onClose={() => setLeftBookmarksOpen(false)}
                bookmarks={leftBookmarks}
                onJump={(index) => {
                    handleFocusPaneRequest('left');
                    jumpToGlobalLine(index, 'left');
                }}
                requestLines={requestLeftBookmarkedLines}
                title={`Bookmarks - ${leftFileName || 'Left Pane'}`}
                onClearAll={clearLeftBookmarks}
                onDeleteBookmark={toggleLeftBookmark}
                highlights={effectiveHighlights}
                caseSensitive={currentConfig?.colorHighlightsCaseSensitive}
            />

            {/* Bookmarks Modal - Right */}
            {isDualView && (
                <BookmarksModal
                    isOpen={isRightBookmarksOpen}
                    onClose={() => setRightBookmarksOpen(false)}
                    bookmarks={rightBookmarks}
                    onJump={(index) => {
                        handleFocusPaneRequest('right');
                        jumpToGlobalLine(index, 'right');
                    }}
                    requestLines={requestRightBookmarkedLines}
                    title={`Bookmarks - ${rightFileName || 'Right Pane'}`}
                    onClearAll={clearRightBookmarks}
                    onDeleteBookmark={toggleRightBookmark}
                    highlights={effectiveHighlights}
                    caseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                />
            )}


            {ContextMenuComponent}

            {/* Transaction Analysis Drawer */}
            <TransactionDrawer
                isOpen={isTransactionDrawerOpen}
                onClose={() => setIsTransactionDrawerOpen(false)}
                identity={transactionIdentity}
                logs={transactionResults}
                isLoading={isAnalyzingTransaction}
                onJumpToLine={(lineNum, visualIndex) => {
                    handleFocusPaneRequest(transactionSourcePane);
                    jumpToGlobalLine(visualIndex, transactionSourcePane);
                }}
            />
        </div>
    );
};

export default LogSession;
