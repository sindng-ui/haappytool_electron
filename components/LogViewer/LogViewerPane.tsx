import React, { useState, useMemo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as Lucide from 'lucide-react';
import { LogHighlight } from '../../types';
import { LogLine } from './LogLine';

const { Upload, X, Zap, Split, Copy, Download } = Lucide;

const ROW_HEIGHT = 24;
const OVERSCAN = 50;

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
    loadingProgress?: number;
}

export interface LogViewerHandle {
    scrollBy: (deltaY: number) => void;
    scrollByLines: (count: number) => void;
    scrollByPage: (direction: number) => void;
    scrollTo: (scrollTop: number) => void;
    jumpToNextBookmark: () => void;
    jumpToPrevBookmark: () => void;
    focus: () => void;
    getScrollTop: () => number;
}

const LogViewerPane = React.memo(forwardRef<LogViewerHandle, LogViewerPaneProps>(({
    workerReady, totalMatches, onScrollRequest, placeholderText, hotkeyScope = 'none', onSyncScroll, isRawMode = false, highlights, highlightCaseSensitive = false, activeLineIndex = -1, onLineClick, onLineDoubleClick, onDrop, onBrowse, paneId = 'single', fileName, onReset, onCopy, onSave, bookmarks = new Set(), onToggleBookmark, onFocusPaneRequest, onHighlightJump, loadingProgress
}, ref) => {
    // ... (existing code: state, hooks) ...
    const [scrollTop, setScrollTop] = useState<number>(0);
    const [viewportHeight, setViewportHeight] = useState<number>(0);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [cachedLines, setCachedLines] = useState<Map<number, { lineNum: number, content: string }>>(new Map());
    const [loadingRange, setLoadingRange] = useState<{ start: number, end: number } | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Use props for bookmarks
    const toggleBookmark = useCallback((index: number) => {
        if (onToggleBookmark) onToggleBookmark(index);
    }, [onToggleBookmark]);

    const scrollBy = useCallback((deltaY: number) => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTop += deltaY;
            setScrollTop(scrollViewportRef.current.scrollTop);
        }
    }, []);

    useImperativeHandle(ref, () => ({
        // ... (existing implementation) ...
        focus: () => containerRef.current?.focus(),
        getScrollTop: () => scrollViewportRef.current?.scrollTop || 0,
        scrollBy,
        scrollByLines: (count: number) => {
            if (scrollViewportRef.current) scrollViewportRef.current.scrollTop += count * ROW_HEIGHT;
        },
        scrollByPage: (direction: number) => {
            if (scrollViewportRef.current) {
                const pageHeight = scrollViewportRef.current.clientHeight;
                scrollViewportRef.current.scrollTop += direction * pageHeight;
            }
        },
        scrollTo: (top: number) => {
            if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = top;
        },
        jumpToNextBookmark: () => {
            // ...
            const viewportTopIdx = Math.floor((scrollViewportRef.current?.scrollTop || 0) / ROW_HEIGHT);
            const currentIdx = activeLineIndex >= 0 ? activeLineIndex : viewportTopIdx;

            const sorted: number[] = (Array.from(bookmarks) as number[]).sort((a, b) => a - b);
            const next = sorted.find((b: number) => b > currentIdx);

            const centerOffset = Math.max(0, (viewportHeight / 2) - (ROW_HEIGHT / 2));
            let target = -1;

            if (next !== undefined) {
                target = next;
            } else if (sorted.length > 0) {
                target = sorted[0]; // Wrap
            }

            if (target !== -1 && scrollViewportRef.current) {
                scrollViewportRef.current.scrollTop = Math.max(0, (target * ROW_HEIGHT) - centerOffset);
                if (onLineClick) onLineClick(target);
            }
        },
        jumpToPrevBookmark: () => {
            // ...
            const viewportTopIdx = Math.floor((scrollViewportRef.current?.scrollTop || 0) / ROW_HEIGHT);
            const currentIdx = activeLineIndex >= 0 ? activeLineIndex : viewportTopIdx;

            const sorted: number[] = (Array.from(bookmarks) as number[]).sort((a, b) => b - a); // Descending
            const prev = sorted.find((b: number) => b < currentIdx);

            const centerOffset = Math.max(0, (viewportHeight / 2) - (ROW_HEIGHT / 2));
            let target = -1;

            if (prev !== undefined) {
                target = prev;
            } else if (sorted.length > 0) {
                target = sorted[0]; // Wrap (last item since sorted descending)
            }

            if (target !== -1 && scrollViewportRef.current) {
                scrollViewportRef.current.scrollTop = Math.max(0, (target * ROW_HEIGHT) - centerOffset);
                if (onLineClick) onLineClick(target);
            }
        }
    }));

    // Virtualization Logic (unchanged)
    const { virtualItems, totalHeight, offsetY, startIndex, endIndex } = useMemo(() => {
        const totalHeight = totalMatches * ROW_HEIGHT;
        const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
        const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
        const endIndex = Math.min(totalMatches - 1, startIndex + visibleCount + (OVERSCAN * 2));

        const virtualItems = [];
        for (let i = startIndex; i <= endIndex; i++) {
            virtualItems.push(i);
        }
        const offsetY = startIndex * ROW_HEIGHT;

        return { virtualItems, totalHeight, offsetY, startIndex, endIndex };
    }, [totalMatches, scrollTop, viewportHeight]);

    // Clear cache (unchanged)
    useEffect(() => {
        setCachedLines(new Map());
    }, [totalMatches, workerReady, fileName]);

    // Pending requests tracking to prevent duplicate fetches
    const pendingIndicesRef = useRef<Set<number>>(new Set());

    // Async Data Fetching with Overscan and Debouncing prevention
    useEffect(() => {
        if (!workerReady || totalMatches === 0) return;

        // Overscan to pre-fetch data
        const OVERSCAN = 100;
        const scanStart = Math.max(0, startIndex - OVERSCAN);
        const scanEnd = Math.min(totalMatches - 1, endIndex + OVERSCAN);

        const neededIndices: number[] = [];
        for (let i = scanStart; i <= scanEnd; i++) {
            if (!cachedLines.has(i) && !pendingIndicesRef.current.has(i)) {
                neededIndices.push(i);
            }
        }

        if (neededIndices.length > 0) {
            // Find contiguous ranges to batch requests
            // Simple approach: just fetch from first to last needed, assuming mostly contiguous due to scroll
            const reqStart = neededIndices[0];
            const reqEnd = neededIndices[neededIndices.length - 1];

            // Mark as pending immediately
            for (let i = reqStart; i <= reqEnd; i++) {
                pendingIndicesRef.current.add(i);
            }

            const reqCount = reqEnd - reqStart + 1;

            onScrollRequest(reqStart, reqCount).then((lines) => {
                setCachedLines(prev => {
                    const next = new Map(prev);
                    lines.forEach((line, idx) => {
                        const lineIdx = reqStart + idx;
                        next.set(lineIdx, line);
                        pendingIndicesRef.current.delete(lineIdx);
                    });

                    // Cleanup cache if too large
                    if (next.size > 20000) {
                        for (const key of next.keys()) {
                            if ((key as number) < startIndex - 3000 || (key as number) > endIndex + 3000) {
                                next.delete(key);
                            }
                        }
                    }
                    return next;
                });

                // Cleanup pending checks for any that might have failed or weren't returned
                // (Though strictly we should trust the worker returns exactly what matches, 
                // but for safety in filtered view where gaps exist?? 
                // Wait, getLines returns contiguous block of filtered results. 
                // So lines.length should equal reqCount usually. 
                // But just in case, we clear the range from pending.)
                for (let i = reqStart; i <= reqEnd; i++) {
                    pendingIndicesRef.current.delete(i);
                }
            });
        }
    }, [startIndex, endIndex, totalMatches, workerReady, onScrollRequest, cachedLines]);

    // Resize Observer (unchanged)
    useEffect(() => {
        if (!scrollViewportRef.current) return;
        setViewportHeight(scrollViewportRef.current.clientHeight);
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) setViewportHeight(entry.contentRect.height);
        });
        observer.observe(scrollViewportRef.current);
        return () => observer.disconnect();
    }, []);

    // Recalculate (unchanged)
    useEffect(() => {
        if (!scrollViewportRef.current || !workerReady) return;
        const timer = setTimeout(() => {
            if (scrollViewportRef.current) {
                setViewportHeight(scrollViewportRef.current.clientHeight);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [workerReady, totalMatches]);


    // Drag handlers (unchanged)
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

    // Wheel event (unchanged)
    useEffect(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.shiftKey) {
                e.preventDefault();
                viewport.scrollTop += e.deltaY;
                if (onSyncScroll) onSyncScroll(e.deltaY);
            }
        };
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', handleWheel);
    }, [onSyncScroll]);

    // Key Handler (unchanged)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.code === 'Space') {
            if (activeLineIndex !== undefined && activeLineIndex >= 0) {
                e.preventDefault();
                toggleBookmark(activeLineIndex);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (onHighlightJump) onHighlightJump(index);
        }

        // Single Line Copy
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            if (activeLineIndex !== undefined && activeLineIndex >= 0) {
                const line = cachedLines.get(activeLineIndex);
                if (line) {
                    e.preventDefault();
                    const text = line.content;
                    if (window.electronAPI?.copyToClipboard) {
                        window.electronAPI.copyToClipboard(text);
                    } else if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).catch(err => {
                            console.error('Clipboard write failed:', err);
                        });
                    } else {
                        // Fallback for older browsers or insecure contexts
                        const textArea = document.createElement("textarea");
                        textArea.value = text;
                        textArea.style.position = "fixed"; // Avoid scrolling
                        textArea.style.left = "-9999px";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        try {
                            document.execCommand('copy');
                        } catch (err) {
                            console.error('Fallback copy failed:', err);
                        }
                        document.body.removeChild(textArea);
                    }
                }
            }
        }

        if (e.ctrlKey) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                scrollBy(-ROW_HEIGHT);
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                scrollBy(ROW_HEIGHT);
            }
            if (e.key === 'ArrowLeft' && onFocusPaneRequest) {
                e.preventDefault();
                const visualY = (activeLineIndex >= 0) ? (activeLineIndex * ROW_HEIGHT) - scrollTop : undefined;
                onFocusPaneRequest('left', visualY);
            }
            if (e.key === 'ArrowRight' && onFocusPaneRequest) {
                e.preventDefault();
                const visualY = (activeLineIndex >= 0) ? (activeLineIndex * ROW_HEIGHT) - scrollTop : undefined;
                onFocusPaneRequest('right', visualY);
            }
        }

        if (!e.ctrlKey) {
            if (e.code === 'ArrowDown' && onLineClick) {
                e.preventDefault();
                const nextIndex = Math.min(totalMatches - 1, activeLineIndex + 1);
                onLineClick(nextIndex);
                if (scrollViewportRef.current) {
                    const lineTop = nextIndex * ROW_HEIGHT;
                    const lineBottom = lineTop + ROW_HEIGHT;
                    const viewportTop = scrollViewportRef.current.scrollTop;
                    const viewportBottom = viewportTop + viewportHeight;
                    if (lineBottom > viewportBottom) scrollViewportRef.current.scrollTop = lineBottom - viewportHeight;
                }
            }
            if (e.code === 'ArrowUp' && onLineClick) {
                e.preventDefault();
                const prevIndex = Math.max(0, activeLineIndex - 1);
                onLineClick(prevIndex);
                if (scrollViewportRef.current) {
                    const lineTop = prevIndex * ROW_HEIGHT;
                    const viewportTop = scrollViewportRef.current.scrollTop;
                    if (lineTop < viewportTop) scrollViewportRef.current.scrollTop = lineTop;
                }
            }
            if (e.code === 'Home' && onLineClick) {
                e.preventDefault();
                onLineClick(0);
                if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = 0;
            }
            if (e.code === 'End' && onLineClick) {
                e.preventDefault();
                onLineClick(totalMatches - 1);
                if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
            }

            if ((e.code === 'PageUp' || e.code === 'PageDown') && onLineClick && scrollViewportRef.current) {
                e.preventDefault();
                e.stopPropagation();
                const direction = e.code === 'PageUp' ? -1 : 1;
                const domViewportHeight = scrollViewportRef.current.clientHeight;
                // Cap the visual step size at window height (-80px for headers) for safety
                const safeViewportHeight = Math.min(domViewportHeight, window.innerHeight - 80);
                // Reduce jump size to 0.6 of visible height for context overlap
                const scrollStep = Math.max(ROW_HEIGHT, safeViewportHeight * 0.6);
                const currentScrollTop = scrollViewportRef.current.scrollTop;

                // Maintain relative visual position of the cursor
                const currentRelY = (activeLineIndex * ROW_HEIGHT) - currentScrollTop;

                // Calculate approximate next scroll position
                let nextScrollTopEst = currentScrollTop + (direction * scrollStep);
                const maxScrollTop = Math.max(0, (totalMatches * ROW_HEIGHT) - domViewportHeight);
                nextScrollTopEst = Math.max(0, Math.min(nextScrollTopEst, maxScrollTop));

                // Calculate target index based on estimated scroll
                const nextActiveLineY = nextScrollTopEst + currentRelY;
                const nextIndex = Math.floor(nextActiveLineY / ROW_HEIGHT);
                const clampedIndex = Math.max(0, Math.min(nextIndex, totalMatches - 1));

                // CRITICAL: Adjust the scroll position so that the clampedIndex line appears at EXACTLY "currentRelY"
                // This eliminates the "drift" where the cursor seems to move up/down by partial lines due to rounding.
                const preciseScrollTop = (clampedIndex * ROW_HEIGHT) - currentRelY;

                // Clamp the final scroll top
                const finalScrollTop = Math.max(0, Math.min(preciseScrollTop, maxScrollTop));

                scrollViewportRef.current.scrollTop = finalScrollTop;
                onLineClick(clampedIndex);
            }
        }
    };


    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className={`flex-1 flex flex-col relative overflow-hidden transition-colors border-r border-slate-300 dark:border-slate-900 last:border-r-0 outline-none h-full ${dragActive ? 'bg-indigo-100 dark:bg-indigo-900/10 ring-4 ring-inset ring-indigo-500/50' : 'bg-slate-100 dark:bg-slate-950'} ${isRawMode ? 'bg-slate-200 dark:bg-slate-900' : ''}`}
            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDropEvent}
            onKeyDown={handleKeyDown}
        >
            {/* Toolbar */}
            {/* Toolbar */}
            {!isRawMode && (
                <div className={`h-12 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between shrink-0 z-10 group/toolbar ${!isRawMode && (paneId === 'left' || paneId === 'single') ? 'pl-10 pr-3' : 'px-3'} ${isRawMode ? 'bg-slate-200/50 dark:bg-indigo-950/0' : 'bg-slate-100/50 dark:bg-slate-950/50'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-1.5 rounded-md ${workerReady ? (isRawMode ? 'bg-orange-200 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' : 'bg-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400') : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-600'}`}>
                            {isRawMode ? <Split size={14} /> : <Zap size={14} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-slate-600 dark:text-slate-300 truncate max-w-[300px]">
                                {workerReady ? (isRawMode ? 'Raw View' : (placeholderText.includes('Drag') ? placeholderText : placeholderText.replace('Processing...', '').replace('Drop a log file to start', 'No file loaded'))) : (loadingProgress !== undefined && loadingProgress < 100 && fileName ? `Loading... ${Math.round(loadingProgress)}%` : 'Empty')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-50 group-hover/toolbar:opacity-100 transition-opacity">
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
                    <div
                        ref={scrollViewportRef}
                        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                        className="absolute inset-0 overflow-y-auto overflow-x-auto custom-scrollbar"
                    >
                        <div style={{ height: totalHeight, position: 'relative' }}>
                            {virtualItems.map((virtualIndex) => {
                                const top = virtualIndex * ROW_HEIGHT;
                                const data = cachedLines.get(virtualIndex);
                                const isActive = virtualIndex === activeLineIndex;

                                return (
                                    <LogLine
                                        key={virtualIndex}
                                        index={virtualIndex}
                                        style={{ top, height: ROW_HEIGHT, position: 'absolute', width: '100%' }}
                                        data={data}
                                        isActive={isActive}
                                        hasBookmark={bookmarks.has(virtualIndex)}
                                        isRawMode={isRawMode}
                                        highlights={highlights}
                                        highlightCaseSensitive={highlightCaseSensitive}
                                        onClick={(idx) => onLineClick && onLineClick(idx)}
                                        onDoubleClick={(idx) => onLineDoubleClick && onLineDoubleClick(idx)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    loadingProgress !== undefined && loadingProgress < 100 && loadingProgress >= 0 && fileName ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-sm z-50">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 -m-6 bg-indigo-500/30 rounded-full animate-pulse blur-xl"></div>
                                <div className="relative w-20 h-20">
                                    <div className="absolute inset-0 border-[3px] border-slate-700/30 rounded-full"></div>
                                    <div className="absolute inset-0 border-[3px] border-transparent border-t-cyan-400 border-r-indigo-500 rounded-full animate-spin [animation-duration:1s]"></div>
                                    <div className="absolute inset-3 border-[3px] border-slate-700/30 rounded-full"></div>
                                    <div className="absolute inset-3 border-[3px] border-transparent border-b-purple-400 border-l-pink-500 rounded-full animate-spin [animation-direction:reverse] [animation-duration:1.5s]"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Lucide.Cpu size={24} className="text-slate-400 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">Processing Log File...</h3>
                                <div className="w-64 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                                        style={{ width: `${loadingProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs font-mono text-slate-400 mt-1">{fileName ? fileName : 'Loading...'} ({Math.round(loadingProgress)}%)</p>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                            onClick={() => onBrowse && onBrowse()}
                        >
                            <div className={`p-6 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-800 mb-4 transition-transform duration-300 ${dragActive ? 'scale-110 border-indigo-500 bg-indigo-500/10' : ''}`}><Upload size={32} className={dragActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'} /></div>
                            <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{placeholderText}</p>
                        </div>
                    )
                )}
            </div>

            {/* Footer */}
            {
                workerReady && (
                    <div className="bg-slate-200 dark:bg-slate-950 border-t border-slate-300 dark:border-slate-900 px-3 py-1 text-[10px] text-slate-600 dark:text-slate-600 font-mono flex justify-between">
                        <div className="flex gap-4"><span>Matches: {totalMatches}</span></div>
                        <div className="flex gap-2 text-indigo-600 dark:text-indigo-400">{loadingRange ? 'Fetching...' : 'Ready'}</div>
                    </div>
                )
            }
        </div >
    );
}));

LogViewerPane.displayName = 'LogViewerPane';

export default LogViewerPane;
export { ROW_HEIGHT, OVERSCAN };
