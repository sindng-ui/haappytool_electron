import React, { useState, useMemo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as Lucide from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { LogHighlight } from '../../types';
import { LogLine } from './LogLine';

const { Upload, X, Zap, Split, Copy, Download, Bookmark } = Lucide;

const ROW_HEIGHT = 24;
const OVERSCAN = 120; // Reduced to 120 for better performance

interface LogViewerPaneProps {
    workerReady: boolean;
    totalMatches: number;
    onScrollRequest: (startIndex: number, count: number) => Promise<{ lineNum: number; content: string }[]>;
    placeholderText: string;
    hotkeyScope?: 'ctrl' | 'alt' | 'none';
    onSyncScroll?: (deltaY: number) => void;
    isRawMode?: boolean;
    highlights?: LogHighlight[];
    highlightCaseSensitive?: boolean;
    activeLineIndex?: number;
    onLineClick?: (index: number) => void;
    onLineDoubleClick?: (index: number) => void;
    onDrop?: (file: File) => void;
    onBrowse?: () => void;
    paneId?: 'left' | 'right' | 'single';
    fileName?: string;
    onReset?: () => void;
    onCopy?: () => void;
    onSave?: () => void;
    bookmarks?: Set<number>;
    onToggleBookmark?: (index: number) => void;
    onFocusPaneRequest?: (direction: 'left' | 'right', visualY?: number) => void;
    onHighlightJump?: (index: number) => void;
    onShowBookmarks?: () => void;
}

export interface LogViewerHandle {
    scrollBy: (deltaY: number) => void;
    scrollByLines: (count: number) => void;
    scrollByPage: (direction: number) => void;
    scrollTo: (scrollTop: number) => void;
    scrollToIndex: (index: number) => void;
    jumpToNextBookmark: () => void;
    jumpToPrevBookmark: () => void;
    focus: () => void;
    getScrollTop: () => number;
}

const LogViewerPane = React.memo(forwardRef<LogViewerHandle, LogViewerPaneProps>(({
    workerReady, totalMatches, onScrollRequest, placeholderText, hotkeyScope = 'none', onSyncScroll, isRawMode = false, highlights, highlightCaseSensitive = false, activeLineIndex = -1, onLineClick, onLineDoubleClick, onDrop, onBrowse, paneId = 'single', fileName, onReset, onCopy, onSave, bookmarks = new Set(), onToggleBookmark, onFocusPaneRequest, onHighlightJump, onShowBookmarks
}, ref) => {
    const scrollTopRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Cache for lines
    const [cachedLines, setCachedLines] = useState<Map<number, { lineNum: number, content: string }>>(new Map());
    const [dragActive, setDragActive] = useState(false);

    // Use props for bookmarks
    const toggleBookmark = useCallback((index: number) => {
        if (onToggleBookmark) onToggleBookmark(index);
    }, [onToggleBookmark]);

    const ignoreSyncRef = useRef(false);

    useImperativeHandle(ref, () => ({
        focus: () => containerRef.current?.focus(),
        getScrollTop: () => scrollTopRef.current,
        scrollBy: (deltaY: number) => {
            ignoreSyncRef.current = true;
            virtuosoRef.current?.scrollBy({ top: deltaY });
            // Safety: If scroll doesn't happen (at boundary), reset after delay
            setTimeout(() => { ignoreSyncRef.current = false; }, 100);
        },
        scrollByLines: (count: number) => {
            // User action usually triggers this internally? No, handle is for external control.
            // If this is used for sync, it should set ignoreSync.
            // But presently scrollByLines is used by LogSession for PageUp/Down sync?
            // Actually LogSession handles PageUp/Down via handleKeyDown inside LogViewerPane.
            // So this handle method might be unused or used for programmatic nav.
            // Let's safe-guard it too if it's external.
            // But wait, if Sidebar uses it, Sidebar is NOT sync source.
            // Assuming this handle is primarily used by LogSession for sync or control.
            // Current usage: LogSession calls scrollBy for sync. Use ignoreSync there.
            ignoreSyncRef.current = true;
            virtuosoRef.current?.scrollBy({ top: count * ROW_HEIGHT });
            setTimeout(() => { ignoreSyncRef.current = false; }, 100);
        },
        scrollByPage: (direction: number) => {
            // This might be user action from outside context? 
            // If LogSession calls this for sync, ignore sync back.
            ignoreSyncRef.current = true;
            const pageHeight = containerRef.current?.clientHeight || 800;
            virtuosoRef.current?.scrollBy({ top: direction * pageHeight });
            setTimeout(() => { ignoreSyncRef.current = false; }, 100);
        },
        scrollTo: (top: number) => {
            ignoreSyncRef.current = true;
            virtuosoRef.current?.scrollTo({ top });
            setTimeout(() => { ignoreSyncRef.current = false; }, 100);
        },
        scrollToIndex: (index: number) => {
            ignoreSyncRef.current = true;
            virtuosoRef.current?.scrollToIndex({ index, align: 'center' });
            setTimeout(() => { ignoreSyncRef.current = false; }, 100);
        },
        jumpToNextBookmark: () => {
            const viewportTopIdx = Math.floor(scrollTopRef.current / ROW_HEIGHT);
            const currentIdx = activeLineIndex >= 0 ? activeLineIndex : viewportTopIdx;
            const sorted: number[] = (Array.from(bookmarks) as number[]).sort((a, b) => a - b);
            const next = sorted.find((b: number) => b > currentIdx);

            let target = -1;
            if (next !== undefined) target = next;
            else if (sorted.length > 0) target = sorted[0];

            if (target !== -1) {
                // Bookmarks are user navigation, but if Shift is pressed for "Right specific jump", we don't want Sync.
                // And if Shift is not pressed (Left jump), Sync is off anyway.
                // So we should ALWAYS ignore sync for Bookmark Jump to be safe/consistent.
                ignoreSyncRef.current = true;
                setTimeout(() => { ignoreSyncRef.current = false; }, 100);
                virtuosoRef.current?.scrollToIndex({ index: target, align: 'center' });
                if (onLineClick) onLineClick(target);
            }
        },
        jumpToPrevBookmark: () => {
            const viewportTopIdx = Math.floor(scrollTopRef.current / ROW_HEIGHT);
            const currentIdx = activeLineIndex >= 0 ? activeLineIndex : viewportTopIdx;
            const sorted: number[] = (Array.from(bookmarks) as number[]).sort((a, b) => b - a);
            const prev = sorted.find((b: number) => b < currentIdx);

            let target = -1;
            if (prev !== undefined) target = prev;
            else if (sorted.length > 0) target = sorted[0];

            if (target !== -1) {
                ignoreSyncRef.current = true;
                setTimeout(() => { ignoreSyncRef.current = false; }, 100);
                virtuosoRef.current?.scrollToIndex({ index: target, align: 'center' });
                if (onLineClick) onLineClick(target);
            }
        }
    }));

    const prevScrollTopRef = useRef<number>(0);

    // Clear cache when file changes or worker restarts (e.g. new filter)
    useEffect(() => {
        const newMap = new Map<number, { lineNum: number, content: string }>();
        setCachedLines(newMap);
        cachedLinesRef.current = newMap;
        pendingIndicesRef.current.clear();
        prevScrollTopRef.current = 0;
    }, [workerReady, fileName]); // Removed totalMatches to prevent cache clear on streaming updates



    const pendingIndicesRef = useRef<Set<number>>(new Set());

    // Keep a ref for cachedLines logic
    const cachedLinesRef = useRef(cachedLines);
    // REMOVED: useEffect syncing cachedLines -> ref. We manage it manually to avoid race/loop.

    const propsRef = useRef({ workerReady, totalMatches, onScrollRequest, fileName });
    useEffect(() => {
        propsRef.current = { workerReady, totalMatches, onScrollRequest, fileName };
    }, [workerReady, totalMatches, onScrollRequest, fileName]);

    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchingRef = useRef(false);

    const loadMoreItems = useCallback((startIndex: number, endIndex: number) => {
        // Debounce requests to prevent rapid-fire updates from Virtuoso
        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }

        fetchTimeoutRef.current = setTimeout(() => {
            const { workerReady, totalMatches, onScrollRequest, fileName: reqFileName } = propsRef.current;

            // Basic Guard Clauses
            if (!workerReady || totalMatches === 0) return;
            // Prevent fetching outside bounds
            if (startIndex >= totalMatches) return;

            // Clamp endIndex
            const safeEndIndex = Math.min(endIndex, totalMatches - 1);
            if (startIndex > safeEndIndex) return;

            // Capture context
            const requestContext = { fileName: reqFileName, totalMatches };
            const neededIndices: number[] = [];
            const currentCache = cachedLinesRef.current;

            for (let i = startIndex; i <= safeEndIndex; i++) {
                if (!currentCache.has(i) && !pendingIndicesRef.current.has(i)) {
                    neededIndices.push(i);
                }
            }

            if (neededIndices.length > 0) {
                const reqStart = neededIndices[0];
                const reqEnd = neededIndices[neededIndices.length - 1];

                // console.log(`[LogViewerPane] Requesting lines ${reqStart}-${reqEnd} (count: ${neededIndices.length})`);

                // Mark as pending immediately
                for (let i = reqStart; i <= reqEnd; i++) pendingIndicesRef.current.add(i);

                const reqCount = reqEnd - reqStart + 1;

                isFetchingRef.current = true;

                onScrollRequest(reqStart, reqCount).then((lines) => {
                    isFetchingRef.current = false;
                    // console.log(`[LogViewerPane] Received ${lines.length} lines for request ${reqStart}-${reqEnd}`);

                    const currentProps = propsRef.current;
                    // Integrity Check: If filename changed, we discard data, BUT we must clearing pending!
                    if (currentProps.fileName === requestContext.fileName) {
                        // Update Ref
                        const cacheMap = cachedLinesRef.current;
                        lines.forEach((line, idx) => {
                            const lineIdx = reqStart + idx;
                            cacheMap.set(lineIdx, line);
                            pendingIndicesRef.current.delete(lineIdx);
                        });

                        // Update State safely
                        requestAnimationFrame(() => {
                            setCachedLines(new Map(cacheMap));
                        });
                    }

                    // Cleanup pending (ALWAYS run this)
                    for (let i = reqStart; i <= reqEnd; i++) pendingIndicesRef.current.delete(i);

                }).catch((e) => {
                    // console.error(`[LogViewerPane] Error fetching lines ${reqStart}-${reqEnd}`, e);
                    isFetchingRef.current = false;
                    // On error, clear pending so we can retry
                    for (let i = reqStart; i <= reqEnd; i++) pendingIndicesRef.current.delete(i);
                });
            } else {
                // console.log(`[LogViewerPane] Debounced loadMoreItems ${startIndex}-${safeEndIndex} - All cached/pending`);
            }
        }, 16); // 16ms (1 frame) debounce
    }, []);


    // Track Shift key for sync scrolling
    // Track Shift key for sync scrolling and performance optimizations
    const [isShiftDown, setIsShiftDown] = useState(false);
    const shiftPressedRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (e.key === 'Shift') {
                shiftPressedRef.current = true;
                setIsShiftDown(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                shiftPressedRef.current = false;
                setIsShiftDown(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Drag handlers
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    }, []);

    const handleDropEvent = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0] && onDrop) {
            onDrop(e.dataTransfer.files[0]);
        }
    }, [onDrop]);

    // Key Handler
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.code === 'Space') {
            if (activeLineIndex !== undefined && activeLineIndex >= 0) {
                e.preventDefault();
                toggleBookmark(activeLineIndex);
            }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            if (activeLineIndex !== undefined && activeLineIndex >= 0) {
                const line = cachedLines.get(activeLineIndex);
                if (line && window.electronAPI?.copyToClipboard) {
                    window.electronAPI.copyToClipboard(line.content);
                } else if (line) {
                    navigator.clipboard.writeText(line.content).catch(console.error);
                }
            }
        }

        if (e.ctrlKey) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                virtuosoRef.current?.scrollBy({ top: -ROW_HEIGHT });
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                virtuosoRef.current?.scrollBy({ top: ROW_HEIGHT });
            }
            if (e.key === 'ArrowLeft' && onFocusPaneRequest) {
                e.preventDefault();
                const visualY = (activeLineIndex >= 0) ? (activeLineIndex * ROW_HEIGHT) - scrollTopRef.current : undefined;
                onFocusPaneRequest('left', visualY);
            }
            if (e.key === 'ArrowRight' && onFocusPaneRequest) {
                e.preventDefault();
                const visualY = (activeLineIndex >= 0) ? (activeLineIndex * ROW_HEIGHT) - scrollTopRef.current : undefined;
                onFocusPaneRequest('right', visualY);
            }
        }

        if (!e.ctrlKey) {
            if (e.code === 'ArrowDown' && onLineClick) {
                e.preventDefault();
                const nextIndex = Math.min(totalMatches - 1, activeLineIndex + 1);
                onLineClick(nextIndex);
                virtuosoRef.current?.scrollIntoView({ index: nextIndex, behavior: 'auto' });
            }
            if (e.code === 'ArrowUp' && onLineClick) {
                e.preventDefault();
                const prevIndex = Math.max(0, activeLineIndex - 1);
                onLineClick(prevIndex);
                virtuosoRef.current?.scrollIntoView({ index: prevIndex, behavior: 'auto' });
            }
            if (e.code === 'Home' && onLineClick) {
                e.preventDefault();
                onLineClick(0);
                virtuosoRef.current?.scrollToIndex({ index: 0 });
            }
            if (e.code === 'End' && onLineClick) {
                e.preventDefault();
                onLineClick(totalMatches - 1);
                virtuosoRef.current?.scrollToIndex({ index: totalMatches - 1 });
            }
            if ((e.code === 'PageUp' || e.code === 'PageDown') && onLineClick) {
                e.preventDefault();
                const direction = e.code === 'PageUp' ? -1 : 1;
                const pageHeight = containerRef.current?.clientHeight || 800;
                virtuosoRef.current?.scrollBy({ top: direction * pageHeight * 0.8 });
                // We don't change selection line on generic PageUp/Down usually, unless requested?
                // Original logic did complex calculation to move cursor.
                // For now let's just scroll. User requested improved PageUp previously.
                // Re-implementing "Move Cursor with PageUp":
                const linesPerPage = Math.floor(pageHeight / ROW_HEIGHT);
                const nextIndex = Math.max(0, Math.min(totalMatches - 1, activeLineIndex + (direction * linesPerPage)));
                onLineClick(nextIndex);
                virtuosoRef.current?.scrollToIndex({ index: nextIndex, align: 'center' });
            }
        }
    };




    // Memoized itemContent to prevent Virtuoso thrashing
    const itemContent = useCallback((index: number) => {
        // Use Ref for data access to keep callback stable across data updates
        // But we depend on cachedLines state to force re-render when data arrives!
        const data = cachedLinesRef.current.get(index);
        const isActive = index === activeLineIndex;
        // Bookmarks and other props still need to match, but they update less frequently than data
        return (
            <LogLine
                index={index}
                style={{ height: ROW_HEIGHT, width: '100%' }}
                data={data}
                isActive={isActive}
                hasBookmark={bookmarks.has(index)}
                isRawMode={isRawMode}
                highlights={highlights}
                highlightCaseSensitive={highlightCaseSensitive}
                onClick={(idx) => onLineClick && onLineClick(idx)}
                onDoubleClick={(idx) => onLineDoubleClick && onLineDoubleClick(idx)}
            />
        );
    }, [activeLineIndex, bookmarks, isRawMode, highlights, highlightCaseSensitive, onLineClick, onLineDoubleClick, cachedLines]); // Added cachedLines to force update

    // Non-passive wheel listener to allow preventDefault for Shift+Scroll
    useEffect(() => {
        if (!isShiftDown) return;
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            // Update shift state
            if (e.shiftKey !== shiftPressedRef.current) {
                shiftPressedRef.current = e.shiftKey;
            }

            if (e.shiftKey) {
                e.preventDefault();

                // Determine delta
                let delta = e.deltaY;
                if (delta === 0 && e.deltaX !== 0) {
                    delta = e.deltaX; // Horizontal remapping
                }

                if (delta !== 0) {
                    virtuosoRef.current?.scrollBy({ top: delta });
                }
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [isShiftDown]);

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className={`flex-1 flex flex-col relative overflow-hidden transition-colors border-r border-slate-300 dark:border-slate-900 last:border-r-0 outline-none h-full ${dragActive ? 'bg-indigo-100 dark:bg-indigo-900/10 ring-4 ring-inset ring-indigo-500/50' : 'bg-slate-100 dark:bg-slate-950'} ${isRawMode ? 'bg-slate-200 dark:bg-slate-900' : ''}`}
            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDropEvent}
            onKeyDown={handleKeyDown}
        >
            {/* Toolbar */}
            {!isRawMode && (
                <div className={`h-12 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between shrink-0 z-10 group/toolbar ${!isRawMode && (paneId === 'left' || paneId === 'single') ? 'pl-10 pr-3' : 'px-3'} ${isRawMode ? 'bg-slate-200/50 dark:bg-indigo-950/0' : 'bg-slate-100/50 dark:bg-slate-950/50'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-1.5 rounded-md ${workerReady ? (isRawMode ? 'bg-orange-200 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' : 'bg-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400') : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-600'}`}>
                            {isRawMode ? <Split size={14} /> : <Zap size={14} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-slate-600 dark:text-slate-300 truncate max-w-[300px]">
                                {workerReady ? (isRawMode ? 'Raw View' : (placeholderText.includes('Drag') ? placeholderText : placeholderText.replace('Processing...', '').replace('Drop a log file to start', 'No file loaded'))) : (fileName ? 'Processing...' : 'Empty')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-50 group-hover/toolbar:opacity-100 transition-opacity">
                        {workerReady && !isRawMode && onShowBookmarks && (
                            <button onClick={onShowBookmarks} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 hover:text-yellow-600 dark:hover:text-yellow-500 transition-colors" title="View Bookmarks">
                                <Bookmark size={12} fill={bookmarks.size > 0 ? "currentColor" : "none"} />
                            </button>
                        )}
                        {workerReady && !isRawMode && onCopy && (
                            <button onClick={onCopy} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Copy Filtered Logs">
                                <Copy size={12} />
                            </button>
                        )}
                        {workerReady && !isRawMode && onSave && (
                            <button onClick={onSave} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Save Filtered Logs">
                                <Download size={12} />
                            </button>
                        )}

                        {fileName && onReset && !isRawMode && (
                            <button onClick={onReset} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Reset File">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 relative overflow-hidden">
                {workerReady ? (
                    <Virtuoso
                        ref={virtuosoRef}
                        totalCount={totalMatches}
                        overscan={OVERSCAN * ROW_HEIGHT}
                        itemContent={itemContent}
                        rangeChanged={({ startIndex, endIndex }) => {
                            loadMoreItems(startIndex, endIndex);
                        }}
                        onScroll={(e) => {
                            const top = (e.currentTarget as HTMLElement).scrollTop;
                            // const delta = top - prevScrollTopRef.current;
                            prevScrollTopRef.current = top;
                            scrollTopRef.current = top;

                            if (ignoreSyncRef.current) {
                                ignoreSyncRef.current = false;
                                return;
                            }

                            // Pass absolute position for robust sync, ONLY if Shift is pressed
                            if (onSyncScroll && shiftPressedRef.current) onSyncScroll(top);
                        }}
                        style={{ height: '100%' }}
                        className="custom-scrollbar"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        {fileName ? (
                            <div className="flex flex-col items-center gap-2">
                                <Lucide.Loader2 className="animate-spin" />
                                <span className="text-xs">Processing log...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 opacity-50 cursor-pointer hover:opacity-100 transition-opacity" onClick={onBrowse}>
                                <Upload size={24} />
                                <span className="text-xs">{placeholderText}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            {
                workerReady && (
                    <div className="bg-slate-200 dark:bg-slate-950 border-t border-slate-300 dark:border-slate-900 px-3 py-1 text-[10px] text-slate-600 dark:text-slate-600 font-mono flex justify-between">
                        <div className="flex gap-4"><span>Matches: {totalMatches}</span></div>
                        <div className="flex gap-2 text-indigo-600 dark:text-indigo-400">Ready</div>
                    </div>
                )
            }
        </div >
    );
}));

LogViewerPane.displayName = 'LogViewerPane';

export default LogViewerPane;
export { ROW_HEIGHT, OVERSCAN };


