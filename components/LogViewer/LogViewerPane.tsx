import React, { useState, useMemo, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as Lucide from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { LogHighlight, LogViewPreferences } from '../../types';
import { LogLine } from './LogLine';

const { Upload, X, Zap, Split, Copy, Download, Bookmark, ArrowDown } = Lucide;

// ✅ ElectronAPI types moved to vite-env.d.ts for consistency

// Default fallback if preferences are missing
const DEFAULT_ROW_HEIGHT = 24;
const OVERSCAN_COUNT = 120; // Default overscan
const OVERSCAN_COUNT_LOW = 50; // ✅ Performance: Reduced overscan for real-time streaming

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
    selectedIndices?: Set<number>;
    onLineClick?: (index: number, isShift?: boolean, isCtrl?: boolean) => void;
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
    absoluteOffset?: number; // Global index offset for this segment
    initialScrollIndex?: number;
    onPageNavRequest?: (direction: 'next' | 'prev') => void;
    onScrollToBottomRequest?: () => void;
    preferences?: LogViewPreferences;
}

export interface LogViewerHandle {
    scrollBy: (deltaY: number) => void;
    scrollByLines: (count: number) => void;
    scrollByPage: (direction: number) => void;
    scrollTo: (scrollTop: number) => void;
    scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' }) => void;
    jumpToNextBookmark: () => void;
    jumpToPrevBookmark: () => void;
    focus: () => void;
    getScrollTop: () => number;
    isAtTop: () => boolean;
    isAtBottom: () => boolean;
}

