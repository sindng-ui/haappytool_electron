import React from 'react';
import * as Lucide from 'lucide-react';
import LogViewerPane, { ROW_HEIGHT } from './LogViewer/LogViewerPane';
import ConfigurationPanel from './LogViewer/ConfigurationPanel';
import TizenConnectionModal from './TizenConnectionModal';
import { useLogContext } from './LogViewer/LogContext';
import TopBar from './LogViewer/TopBar';
import Toast from './ui/Toast';

const { X } = Lucide;

interface LogSessionProps {
    isActive: boolean;
    onTitleChange?: (title: string) => void;
    headerElement?: React.ReactNode;
}

const LogSession: React.FC<LogSessionProps> = ({ isActive, onTitleChange, headerElement }) => {
    const leftFileInputRef = React.useRef<HTMLInputElement>(null);
    const rightFileInputRef = React.useRef<HTMLInputElement>(null);

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
        jumpToHighlight,
        tizenSocket, sendTizenCommand,
        toast, closeToast
    } = useLogContext();

    // Update Tab Title based on file name
    React.useEffect(() => {
        if (onTitleChange) {
            // Always use left filename as main title, ignoring split view state
            onTitleChange(leftFileName || 'New Log');
        }
    }, [leftFileName, onTitleChange]);

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

    const handleSyncScroll = React.useCallback((deltaY: number, source: 'left' | 'right') => {
        if (!isDualView) return;
        const targetRef = source === 'left' ? rightViewerRef : leftViewerRef;
        if (targetRef.current) {
            targetRef.current.scrollBy(deltaY);
        }
    }, [isDualView]);

    return (
        <div className="flex h-full flex-col font-sans overflow-hidden" style={{ display: isActive ? 'flex' : 'none' }}>

            <TopBar />

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
                            <div className={`flex flex-col h-full min-w-0 transition-all ${isDualView ? 'w-1/2' : 'w-full'}`}>
                                <LogViewerPane
                                    key={leftFileName || 'left-empty'}
                                    ref={leftViewerRef}
                                    workerReady={leftWorkerReady}
                                    loadingProgress={leftIndexingProgress}
                                    totalMatches={leftFilteredCount}
                                    onScrollRequest={requestLeftLines}
                                    placeholderText={leftFileName || (isDualView ? "Drag log file here" : "Drop a log file to start")}
                                    highlights={currentConfig?.highlights}
                                    highlightCaseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                                    onLineClick={(index) => setSelectedLineIndexLeft(index)}
                                    onLineDoubleClick={(index) => handleLineDoubleClickAction(index, 'left')}
                                    activeLineIndex={selectedLineIndexLeft}
                                    onDrop={handleLeftFileChange}
                                    onBrowse={() => leftFileInputRef.current?.click()}
                                    paneId="left"
                                    fileName={leftFileName}
                                    onReset={handleLeftReset}
                                    onCopy={() => handleCopyLogs('left')}
                                    onSave={() => handleSaveLogs('left')}
                                    bookmarks={leftBookmarks}
                                    onToggleBookmark={toggleLeftBookmark}
                                    onFocusPaneRequest={handleFocusPaneRequest}
                                    onSyncScroll={(dy) => handleSyncScroll(dy, 'left')}
                                    onHighlightJump={(idx) => jumpToHighlight(idx, 'left')}
                                />
                            </div>

                            {/* Right Pane */}
                            <div className={`flex flex-col h-full min-w-0 bg-slate-950 ${isDualView ? 'flex w-1/2' : 'hidden w-0'}`}>
                                <div className="flex w-full h-full">
                                    <div className="w-1 bg-slate-900 hover:bg-indigo-600 transition-colors cursor-col-resize z-30 shadow-xl"></div>
                                    <div className="flex-1 h-full min-w-0">
                                        <LogViewerPane
                                            key={rightFileName || 'right-empty'}
                                            ref={rightViewerRef}
                                            workerReady={rightWorkerReady}
                                            loadingProgress={rightIndexingProgress}
                                            totalMatches={rightFilteredCount}
                                            onScrollRequest={requestRightLines}
                                            placeholderText={rightFileName || "Drag log file here"}
                                            highlights={currentConfig?.highlights}
                                            highlightCaseSensitive={currentConfig?.colorHighlightsCaseSensitive}
                                            hotkeyScope="alt"
                                            onLineClick={(index) => setSelectedLineIndexRight(index)}
                                            onLineDoubleClick={(index) => handleLineDoubleClickAction(index, 'right')}
                                            activeLineIndex={selectedLineIndexRight}
                                            onDrop={handleRightFileChange}
                                            onBrowse={() => rightFileInputRef.current?.click()}
                                            paneId="right"
                                            fileName={rightFileName}
                                            onReset={handleRightReset}
                                            onCopy={() => handleCopyLogs('right')}
                                            onSave={() => handleSaveLogs('right')}
                                            bookmarks={rightBookmarks}
                                            onToggleBookmark={toggleRightBookmark}
                                            onFocusPaneRequest={handleFocusPaneRequest}
                                            onSyncScroll={(dy) => handleSyncScroll(dy, 'right')}
                                            onHighlightJump={(idx) => jumpToHighlight(idx, 'right')}
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
