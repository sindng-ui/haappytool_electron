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
import { SpamAnalyzerPanel } from './LogViewer/SpamAnalyzerPanel';
import { useLogSelection } from './LogArchive/hooks/useLogSelection';
// FloatingActionButton removed
import { useLogArchiveContext } from './LogArchive/LogArchiveProvider';
import { useContextMenu } from './ContextMenu';
import { useToast } from '../contexts/ToastContext';
import { useHappyTool } from '../contexts/HappyToolContext';
import TransactionDrawer from './LogViewer/TransactionDrawer';
import { useLogSessionShortcuts } from '../hooks/useLogSessionShortcuts';
import { RawContextViewer } from './LogViewer/RawContextViewer';
import { useLogSessionContextMenus } from '../hooks/useLogSessionContextMenus';
import { useLogSessionHighlights } from '../hooks/useLogSessionHighlights';
import { useLogSessionArchive } from '../hooks/useLogSessionArchive';
import { useLogSessionPaneCallbacks } from '../hooks/useLogSessionPaneCallbacks';
import { useLogSessionEffects } from '../hooks/useLogSessionEffects';

const { X, Eraser, ChevronLeft, ChevronRight, GripHorizontal } = Lucide;


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
        handleZoomIn, handleZoomOut, // ✅ Consumed
        quickFilter, setQuickFilter,
        isSpamAnalyzerOpen, setIsSpamAnalyzerOpen,
        isAnalyzingSpam, spamResultsLeft, requestSpamAnalysisLeft,
        clearCacheTick
    } = useLogContext();

    const handleGoToLineClose = React.useCallback(() => setIsGoToLineModalOpen(false), [setIsGoToLineModalOpen]);
    const handleGoToLineGo = React.useCallback((lineIndex: number, pane: 'left' | 'right') => {
        jumpToGlobalLine(lineIndex, pane);
    }, [jumpToGlobalLine]);

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

    // === ARCHIVE SAVE & SELECTION DURATION === //
    const {
        isLeftArchiveEnabled,
        isRightArchiveEnabled,
        onArchiveSaveLeft,
        onArchiveSaveRight,
        leftSelectionDuration,
        rightSelectionDuration,
    } = useLogSessionArchive({
        leftWorkerReady,
        rightWorkerReady,
        leftFilteredCount,
        rightFilteredCount,
        requestLeftLines,
        requestRightLines,
        leftFileName,
        rightFileName,
        openSaveDialog,
        isDualView,
        selectedIndicesLeft,
        selectedIndicesRight,
        tizenSocket,
    });

    // === NEW CONTEXT MENU LOGIC === //
    const { handleContextMenu, handleUnifiedSave } = useLogSessionContextMenus({
        nativeSelection, selectedIndicesLeft, selectedIndicesRight, activeLineIndexLeft,
        activeLineIndexRight, isDualView, leftFileName, rightFileName,
        showContextMenu, requestLeftLines, requestRightLines, analyzeTransactionAction, openSaveDialog
    });

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

    const rowHeight = logViewPreferences?.rowHeight || 24;

    // === PANE CALLBACKS (click, scroll, nav, bookmarks) === //
    const {
        handleSyncScroll, handleFocusPaneRequest,
        requestLeftBookmarkedLines, requestRightBookmarkedLines,
        onBookmarkJumpLeft, onBookmarkJumpRight,
        handlePageNavRequestLeft, handlePageNavRequestRight,
        handleScrollToBottomRequestLeft, handleScrollToBottomRequestRight,
        onLineClickLeft, onLineDoubleClickLeft, onBrowseLeft, onCopyLeft, onSaveLeft, onSyncScrollLeft, onHighlightJumpLeft, onShowBookmarksLeft,
        onLineClickRight, onLineDoubleClickRight, onBrowseRight, onCopyRight, onSaveRight, onSyncScrollRight, onHighlightJumpRight, onShowBookmarksRight,
    } = useLogSessionPaneCallbacks({
        leftViewerRef, rightViewerRef, leftFileInputRef, rightFileInputRef,
        isDualView,
        handleLineClick, handleLineDoubleClickAction,
        handleCopyLogs, handleSaveLogs,
        jumpToHighlight, jumpToGlobalLine,
        setActiveLineIndexLeft, setActiveLineIndexRight,
        setSelectedIndicesLeft, setSelectedIndicesRight,
        setLeftBookmarksOpen, setRightBookmarksOpen,
        requestBookmarkedLines,
        leftSegmentIndex, rightSegmentIndex,
        leftTotalSegments, rightTotalSegments,
        leftFilteredCount, rightFilteredCount,
        rowHeight,
        leftSegmentOffset: leftSegmentIndex * MAX_SEGMENT_SIZE,
        rightSegmentOffset: rightSegmentIndex * MAX_SEGMENT_SIZE,
    });

    // Prepare Effective Highlights (Explicit + Auto-generated Highlighting for Happy Combos)
    const effectiveHighlights = useLogSessionHighlights(currentConfig);

    // containerRef: Ctrl+Wheel 이벤트와 JSX ref용 (이벤트는 useLogSessionEffects 훅으로 이동)
    const containerRef = React.useRef<HTMLDivElement>(null);

    // === SIDE EFFECTS: Tab Title + Ctrl+Wheel Zoom ===
    useLogSessionEffects({
        isActive,
        leftFileName,
        currentTitle,
        onTitleChange,
        handleZoomIn,
        handleZoomOut,
        leftPerfAnalysisResult,
        rightPerfAnalysisResult,
        isAnalyzingPerformanceLeft,
        isAnalyzingPerformanceRight,
    });

    // Track latest state for global shortcuts
    const stateRef = React.useRef({ activeLineIndexLeft, activeLineIndexRight, selectedIndicesLeft, selectedIndicesRight, leftBookmarks, rightBookmarks });
    React.useEffect(() => {
        stateRef.current = { activeLineIndexLeft, activeLineIndexRight, selectedIndicesLeft, selectedIndicesRight, leftBookmarks, rightBookmarks };
    });

    // Initialize global keyboard and copy shortcuts
    useLogSessionShortcuts({
        isActive,
        isDualView,
        isSaveDialogOpen,
        isViewerOpen,
        isTransactionDrawerOpen,
        stateRef,
        tizenSocket,
        leftViewerRef,
        rightViewerRef,
        searchInputRef,
        setIsTransactionDrawerOpen,
        jumpToGlobalLine,
        toggleLeftBookmark,
        toggleRightBookmark,
        handlePageNavRequestLeft,
        handlePageNavRequestRight,
        handleClearLogs,
        setIsPanelOpen,
        onShowBookmarksLeft,
        onShowBookmarksRight,
        jumpToHighlight,
        setIsGoToLineModalOpen,
        handleCopyLogs,
        addToast,
        leftPerfAnalysisResult,
        rightPerfAnalysisResult,
        isAnalyzingPerformanceLeft,
        isAnalyzingPerformanceRight
    });

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


            {/* Hidden File Inputs for Click-to-Upload */}
            <input type="file" ref={leftFileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleLeftFileChange(e.target.files[0]); e.target.value = ''; } }} />
            <input type="file" ref={rightFileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleRightFileChange(e.target.files[0]); e.target.value = ''; } }} />

            {/* Tizen Connection Modal */}
            <TizenConnectionModal
                isOpen={isTizenModalOpen}
                onClose={React.useCallback(() => {
                    setIsTizenModalOpen(false);
                    setIsTizenQuickConnect(false);
                }, [setIsTizenModalOpen, setIsTizenQuickConnect])}
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
                    clearCacheTick={clearCacheTick}
                />
            )}

            <div ref={logContentRef} className="flex-1 flex overflow-hidden h-full relative group/layout">
                {/* 1. Left Sidebar (Configuration) */}
                <div className="block h-full flex-none">
                    <ConfigurationPanel />
                </div>

                {/* 2. Main Content Area (Spam Analyzer + Log Viewer) */}
                <div className={`flex-1 flex flex-col overflow-hidden relative z-0 transition-[padding-top] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${isFocusMode ? 'pt-0' : 'pt-8'}`}>
                    {/* Integrated Spam Analyzer Panel */}
                    <SpamAnalyzerPanel />

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex w-full h-full">
                            {/* Left Pane */}
                            <div className={`flex flex-col h-full min-w-0 relative ${isDualView ? 'w-1/2' : 'w-full'}`}>
                                <LoadingOverlay
                                    isVisible={!!leftFileName && !leftWorkerReady && leftIndexingProgress < 100}
                                    fileName={leftFileName || ''}
                                    progress={leftIndexingProgress}
                                />
                                <LogViewerPane
                                    key={`left-pane-${leftFileName || 'empty'}-${leftSegmentIndex}`}
                                    ref={leftViewerRef}
                                    workerReady={leftWorkerReady}
                                    totalMatches={leftCurrentSegmentLines}
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
                                    onAnalyzeSpam={() => setIsSpamAnalyzerOpen(true)}
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
                                    clearCacheTick={clearCacheTick}
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
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <button
                                                disabled={leftSegmentIndex >= leftTotalSegments - 1}
                                                onClick={() => setLeftSegmentIndex(Math.min(leftTotalSegments - 1, leftSegmentIndex + 1))}
                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300 transition-colors"
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
                                            onAnalyzeSpam={() => setIsSpamAnalyzerOpen(true)}
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
                                            clearCacheTick={clearCacheTick}
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
                                                    >
                                                        <ChevronLeft size={14} />
                                                    </button>
                                                    <button
                                                        disabled={rightSegmentIndex >= rightTotalSegments - 1}
                                                        onClick={() => setRightSegmentIndex(Math.min(rightTotalSegments - 1, rightSegmentIndex + 1))}
                                                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 dark:text-slate-300 transition-colors"
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
                onClose={handleGoToLineClose}
                onGo={handleGoToLineGo}
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

            {/* Removed SpamAnalyzerModal in favor of integrated SpamAnalyzerPanel */}
        </div>
    );
};

export default LogSession;