const LogViewerPane = React.memo(forwardRef<LogViewerHandle, LogViewerPaneProps>(({
    workerReady,
    totalMatches,
    onScrollRequest,
    placeholderText,
    hotkeyScope = 'none',
    onSyncScroll,
    isRawMode = false,
    highlights,
    highlightCaseSensitive = false,
    activeLineIndex = -1,
    selectedIndices,
    onLineClick,
    onLineDoubleClick,
    onDrop,
    onBrowse,
    paneId = 'single',
    fileName,
    onReset,
    onCopy,
    onSave,
    bookmarks = new Set(),
    onToggleBookmark,
    onFocusPaneRequest,
    onHighlightJump,
    onShowBookmarks,
    onPageNavRequest,
    onScrollToBottomRequest,
    absoluteOffset = 0,
    initialScrollIndex,
    preferences
}, ref) => {
    const rowHeight = preferences?.rowHeight || DEFAULT_ROW_HEIGHT;

    const scrollTopRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Pre-compile Regex for Level Styles to improve scrolling performance
    const levelMatchers = useMemo(() => {
        if (!preferences?.levelStyles) return [];
        return preferences.levelStyles
            .filter(style => style.enabled)
            .map(style => ({
                regex: new RegExp(`(^|\\s|/)${style.level}(/|\\s|:)`),
                color: style.color
            }));
    }, [preferences?.levelStyles]);

    // Auto-scroll (Sticky Bottom) State
    const [atBottom, setAtBottom] = useState(false);

    // ✅ Performance: Dynamic overscan based on scroll state
    // When streaming at bottom, reduce overscan to save rendering cost
    const dynamicOverscan = useMemo(() => {
        // If at bottom (likely streaming), use lower overscan
        return atBottom ? OVERSCAN_COUNT_LOW : OVERSCAN_COUNT;
    }, [atBottom]);

    // Drag Selection State
    const isDraggingSelection = useRef(false);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            isDraggingSelection.current = false;
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    const handleLineMouseDown = useCallback((index: number, e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        isDraggingSelection.current = true;

        // Trigger selection immediately on down
        // Ensure we pass correct modifiers. 
        // If user drags without shift, we treat it as starting a NEW selection (unless Ctrl is held).
        // Then dragging extends it (like Shift).
        onLineClick && onLineClick(index, e.shiftKey, (e.ctrlKey || e.metaKey));
    }, [onLineClick]);

    const handleLineMouseEnter = useCallback((index: number, e: React.MouseEvent) => {
        if (isDraggingSelection.current && onLineClick) {
            // Dragging always implies range selection (Shift=true) from the active anchor
            // We preserve Ctrl state to allow adding ranges (if logic supports it, though usually standard drag replaces or extends)
            // For now, let's assume dragging is extending the current "active" anchor.
            onLineClick(index, true, (e.ctrlKey || e.metaKey));
        }
    }, [onLineClick]);
    const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
    const showScrollToBottom = (!atBottom || isAutoScrollPaused) && totalMatches > 0;

    // Cache for lines
    const [cachedLines, setCachedLines] = useState<Map<number, { lineNum: number, content: string }>>(new Map());
    const [dragActive, setDragActive] = useState(false);

    // Use props for bookmarks
    const toggleBookmark = useCallback((index: number) => {
        if (onToggleBookmark) onToggleBookmark(index);
    }, [onToggleBookmark]);

    const ignoreSyncRef = useRef(false);

    // Force scroll to initial index if provided - fixes race conditions where data loads after mount
    useEffect(() => {
        if (initialScrollIndex !== undefined && totalMatches > 0 && virtuosoRef.current) {
            // Use a timeout to ensure Virtualizer is ready and layout is stable
            requestAnimationFrame(() => {
                virtuosoRef.current?.scrollToIndex({ index: initialScrollIndex, align: 'center' });
            });
        }
    }, [initialScrollIndex, totalMatches]);

    useImperativeHandle(ref, () => ({
        focus: () => {
            // Prevent scrolling when focusing
            containerRef.current?.focus({ preventScroll: true });
        },
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
            virtuosoRef.current?.scrollBy({ top: count * rowHeight });
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
        scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' }) => {
            ignoreSyncRef.current = true;
            virtuosoRef.current?.scrollToIndex({ index, align: options?.align || 'center' });
            setTimeout(() => { ignoreSyncRef.current = false; }, 100);
        },
        jumpToNextBookmark: () => {
            const viewportTopIdx = Math.floor(scrollTopRef.current / rowHeight);
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
            const viewportTopIdx = Math.floor(scrollTopRef.current / rowHeight);

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
        },
        isAtTop: () => scrollTopRef.current === 0,
        isAtBottom: () => atBottom
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
            if (onCopy) {
                e.preventDefault(); // Prevent default only if we handle it
                onCopy();
                return;
            }
            // Fallback for when onCopy is not provided (shouldn't happen in main app but good for component isolation)
            if (activeLineIndex !== undefined && activeLineIndex >= 0) {
                const line = cachedLines.get(activeLineIndex);
                if (line && window.electronAPI?.copyToClipboard) {
                    window.electronAPI.copyToClipboard(line.content);
                } else if (line) {
                    navigator.clipboard.writeText(line.content).catch(console.error);
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
            if (onShowBookmarks) {
                e.preventDefault();
                onShowBookmarks();
            }
        }

        if (e.ctrlKey) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                virtuosoRef.current?.scrollBy({ top: -rowHeight });
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                virtuosoRef.current?.scrollBy({ top: rowHeight });
            }
            if (e.key === 'ArrowLeft' && onFocusPaneRequest) {
                e.preventDefault();
                const relativeActive = activeLineIndex - absoluteOffset;
                const visualY = (relativeActive >= 0) ? (relativeActive * rowHeight) - scrollTopRef.current : undefined;
                onFocusPaneRequest('left', visualY);
            }
            if (e.key === 'ArrowRight' && onFocusPaneRequest) {
                e.preventDefault();
                const relativeActive = activeLineIndex - absoluteOffset;
                const visualY = (relativeActive >= 0) ? (relativeActive * rowHeight) - scrollTopRef.current : undefined;
                onFocusPaneRequest('right', visualY);
            }
        }

        if (!e.ctrlKey) {
            // Auto-scroll Toggle
            if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                setIsAutoScrollPaused(prev => {
                    const newState = !prev;
                    // If resuming (pausing -> unpaused), jump to bottom immediately
                    if (!newState) {
                        virtuosoRef.current?.scrollToIndex({ index: totalMatches - 1, align: 'end', behavior: 'auto' });
                    }
                    return newState;
                });
                return;
            }

            const relativeActive = activeLineIndex - absoluteOffset;
            const isFocusedOnPage = relativeActive >= 0 && relativeActive < totalMatches;

            if (e.code === 'ArrowDown' && onLineClick) {
                e.preventDefault();
                const nextRel = isFocusedOnPage ? Math.min(totalMatches - 1, relativeActive + 1) : 0;
                onLineClick(nextRel + absoluteOffset);
                virtuosoRef.current?.scrollIntoView({ index: nextRel, behavior: 'auto' });
            }
            if (e.code === 'ArrowUp' && onLineClick) {
                e.preventDefault();
                const prevRel = isFocusedOnPage ? Math.max(0, relativeActive - 1) : 0;
                onLineClick(prevRel + absoluteOffset);
                virtuosoRef.current?.scrollIntoView({ index: prevRel, behavior: 'auto' });
            }
            if (e.code === 'Home' && onLineClick) {
                e.preventDefault();
                onLineClick(0 + absoluteOffset);
                virtuosoRef.current?.scrollToIndex({ index: 0 });
            }
            if (e.code === 'End' && onLineClick) {
                e.preventDefault();
                const lastRel = totalMatches - 1;
                onLineClick(lastRel + absoluteOffset);
                virtuosoRef.current?.scrollToIndex({ index: lastRel });
            }
            if ((e.code === 'PageUp' || e.code === 'PageDown') && onLineClick) {
                e.preventDefault();
                const direction = e.code === 'PageUp' ? -1 : 1;
                const pageHeight = containerRef.current?.clientHeight || 800;
                const linesPerPage = Math.floor(pageHeight / rowHeight);

                let targetRel = 0;
                if (isFocusedOnPage) {
                    targetRel = Math.max(0, Math.min(totalMatches - 1, relativeActive + (direction * linesPerPage)));
                } else {
                    targetRel = direction === 1 ? Math.min(totalMatches - 1, linesPerPage) : 0;
                }

                onLineClick(targetRel + absoluteOffset);
                virtuosoRef.current?.scrollToIndex({ index: targetRel, align: 'center' });
            }
        }
    };




    // Memoize split highlights to prevent LogLine/HighlightRenderer re-renders/regex-rebuilds
    const { textHighlights, lineHighlights } = useMemo(() => {
        if (!highlights) return { textHighlights: [], lineHighlights: [] };
        return {
            textHighlights: highlights.filter(h => !h.lineEffect),
            lineHighlights: highlights.filter(h => h.lineEffect)
        };
    }, [highlights]);

    const itemContent = useCallback((index: number, _data: unknown, context: { preferences?: LogViewPreferences }) => {
        // Use Ref for data access to keep callback stable across data updates
        // But we depend on cachedLines state to force re-render when data arrives!
        const data = cachedLinesRef.current.get(index);
        const globalIndex = index + absoluteOffset;
        const isActive = globalIndex === activeLineIndex;
        const isSelected = selectedIndices ? selectedIndices.has(globalIndex) : isActive;

        // Use preferences from context if available (standard Virtuoso pattern for external data)
        const effectivePreferences = context?.preferences || preferences;

        return (
            <LogLine
                index={index}
                style={{ height: rowHeight, width: '100%' }}
                data={data}
                isActive={isActive}
                isSelected={isSelected}
                hasBookmark={bookmarks.has(globalIndex)}
                isRawMode={isRawMode}
                textHighlights={textHighlights}
                lineHighlights={lineHighlights}
                highlightCaseSensitive={highlightCaseSensitive}
                onMouseDown={(idx, e) => handleLineMouseDown(globalIndex, e)}
                onMouseEnter={(idx, e) => handleLineMouseEnter(globalIndex, e)}
                onClick={undefined}
                onDoubleClick={() => onLineDoubleClick && onLineDoubleClick(globalIndex)}
                preferences={effectivePreferences}
                levelMatchers={levelMatchers}
            />
        );
    }, [activeLineIndex, bookmarks, isRawMode, textHighlights, lineHighlights, highlightCaseSensitive, onLineDoubleClick, absoluteOffset, selectedIndices, handleLineMouseDown, handleLineMouseEnter, preferences, rowHeight, levelMatchers]); // ✅ Removed cachedLines (already using Ref)

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

    // Handle Initial Scroll Request safely (Robust Fallback)
    useEffect(() => {
        if (workerReady && initialScrollIndex !== undefined && totalMatches > 0) {
            const relative = initialScrollIndex - absoluteOffset;
            if (relative >= 0 && relative < totalMatches) {
                // Use double-raf or raf+timeout to guarantee Virtuoso is ready
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        const target = Math.max(0, relative - 5);
                        // console.log('[LogViewerPane] Executing initial scroll to:', target);
                        virtuosoRef.current?.scrollToIndex({ index: target, align: 'start' });
                    }, 100); // 100ms delay for safety in production
                });
            }
        }
    }, [workerReady, initialScrollIndex, absoluteOffset, totalMatches]);

    // Auto-scroll State
    // We rely on Virtuoso's 'followOutput' and 'atBottomStateChange' for "Smart" auto-scrolling
    // When the user is at the bottom, followOutput="auto" keeps them there.
    // When they scroll up, 'atBottom' becomes false, and followOutput turns off.

    const scrollerRef = useRef<HTMLElement | null>(null);

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-300 outline-none h-full 
                ${dragActive
                    ? 'bg-indigo-500/10 ring-4 ring-inset ring-indigo-500/50'
                    : isRawMode
                        ? 'bg-slate-100 dark:bg-slate-900'
                        : 'bg-white dark:bg-slate-950'
                }
                border-r border-slate-200 dark:border-white/5 last:border-r-0
            `}
            // REMOVED: style={{ overflowAnchor: 'none' }} - We want native anchoring behavior!
            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDropEvent}
            onKeyDown={handleKeyDown}
        >
            {/* Toolbar */}
            {!isRawMode && (
                <div className={`h-11 border-b border-slate-200 dark:border-white/5 flex items-center justify-between shrink-0 z-20 group/toolbar px-3 
                    ${isRawMode ? 'bg-transparent' : 'bg-white/50 dark:bg-slate-950/50'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-1.5 rounded-lg shadow-sm transition-all duration-300 ${workerReady ? (isRawMode ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 icon-glow') : 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500'}`}>
                            {isRawMode ? <Split size={14} /> : <Zap size={14} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate max-w-[300px] tracking-tight">
                                {workerReady ? (isRawMode ? 'Raw View' : (placeholderText.includes('Drag') ? placeholderText : placeholderText.replace('Processing...', '').replace('Drop a log file to start', 'No file loaded'))) : (fileName ? 'Processing...' : 'Empty')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 transition-opacity duration-200">
                        {workerReady && !isRawMode && onShowBookmarks && (
                            <button onClick={onShowBookmarks} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors" title="View Bookmarks">
                                <Bookmark size={14} fill={bookmarks.size > 0 ? "currentColor" : "none"} />
                            </button>
                        )}
                        {workerReady && !isRawMode && onCopy && (
                            <button onClick={onCopy} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" title="Copy Filtered Logs">
                                <Copy size={14} />
                            </button>
                        )}
                        {workerReady && !isRawMode && onSave && (
                            <button onClick={onSave} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors" title="Save Filtered Logs">
                                <Download size={14} />
                            </button>
                        )}

                        {fileName && onReset && !isRawMode && (
                            <button onClick={onReset} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Reset File">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div
                className="flex-1 relative overflow-hidden"
            // Keydown handling moved to LogSession for global scope
            >
                {workerReady ? (
                    <>
                        <Virtuoso
                            ref={virtuosoRef}
                            scrollerRef={(ref) => {
                                if (ref instanceof HTMLElement) {
                                    scrollerRef.current = ref;
                                    // NO overflowAnchor manipulation here either! Leave it 'auto'.
                                }
                            }}
                            totalCount={totalMatches || 0}
                            overscan={dynamicOverscan * rowHeight} // ✅ Dynamic overscan (50 when streaming, 120 when scrolling)
                            {...(initialScrollIndex !== undefined ? { initialTopMostItemIndex: { index: initialScrollIndex, align: 'center' } } : {})}
                            itemContent={itemContent}


                            // SMART AUTO SCROLL CONFIGURATION
                            atBottomThreshold={50} // 50px tolerance for "stickiness"
                            // If user is at bottom, followOutput="auto" (stick)
                            // If user scrolls up, followOutput=false (stop sticking)
                            // Disable auto-scroll in Raw Mode to prevent jumping
                            followOutput={(!isRawMode && atBottom && !isAutoScrollPaused) ? 'auto' : false}

                            atBottomStateChange={(isAtBottom) => {
                                // Virtuoso tells us when user enters/leaves bottom zone
                                setAtBottom(isAtBottom);
                            }}

                            rangeChanged={({ startIndex, endIndex }) => {
                                loadMoreItems(startIndex, endIndex);
                            }}
                            onScroll={(e) => {
                                const top = (e.currentTarget as HTMLElement).scrollTop;
                                scrollTopRef.current = top;

                                // Helper specifically for Sync Scrolling feature
                                if (onSyncScroll && shiftPressedRef.current) {
                                    if (ignoreSyncRef.current) {
                                        ignoreSyncRef.current = false;
                                        return;
                                    }
                                    onSyncScroll(top);
                                }
                            }}
                            style={{ height: '100%' }}
                            className="custom-scrollbar"
                            context={{ preferences }}
                            key={preferences?.fontFamily || 'virtuoso-list'}
                        />
                        {showScrollToBottom && (
                            <button
                                className="absolute bottom-6 right-8 z-40 p-3 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-500 transition-all animate-in fade-in zoom-in duration-200 hover:scale-110 border border-white/10"
                                onClick={() => {
                                    if (onScrollToBottomRequest) {
                                        onScrollToBottomRequest();
                                    } else {
                                        setIsAutoScrollPaused(false); // Enable auto-scroll (stick)
                                        virtuosoRef.current?.scrollToIndex({ index: totalMatches - 1, align: 'end', behavior: 'auto' });
                                    }
                                }}
                                title="Scroll to Bottom"
                            >
                                <ArrowDown size={20} />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none">
                        {fileName ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse"></div>
                                    <Lucide.Loader2 className="animate-spin text-indigo-400 relative z-10" size={32} />
                                </div>
                                <span className="text-xs font-medium text-indigo-300 animate-pulse">Processing log...</span>
                            </div>
                        ) : (
                            <div
                                className="group flex flex-col items-center gap-4 p-12 rounded-3xl border-2 border-dashed border-slate-700/50 bg-slate-900/20 transition-all duration-300 hover:bg-slate-800/40 hover:border-indigo-500/50 hover:scale-[1.02] cursor-pointer pointer-events-auto"
                                onClick={onBrowse}
                            >
                                <div className="p-4 rounded-2xl bg-slate-800/50 group-hover:bg-indigo-500/20 transition-colors shadow-xl">
                                    <Upload size={32} className="text-slate-500 group-hover:text-indigo-400 transition-colors icon-glow" />
                                </div>
                                <div className="text-center space-y-1">
                                    <span className="text-sm font-bold text-slate-300 group-hover:text-indigo-200 transition-colors block">
                                        Drop a log file here
                                    </span>
                                    <span className="text-xs text-slate-500 group-hover:text-indigo-400/70 transition-colors block">
                                        or click to browse
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            {
                workerReady && (
                    <div className="h-7 border-t border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-950 px-3 flex items-center justify-between text-[10px] text-slate-500 font-medium select-none">
                        <div className="flex gap-4"><span>Matches: <span className="text-slate-700 dark:text-slate-300">{totalMatches.toLocaleString()}</span></span></div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-slate-600 dark:text-slate-400">Ready</span>
                        </div>
                    </div>
                )
            }
        </div >
    );
}));

LogViewerPane.displayName = 'LogViewerPane';

export default LogViewerPane;
export { OVERSCAN_COUNT };


