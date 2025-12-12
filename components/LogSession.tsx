import React from 'react';
import * as Lucide from 'lucide-react';
import LogViewerPane, { ROW_HEIGHT } from './LogViewer/LogViewerPane';
import ConfigurationPanel from './LogViewer/ConfigurationPanel';
import TizenConnectionModal from './TizenConnectionModal';
import { useLogContext } from './LogViewer/LogContext';
import TopBar from './LogViewer/TopBar';
import Toast from './ui/Toast';
import LoadingOverlay from './ui/LoadingOverlay';
import { BookmarksModal } from './BookmarksModal';

const { X } = Lucide;

interface LogSessionProps {
    isActive: boolean;
    currentTitle?: string;
    onTitleChange?: (title: string) => void;
    headerElement?: React.ReactNode;
}

const LogSession: React.FC<LogSessionProps> = ({ isActive, currentTitle, onTitleChange, headerElement }) => {
    const leftFileInputRef = React.useRef<HTMLInputElement>(null);
    const rightFileInputRef = React.useRef<HTMLInputElement>(null);

    // Bookmark Modal States
    const [isLeftBookmarksOpen, setLeftBookmarksOpen] = React.useState(false);
    const [isRightBookmarksOpen, setRightBookmarksOpen] = React.useState(false);

    const {
        leftFileName, isDualView, rightFileName,
        setIsTizenModalOpen, isTizenModalOpen, handleTizenStreamStart,
        rawContextOpen, rawContextTargetLine, rawContextHeight, rawContextSourcePane,
        setRawContextOpen, handleRawContextResizeStart,
        leftTotalLines, rightTotalLines, requestLeftRawLines, requestRightRawLines,
        rawViewerRef,
        currentConfig,

        leftViewerRef, leftWorkerReady, leftFilteredCount, requestLeftLines, setSelectedLineIndexLeft,
        handleLineDoubleClickAction, selectedLineIndexLeft, handleLeftFileChange, handleLeftReset, leftIndexingProgress,

        rightViewerRef, rightWorkerReady, rightFilteredCount, requestRightLines, setSelectedLineIndexRight,
        selectedLineIndexRight, handleRightFileChange, handleRightReset, rightIndexingProgress,
        handleCopyLogs, handleSaveLogs,
        leftBookmarks, rightBookmarks, toggleLeftBookmark, toggleRightBookmark,
        clearLeftBookmarks, clearRightBookmarks,
        jumpToHighlight, requestBookmarkedLines,
        tizenSocket, sendTizenCommand,
        toast, closeToast
    } = useLogContext();

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
        const targetSetter = direction === 'left' ? setSelectedLineIndexLeft : setSelectedLineIndexRight;
        const targetCount = direction === 'left' ? leftFilteredCount : rightFilteredCount;

        targetRef.current?.focus();

        if (visualY !== undefined && targetRef.current && targetCount > 0) {
            const targetScrollTop = targetRef.current.getScrollTop();
            const targetAbsY = targetScrollTop + visualY;
            const targetIndex = Math.floor(targetAbsY / ROW_HEIGHT);

            const clampedIndex = Math.max(0, Math.min(targetIndex, targetCount - 1));
            targetSetter(clampedIndex);
        }
    };

    const handleSyncScroll = React.useCallback((scrollTop: number, source: 'left' | 'right') => {
        if (!isDualView) return;
        const targetRef = source === 'left' ? rightViewerRef : leftViewerRef;
        if (targetRef.current) {
            targetRef.current.scrollTo(scrollTop);
        }
    }, [isDualView]);

    // Memoized handlers for Left Pane
    const onLineClickLeft = React.useCallback((index: number) => setSelectedLineIndexLeft(index), [setSelectedLineIndexLeft]);
    const onLineDoubleClickLeft = React.useCallback((index: number) => handleLineDoubleClickAction(index, 'left'), [handleLineDoubleClickAction]);
    const onBrowseLeft = React.useCallback(() => leftFileInputRef.current?.click(), []);
    const onCopyLeft = React.useCallback(() => handleCopyLogs('left'), [handleCopyLogs]);
    const onSaveLeft = React.useCallback(() => handleSaveLogs('left'), [handleSaveLogs]);
    const onSyncScrollLeft = React.useCallback((dy: number) => handleSyncScroll(dy, 'left'), [handleSyncScroll]);
    const onHighlightJumpLeft = React.useCallback((idx: number) => jumpToHighlight(idx, 'left'), [jumpToHighlight]);
    const onShowBookmarksLeft = React.useCallback(() => setLeftBookmarksOpen(true), []);

    // Memoized handlers for Right Pane
    const onLineClickRight = React.useCallback((index: number) => setSelectedLineIndexRight(index), [setSelectedLineIndexRight]);
    const onLineDoubleClickRight = React.useCallback((index: number) => handleLineDoubleClickAction(index, 'right'), [handleLineDoubleClickAction]);
    const onBrowseRight = React.useCallback(() => rightFileInputRef.current?.click(), []);
    const onCopyRight = React.useCallback(() => handleCopyLogs('right'), [handleCopyLogs]);
    const onSaveRight = React.useCallback(() => handleSaveLogs('right'), [handleSaveLogs]);
    const onSyncScrollRight = React.useCallback((dy: number) => handleSyncScroll(dy, 'right'), [handleSyncScroll]);
    const onHighlightJumpRight = React.useCallback((idx: number) => jumpToHighlight(idx, 'right'), [jumpToHighlight]);
    const onShowBookmarksRight = React.useCallback(() => setRightBookmarksOpen(true), []);

    const onBookmarkJumpLeft = React.useCallback((index: number) => {
        setSelectedLineIndexLeft(index);
        leftViewerRef.current?.scrollToIndex(index);
    }, [setSelectedLineIndexLeft]);

    const onBookmarkJumpRight = React.useCallback((index: number) => {
        setSelectedLineIndexRight(index);
        rightViewerRef.current?.scrollToIndex(index);
    }, [setSelectedLineIndexRight]);

    return (
        <div className="flex h-full flex-col font-sans overflow-hidden" style={{ display: isActive ? 'flex' : 'none' }}>

            <TopBar />

            <BookmarksModal
                isOpen={isLeftBookmarksOpen}
                onClose={() => setLeftBookmarksOpen(false)}
                bookmarks={leftBookmarks}
                requestLines={(indices) => requestBookmarkedLines(indices, 'left')}
                onJump={onBookmarkJumpLeft}
                highlights={currentConfig?.highlights}
                caseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                title={`Bookmarks - ${leftFileName || 'Left Pane'}`}
                onClearAll={clearLeftBookmarks}
                onDeleteBookmark={toggleLeftBookmark}
            />
            <BookmarksModal
                isOpen={isRightBookmarksOpen}
                onClose={() => setRightBookmarksOpen(false)}
                bookmarks={rightBookmarks}
                requestLines={(indices) => requestBookmarkedLines(indices, 'right')}
                onJump={onBookmarkJumpRight}
                highlights={currentConfig?.highlights}
                caseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                title={`Bookmarks - ${rightFileName || 'Right Pane'}`}
                onClearAll={clearRightBookmarks}
                onDeleteBookmark={toggleRightBookmark}
            />

            {/* Hidden File Inputs for Click-to-Upload */}
            <input type="file" ref={leftFileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleLeftFileChange(e.target.files[0]); e.target.value = ''; } }} />
            <input type="file" ref={rightFileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.[0]) { handleRightFileChange(e.target.files[0]); e.target.value = ''; } }} />

            <TizenConnectionModal
                isOpen={isTizenModalOpen}
                onClose={() => setIsTizenModalOpen(false)}
                onStreamStart={handleTizenStreamStart}
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={closeToast}
                />
            )}

            {/* Raw Context View */}
            {rawContextOpen && rawContextTargetLine && (
                <div className="absolute left-0 right-0 top-16 bottom-0 z-40 flex flex-col pointer-events-none">
                    <div className="flex flex-col bg-slate-950 pointer-events-auto border-b-2 border-indigo-500 shadow-2xl" style={{ height: `${rawContextHeight}%` }}>
                        <div className="bg-indigo-950/80 px-4 py-1 flex justify-between items-center border-b border-indigo-500/30 backdrop-blur">
                            <span className="text-xs font-bold text-indigo-300">Raw View ({rawContextSourcePane === 'left' ? leftFileName : rightFileName}) - Line {rawContextTargetLine.lineNum}</span>
                            <button onClick={() => setRawContextOpen(false)} className="text-indigo-400 hover:text-white"><X size={14} /></button>
                        </div>
                        <LogViewerPane
                            ref={rawViewerRef}
                            workerReady={true}
                            totalMatches={rawContextSourcePane === 'left' ? leftTotalLines : rightTotalLines}
                            onScrollRequest={rawContextSourcePane === 'left' ? requestLeftRawLines : requestRightRawLines}
                            placeholderText=""
                            isRawMode={true}
                            activeLineIndex={rawContextTargetLine.lineNum - 1}
                        />
                        <div
                            className="h-1 bg-indigo-500/50 hover:bg-indigo-400 cursor-ns-resize flex items-center justify-center group"
                            onMouseDown={handleRawContextResizeStart}
                        >
                            <div className="w-12 h-1 bg-indigo-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden h-full relative group/layout">
                {/* Configuration Panel with Resize Handle */}
                <ConfigurationPanel />

                <div className="flex-1 flex flex-col overflow-hidden relative z-0">

                    {/* Render Tab Bar here (passed from parent) */}
                    {headerElement}

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex w-full h-full">
                            {/* Left Pane */}
                            <div className={`flex flex-col h-full min-w-0 transition-all relative ${isDualView ? 'w-1/2' : 'w-full'}`}>
                                <LoadingOverlay
                                    isVisible={!!leftFileName && !leftWorkerReady && leftIndexingProgress < 100}
                                    fileName={leftFileName}
                                    progress={leftIndexingProgress}
                                />
                                <LogViewerPane
                                    ref={leftViewerRef}
                                    workerReady={leftWorkerReady}
                                    totalMatches={leftFilteredCount}
                                    onScrollRequest={requestLeftLines}
                                    placeholderText={leftFileName || (isDualView ? "Drag log file here" : "Drop a log file to start")}
                                    highlights={currentConfig?.highlights}
                                    highlightCaseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                                    onLineClick={onLineClickLeft}
                                    onLineDoubleClick={onLineDoubleClickLeft}
                                    activeLineIndex={selectedLineIndexLeft}
                                    onDrop={handleLeftFileChange}
                                    onBrowse={onBrowseLeft}
                                    paneId="left"
                                    fileName={leftFileName}
                                    onReset={handleLeftReset}
                                    onCopy={onCopyLeft}
                                    onSave={onSaveLeft}
                                    bookmarks={leftBookmarks}
                                    onToggleBookmark={toggleLeftBookmark}
                                    onFocusPaneRequest={handleFocusPaneRequest}
                                    onSyncScroll={onSyncScrollLeft}
                                    onHighlightJump={onHighlightJumpLeft}
                                    onShowBookmarks={onShowBookmarksLeft}
                                />
                            </div>

                            {/* Right Pane */}
                            <div className={`flex flex-col h-full min-w-0 bg-slate-950 relative ${isDualView ? 'flex w-1/2' : 'hidden w-0'}`}>
                                <LoadingOverlay
                                    isVisible={!!rightFileName && !rightWorkerReady && rightIndexingProgress < 100}
                                    fileName={rightFileName}
                                    progress={rightIndexingProgress}
                                />
                                <div className="flex w-full h-full">
                                    <div className="w-1 bg-slate-900 hover:bg-indigo-600 transition-colors cursor-col-resize z-30 shadow-xl"></div>
                                    <div className="flex-1 h-full min-w-0">
                                        <LogViewerPane
                                            ref={rightViewerRef}
                                            workerReady={rightWorkerReady}
                                            totalMatches={rightFilteredCount}
                                            onScrollRequest={requestRightLines}
                                            placeholderText={rightFileName || "Drag log file here"}
                                            highlights={currentConfig?.highlights}
                                            highlightCaseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                                            hotkeyScope="alt"
                                            onLineClick={onLineClickRight}
                                            onLineDoubleClick={onLineDoubleClickRight}
                                            activeLineIndex={selectedLineIndexRight}
                                            onDrop={handleRightFileChange}
                                            onBrowse={onBrowseRight}
                                            paneId="right"
                                            fileName={rightFileName}
                                            onReset={handleRightReset}
                                            onCopy={onCopyRight}
                                            onSave={onSaveRight}
                                            bookmarks={rightBookmarks}
                                            onToggleBookmark={toggleRightBookmark}
                                            onFocusPaneRequest={handleFocusPaneRequest}
                                            onSyncScroll={onSyncScrollRight}
                                            onHighlightJump={onHighlightJumpRight}
                                            onShowBookmarks={onShowBookmarksRight}
                                        />
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogSession;
