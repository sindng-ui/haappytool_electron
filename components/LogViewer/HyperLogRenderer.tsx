import React, { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { LogHighlight, LogViewPreferences } from '../../types';

interface HyperLogRendererProps {
    totalCount: number;
    rowHeight: number;
    onScrollRequest: (startIndex: number, count: number) => Promise<{ lineNum: number; content: string }[]>;
    preferences?: LogViewPreferences;
    activeLineIndex?: number;
    selectedIndices?: Set<number>;
    bookmarks?: Set<number>;
    textHighlights?: LogHighlight[];
    lineHighlights?: LogHighlight[];
    lineHighlightRanges?: { start: number; end: number; color: string }[];
    highlightCaseSensitive?: boolean;
    levelMatchers?: { regex: RegExp; color: string }[];
    onLineClick?: (index: number, isShift?: boolean, isCtrl?: boolean) => void;
    onLineDoubleClick?: (index: number) => void;
    onAtBottomChange?: (isAtBottom: boolean) => void;
    onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
    absoluteOffset?: number;
    isRawMode?: boolean;
    performanceHeatmap?: number[];
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

interface CachedLine {
    lineNum: number;
    content: string;
    decodedContent: string;
    levelColor?: string; // Pre-calculated for speed
}

export interface HyperLogHandle {
    scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' }) => void;
    scrollBy: (options: { top: number }) => void;
    scrollTo: (options: { top: number }) => void;
    getScrollTop: () => number;
    focus: () => void;
}

// --- 🌟 Layout Constants ---
const GUTTER_STAR_WIDTH = 24;
const GUTTER_INDEX_WIDTH = 65; // Wide enough for #1,234,567
const GUTTER_LINENUM_WIDTH = 60; // Wide enough for 1,234,567
const GUTTER_TOTAL_WIDTH = GUTTER_STAR_WIDTH + GUTTER_INDEX_WIDTH + GUTTER_LINENUM_WIDTH;
const CONTENT_X_OFFSET = GUTTER_TOTAL_WIDTH + 8; // Total ~157px

// Helper to map tailwind bg classes to canvas colors
const mapColor = (color: string, opacity = 0.3) => {
    if (color.startsWith('#')) return color;
    if (color.startsWith('rgba')) return color;

    const palette: Record<string, string> = {
        'yellow-200': `rgba(254, 240, 138, ${opacity})`,
        'yellow-400': `rgba(250, 204, 21, ${opacity})`,
        'indigo-200': `rgba(199, 210, 254, ${opacity})`,
        'indigo-500': `rgba(99, 102, 241, ${opacity})`,
        'red-200': `rgba(FECACA, ${opacity})`,
        'red-500': `rgba(EF4444, ${opacity})`,
        'green-200': `rgba(BBF7D0, ${opacity})`,
        'blue-200': `rgba(BFDBFE, ${opacity})`,
        'slate-200': `rgba(E2E8F0, ${opacity})`,
        'orange-200': `rgba(FED7AA, ${opacity})`,
    };

    const clean = color.replace('bg-', '');
    return palette[clean] || `rgba(251, 191, 36, ${opacity})`;
};

// 형님, HTML 엔터티를 디코딩해야 폰트 너비 계산 시 오차가 생기지 않습니다.
const decodeHTMLEntities = (text: string) => {
    if (!text) return '';
    return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/\t/g, '    '); // 👈 탭 문자를 공백으로 치환하여 Canvas/DOM 일치
};

export const HyperLogRenderer = React.memo(React.forwardRef<HyperLogHandle, HyperLogRendererProps>(({
    totalCount,
    rowHeight,
    onScrollRequest,
    preferences,
    activeLineIndex = -1,
    selectedIndices,
    bookmarks,
    textHighlights = [],
    lineHighlights = [],
    lineHighlightRanges = [],
    highlightCaseSensitive = false,
    levelMatchers = [],
    onLineClick,
    onLineDoubleClick,
    onAtBottomChange,
    onScroll,
    absoluteOffset,
    isRawMode,
    performanceHeatmap = [],
    onKeyDown,
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bgCanvasRef = useRef<HTMLCanvasElement>(null); // ✅ NEW: Background Layer
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [stableScrollTop, setStableScrollTop] = useState(0);
    const [stableScrollLeft, setStableScrollLeft] = useState(0);
    const [stableScrollWidth, setStableScrollWidth] = useState(0); // ✅ NEW: Dynamic Width
    const [viewportHeight, setViewportHeight] = useState(0);
    const [cachedLines, setCachedLines] = useState<Map<number, CachedLine>>(new Map());
    const pendingIndices = useRef<Set<number>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const scrollTopRef = useRef(0);
    const scrollLeftRef = useRef(0); // ✅ NEW: Horizontal Scroll Ref
    const frameId = useRef<number | null>(null);

    const cachedLinesRef = useRef(cachedLines);
    useEffect(() => { cachedLinesRef.current = cachedLines; }, [cachedLines]);
    const scrollTaskRef = useRef<number | null>(null);

    // --- IMPERATIVE HANDLE ---
    React.useImperativeHandle(ref, () => ({
        scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' }) => {
            if (!scrollContainerRef.current) return;
            let targetTop = index * rowHeight;
            if (options?.align === 'center') targetTop -= viewportHeight / 2 - rowHeight / 2;
            else if (options?.align === 'end') targetTop -= viewportHeight - rowHeight;

            scrollContainerRef.current.scrollTop = Math.max(0, targetTop);
        },
        scrollBy: (options: { top: number }) => {
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop += options.top;
        },
        scrollTo: (options: { top: number }) => {
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = options.top;
        },
        getScrollTop: () => scrollTopRef.current,
        focus: () => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.focus({ preventScroll: true });
            }
        }
    }));

    // Data Fetching Logic
    const loadVisibleLines = useCallback(async (startIdx: number, endIdx: number) => {
        const needed: number[] = [];
        const currentCache = cachedLinesRef.current;
        const checkStart = Math.max(0, startIdx - 1000); // 👈 위쪽도 넓게 감시
        const checkEnd = Math.min(totalCount - 1, endIdx + 3000); // 👈 아래쪽은 더 넓게 (보통 아래로 많이 가시니까요)

        for (let i = checkStart; i <= checkEnd; i++) {
            if (!currentCache.has(i) && !pendingIndices.current.has(i)) {
                needed.push(i);
            }
        }

        if (needed.length > 0) {
            const batchStart = Math.max(0, needed[0] - 1000); // 👈 (500 -> 1000)
            const batchCount = Math.min(totalCount - batchStart, (needed[needed.length - 1] - batchStart) + 5000); // 👈 5000줄뭉텅이

            for (let i = batchStart; i < batchStart + batchCount; i++) pendingIndices.current.add(i);

            try {
                const lines = await onScrollRequest(batchStart, batchCount);
                if (!lines || lines.length === 0) {
                    // ✅ Recovery: If fetch fails or returns empty, allow retry
                    for (let i = batchStart; i < batchStart + batchCount; i++) pendingIndices.current.delete(i);
                    return;
                }

                setCachedLines(prev => {
                    const next = new Map(prev);
                    // Clear all pending indices for this entire batch range immediately to prevent deadlocks
                    for (let i = batchStart; i < batchStart + batchCount; i++) {
                        pendingIndices.current.delete(i);
                    }

                    lines.forEach((l, idx) => {
                        if (!l) return;
                        const content = typeof l === 'string' ? l : (l.content || '');
                        const decodedContent = decodeHTMLEntities(content);

                        let levelColor = '#ccc';
                        if (levelMatchers && levelMatchers.length > 0) {
                            const prefix = content.substring(0, 100);
                            for (const m of levelMatchers) {
                                if (m.regex.test(prefix)) {
                                    levelColor = m.color;
                                    break;
                                }
                            }
                        }

                        const cached: CachedLine = {
                            lineNum: typeof l === 'string' ? batchStart + idx : (l.lineNum ?? batchStart + idx),
                            content: content,
                            decodedContent,
                            levelColor
                        };
                        next.set(batchStart + idx, cached);
                    });

                    if (next.size > 150000) {
                        const keys = Array.from(next.keys());
                        for (let k = 0; k < (keys.length - 120000); k++) next.delete(keys[k]);
                    }
                    cachedLinesRef.current = next;
                    return next;
                });
            } catch (e) {
                console.error('[HyperLog] Fetch failed', e);
                for (let i = batchStart; i < batchStart + batchCount; i++) pendingIndices.current.delete(i);
            }
        }
    }, [onScrollRequest, totalCount, levelMatchers]);

    // 🔥 Pre-compile Regexes and Colors for Performance
    const compiledTextHighlights = useMemo(() => {
        // console.log('[HyperLog] Re-compiling highlights with caseSensitive:', highlightCaseSensitive);
        return textHighlights.map(h => ({
            ...h,
            regex: new RegExp(h.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), highlightCaseSensitive ? 'g' : 'gi'),
            canvasColor: mapColor(h.color, 0.8)
        }));
    }, [textHighlights, highlightCaseSensitive]);

    const compiledLineHighlights = useMemo(() => {
        return lineHighlights.map(h => ({
            ...h,
            canvasColor: mapColor(h.color, 0.25)
        }));
    }, [lineHighlights]);

    const compiledLineHighlightRanges = useMemo(() => {
        return lineHighlightRanges.map(r => ({
            ...r,
            canvasColor: mapColor(r.color, 0.2)
        }));
    }, [lineHighlightRanges]);

    const selectionColor = 'rgba(79, 70, 229, 0.4)';
    const activeColor = 'rgba(79, 70, 229, 0.2)';
    const bookmarkColor = 'rgba(234, 179, 8, 0.2)';
    const gutterColor = '#64748b';
    const defaultTextColor = '#ccc';

    // 🔥 Monospaced Font Metrics Cache
    const charWidthRef = useRef<number>(8); // Default fallback
    const measureCache = useRef<Map<string, number>>(new Map());

    useLayoutEffect(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const fontSize = preferences?.fontSize || 13;
            const fontFamily = preferences?.fontFamily || "'JetBrains Mono', monospace";
            ctx.font = `${fontSize}px ${fontFamily}`;
            charWidthRef.current = ctx.measureText('M').width;
            measureCache.current.clear(); // Clear cache when font changes
        }
    }, [preferences?.fontSize, preferences?.fontFamily]);

    // Fast width calculator
    // Fast width calculator
    const getCachedWidth = useCallback((ctx: CanvasRenderingContext2D, text: string) => {
        const key = `${ctx.font}_${text}`;
        let width = measureCache.current.get(key);
        if (width === undefined) {
            width = ctx.measureText(text).width;
            measureCache.current.set(key, width);
            if (measureCache.current.size > 2000) {
                const firstKey = measureCache.current.keys().next().value;
                if (firstKey) measureCache.current.delete(firstKey);
            }
        }
        return width;
    }, []);

    // Rendering Logic (Canvas)
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const bgCanvas = bgCanvasRef.current;
        if (!canvas || !bgCanvas) return;

        const ctx = canvas.getContext('2d', { alpha: true }); // Need alpha for text layer
        const bgCtx = bgCanvas.getContext('2d', { alpha: false }); // Background can be opaque
        if (!ctx || !bgCtx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        const currentScrollTop = scrollTopRef.current;
        const currentScrollLeft = scrollLeftRef.current; // ✅ NEW
        const visibleStart = Math.floor(currentScrollTop / rowHeight);
        const visibleEnd = Math.ceil((currentScrollTop + height) / rowHeight);

        const startIdx = Math.max(0, visibleStart - 50);
        const endIdx = Math.min(totalCount - 1, visibleEnd + 150);

        loadVisibleLines(startIdx, endIdx);

        const fontSize = preferences?.fontSize || 13;
        const fontFamily = preferences?.fontFamily || "'JetBrains Mono', monospace";
        const gutterFont = `10px ${fontFamily}`;
        const mainFont = `${fontSize}px ${fontFamily}`;

        // --- 1. RENDER BACKGROUND LAYER ---
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bgCtx.fillStyle = '#020617'; // Slate-950
        bgCtx.fillRect(0, 0, width, height);

        for (let i = startIdx; i <= endIdx; i++) {
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue;

            let bgColor: string | null = null;
            if (selectedIndices?.has(i)) bgColor = selectionColor;
            else if (activeLineIndex === i) bgColor = activeColor;
            // else if (bookmarks.has(i)) bgColor = bookmarkColor; // 👈 Removed: No more full-line bookmark background
            else {
                const rangeMatch = compiledLineHighlightRanges.find(r => i >= r.start && i <= r.end);
                if (rangeMatch) bgColor = rangeMatch.canvasColor;
            }

            // Keyword Line Background (Fallback)
            if (!bgColor && compiledLineHighlights.length > 0) {
                const lineData = cachedLinesRef.current.get(i);
                if (lineData) {
                    const lineContent = lineData.content;
                    const lowerContent = highlightCaseSensitive ? '' : lineContent.toLowerCase();
                    for (const h of compiledLineHighlights) {
                        const match = highlightCaseSensitive ? lineContent.includes(h.keyword) : lowerContent.includes(h.keyword.toLowerCase());
                        if (match) {
                            bgColor = h.canvasColor;
                            break;
                        }
                    }
                }
            }

            if (bgColor) {
                bgCtx.fillStyle = bgColor;
                bgCtx.fillRect(0, y, width, rowHeight);
            }
        }

        // --- 1.1 RENDER PERFORMANCE HEATMAP ---
        if (performanceHeatmap && performanceHeatmap.length > 0) {
            const stripWidth = 4;
            const x = width - 25; // Moved further left to avoid scrollbar overlap
            const points = performanceHeatmap.length;
            const pointHeight = height / points;

            // Draw Subtle Track Background
            bgCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            bgCtx.fillRect(x - 2, 0, stripWidth + 4, height);

            for (let i = 0; i < points; i++) {
                const val = performanceHeatmap[i];
                if (val <= 0) continue;

                const alpha = 0.3 + (val * 0.7);
                bgCtx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                bgCtx.fillRect(x, i * pointHeight, stripWidth, Math.max(1, pointHeight));

                if (val > 0.5) {
                    bgCtx.fillStyle = `rgba(239, 68, 68, 0.4)`;
                    bgCtx.fillRect(x - 2, i * pointHeight, stripWidth + 2, Math.max(1, pointHeight));
                }
            }
        }

        // --- 2. RENDER TEXT LAYER ---
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        // --- 🛡️ Protection: Clip Content to protect Gutter ---
        ctx.save(); // [A] Save state before clipping

        // Gutter Styling
        ctx.font = gutterFont;
        ctx.fillStyle = gutterColor;

        for (let i = startIdx; i <= endIdx; i++) {
            const lineData = cachedLinesRef.current.get(i);
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue;
            const centerY = y + (rowHeight / 2);

            // --- 🌟 Restoration: Bookmark Highlight in Gutter ---
            if (bookmarks.has(i)) {
                // Draw Star - smaller (11px) and brighter
                ctx.save();
                ctx.shadowBlur = 3;
                ctx.shadowColor = 'rgba(250, 204, 21, 0.4)';
                ctx.font = '11px sans-serif';
                ctx.fillStyle = '#fde047'; // yellow-300
                ctx.fillText('★', 6, centerY - 1); // 👈 Adjusted: Lifted up for alignment
                ctx.restore();

                // ❌ Removed: bgCtx.fillRect (No more yellow background for lines)
            }

            if (lineData) {
                ctx.font = gutterFont;
                // #Index - Always default color
                ctx.fillStyle = gutterColor;
                ctx.fillText(`#${(i + 1).toLocaleString()}`, GUTTER_STAR_WIDTH, centerY);

                // Line Number - Yellow only if bookmarked
                ctx.fillStyle = bookmarks.has(i) ? '#fef08a' : gutterColor;
                ctx.fillText(String(lineData.lineNum), GUTTER_STAR_WIDTH + GUTTER_INDEX_WIDTH, centerY);
            }
        }

        // --- 🛡️ Dynamic Clipping: Protect gutter from scrolling content ---
        ctx.beginPath();
        ctx.rect(CONTENT_X_OFFSET - 2, 0, width - CONTENT_X_OFFSET + 2, height);
        ctx.clip(); // [B] Now everything below will stay inside this box

        let maxLineWidth = 0; // To track scrollable width

        for (let i = startIdx; i <= endIdx; i++) {
            const lineData = cachedLinesRef.current.get(i);
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue;
            const centerY = y + (rowHeight / 2);

            if (lineData) {
                ctx.font = mainFont;
                const displayContent = lineData.decodedContent;

                // 하이라이트 구간 찾기
                const segments: { start: number, end: number, color: string | null }[] = [];
                if (compiledTextHighlights.length > 0) {
                    for (const h of compiledTextHighlights) {
                        h.regex.lastIndex = 0;
                        let match;
                        while ((match = h.regex.exec(displayContent)) !== null) {
                            segments.push({
                                start: match.index,
                                end: match.index + match[0].length,
                                color: h.canvasColor
                            });
                        }
                    }
                }

                segments.sort((a, b) => a.start - b.start);

                let currentX = CONTENT_X_OFFSET - currentScrollLeft;
                let lastIndex = 0;

                const drawSegment = (text: string, isHighlight: boolean, color: string | null) => {
                    const width = getCachedWidth(ctx, text);
                    if (isHighlight && color) {
                        ctx.fillStyle = color;
                        if (ctx.roundRect) {
                            ctx.beginPath();
                            ctx.roundRect(currentX, y + 1, width, rowHeight - 2, 4);
                            ctx.fill();
                        } else {
                            ctx.fillRect(currentX, y + 1, width, rowHeight - 2);
                        }
                        ctx.fillStyle = '#0f172a';
                    } else {
                        ctx.fillStyle = lineData.levelColor || defaultTextColor;
                    }
                    ctx.fillText(text, currentX, centerY);
                    currentX += width;
                };

                for (const seg of segments) {
                    if (seg.start > lastIndex) {
                        drawSegment(displayContent.substring(lastIndex, seg.start), false, null);
                    }
                    if (seg.start >= lastIndex) {
                        drawSegment(displayContent.substring(seg.start, seg.end), true, seg.color);
                        lastIndex = seg.end;
                    }
                }

                if (lastIndex < displayContent.length) {
                    drawSegment(displayContent.substring(lastIndex), false, null);
                }

                // Calculate cumulative line width for dynamic scroll
                const totalLineWidth = (currentX + currentScrollLeft) - CONTENT_X_OFFSET;
                if (totalLineWidth > maxLineWidth) maxLineWidth = totalLineWidth;
            }
        }

        ctx.restore(); // [C] Restore state (clipping ends here)
    }, [stableScrollTop, cachedLines, totalCount, rowHeight, preferences, levelMatchers, selectedIndices, activeLineIndex, bookmarks, loadVisibleLines, compiledTextHighlights, compiledLineHighlights, highlightCaseSensitive, compiledLineHighlightRanges, getCachedWidth, performanceHeatmap]);

    const renderHeatmap = useCallback(() => {
        render(); // 히트맵 렌더링은 이제 render 함수 통합됨
    }, [render]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsDragging(false);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const dpr = window.devicePixelRatio || 1;
                const { width, height } = entry.contentRect;
                setViewportHeight(height);
                if (bgCanvasRef.current) {
                    bgCanvasRef.current.width = width * dpr;
                    bgCanvasRef.current.height = height * dpr;
                    bgCanvasRef.current.style.width = width + 'px';
                    bgCanvasRef.current.style.height = height + 'px';
                    const bgCtx = bgCanvasRef.current.getContext('2d');
                    if (bgCtx) {
                        bgCtx.setTransform(1, 0, 0, 1, 0, 0);
                        bgCtx.scale(dpr, dpr);
                    }
                }
                if (canvasRef.current) {
                    canvasRef.current.width = width * dpr;
                    canvasRef.current.height = height * dpr;
                    canvasRef.current.style.width = width + 'px';
                    canvasRef.current.style.height = height + 'px';
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.scale(dpr, dpr);
                    }
                    render();
                    renderHeatmap();
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [render]);

    useLayoutEffect(() => {
        render();
        renderHeatmap();
    }, [render, cachedLines, selectedIndices, activeLineIndex, bookmarks, performanceHeatmap]);

    // ✅ Dynamic Width Calculation (Sample based for performance)
    useEffect(() => {
        if (cachedLines.size === 0) return;

        // Measure a sample of lines to estimate max width
        // 형님, 성능을 위해 전체가 아닌 최근 로드된 라인들 위주로 검사합니다.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.font = `${preferences?.fontSize || 13}px ${preferences?.fontFamily || "'JetBrains Mono', monospace"}`;

        let maxW = 0;
        const lineCount = cachedLines.size;
        const keys = Array.from(cachedLines.keys());
        // Check last 200 lines (most likely to be the new ones) + some samples
        const sampleSize = Math.min(lineCount, 500);
        for (let i = 0; i < sampleSize; i++) {
            const line = cachedLines.get(keys[lineCount - 1 - i]);
            if (line) {
                const w = ctx.measureText(line.decodedContent).width;
                if (w > maxW) maxW = w;
            }
        }

        const targetWidth = maxW + CONTENT_X_OFFSET + 100;
        setStableScrollWidth(prev => Math.abs(prev - targetWidth) > 50 ? targetWidth : prev);
    }, [cachedLines, preferences?.fontSize, preferences?.fontFamily]);



    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        const left = e.currentTarget.scrollLeft; // ✅ NEW
        const scrollHeight = e.currentTarget.scrollHeight;
        const clientHeight = e.currentTarget.clientHeight;
        scrollTopRef.current = top;
        scrollLeftRef.current = left; // ✅ NEW

        // 🔥 Canvas 즉시 업데이트 (60fps)
        if (frameId.current) cancelAnimationFrame(frameId.current);
        frameId.current = requestAnimationFrame(() => {
            render();
            if (onScroll) onScroll(top, scrollHeight, clientHeight);
        });

        // 👈 Interaction Layer (DOM) 업데이트는 약간 지연시켜서 스크롤 시 부하 경감
        if (scrollTaskRef.current) clearTimeout(scrollTaskRef.current);
        scrollTaskRef.current = window.setTimeout(() => {
            setStableScrollTop(top);
            setStableScrollLeft(left); // ✅ NEW
            if (onAtBottomChange) {
                const isAtBottom = top + viewportHeight >= scrollHeight - 50;
                onAtBottomChange(isAtBottom);
            }
        }, 16);
    };

    const visibleLines = useMemo(() => {
        const start = Math.floor(stableScrollTop / rowHeight);
        const end = Math.min(totalCount - 1, Math.ceil((stableScrollTop + viewportHeight) / rowHeight) + 2);
        const res = [];
        for (let i = start; i <= end; i++) {
            res.push({ index: i, line: cachedLines.get(i) });
        }
        return res;
    }, [stableScrollTop, stableScrollLeft, viewportHeight, rowHeight, totalCount, cachedLines]);
    const handleLineAction = (e: React.MouseEvent, index: number, type: 'click' | 'dbclick' | 'enter') => {
        if (e.altKey) {
            // Alt 모드일 때는 브라우저 기본 텍스트 선택을 위해 아무것도 하지 않습니다.
            return;
        }

        // 형님, 클릭 시 즉시 스크롤 컨테이너에 포커스를 줘서 키보드 이벤트를 받을 수 있게 합니다.
        if (type === 'click' && scrollContainerRef.current) {
            scrollContainerRef.current.focus({ preventScroll: true });
        }

        // 👈 Use provided index directly instead of recalculating from Y coordinate
        // This is much more accurate as it matches the rendered interactive element.
        const lineIndex = index;

        if (type === 'click') {
            if (onLineClick) {
                // 형님, 일반 드래그 시에는 브라우저 선택을 막아야 깔끔한 줄 선택이 됩니다.
                e.preventDefault();
                setIsDragging(true);
                onLineClick(lineIndex + (absoluteOffset || 0), e.shiftKey, e.ctrlKey || e.metaKey);
            }
        } else if (type === 'enter' && isDragging && onLineClick) {
            // 드래그 중인 라인에 마우스가 들어오면 자동으로 선택 범위를 확장합니다.
            onLineClick(lineIndex + (absoluteOffset || 0), true, false);
        } else if (type === 'dbclick' && onLineDoubleClick) {
            onLineDoubleClick(lineIndex + (absoluteOffset || 0));
        }
    };



    return (
        <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden bg-white dark:bg-slate-950 font-mono hyper-log-container"
            style={{ height: '100%' }}
            onMouseDown={(e) => {
                if (!scrollContainerRef.current) return;
                const rect = containerRef.current!.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const hitAreaWidth = 25;

                // ✅ Global Heatmap Click Detection (Reserving space for scrollbar)
                const hitAreaStart = rect.width - 40;
                const hitAreaEnd = rect.width - 16; // Skip scrollbar (approx 16px)
                if (mouseX >= hitAreaStart && mouseX <= hitAreaEnd) {
                    const clickRatio = mouseY / rect.height;
                    const totalScrollHeight = totalCount * rowHeight;
                    const targetTop = (clickRatio * totalScrollHeight) - (rect.height / 2);
                    scrollContainerRef.current.scrollTop = Math.max(0, targetTop);

                    // Prevent text selection when clicking heatmap
                    e.preventDefault();
                }
            }}
        >
            <style>{`
                .hyper-log-container ::selection {
                    background: rgba(79, 70, 229, 0.4);
                    color: inherit;
                }
                /* 형님, 분신술 방지를 위해 글자 자체는 숨기되, 선택 배경은 상시 가시화합니다. */
                .interaction-line::selection {
                    background: rgba(79, 70, 229, 0.4) !important;
                    color: transparent !important;
                    -webkit-text-fill-color: transparent !important;
                }
                .interaction-line {
                    user-select: text !important;
                    color: transparent !important;
                    -webkit-text-fill-color: transparent !important;
                    letter-spacing: 0px !important; 
                    word-spacing: 0px !important; 
                    font-weight: 400 !important; 
                    font-variant-ligatures: none !important; 
                    font-feature-settings: "liga" 0, "clig" 0, "calt" 0 !important;
                    font-kerning: none !important; 
                    text-rendering: geometricPrecision !important;
                    text-indent: 0px !important; 
                    clip-path: inset(0 0 0 -200px); /* Allow selection to bleed left but hidden by clipping box anyway */
                }
                /* ✅ Clipping Box to protect Gutter from DOM text interaction */
                .interaction-scroll-layer::before {
                    content: '';
                    position: sticky;
                    left: 0;
                    top: 0;
                    width: ${CONTENT_X_OFFSET}px;
                    height: 100%;
                    background: #020617; /* match bg */
                    z-index: 20;
                    pointer-events: none;
                }
                /* ✅ 히트맵 영역 마우스 포인터 표시 (스크롤바 왼쪽) */
                .hyper-log-container::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 16px; /* Avoid scrollbar */
                    width: 24px; 
                    height: 100%;
                    cursor: pointer;
                    z-index: 50;
                    pointer-events: auto;
                }
                /* 하지만 실제 스크롤바 조작을 방해하지 않기 위해 로그 라인이 없을 때만 노출되거나 
                   투명하게 유지하여 클릭 이벤트는 JS에서 선점합니다. */
            `}</style>
            {/* 🎨 Double Layered Canvas Architecture */}
            {/* Layer 1: Backgrounds & Highlights */}
            <canvas
                ref={bgCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 1 }}
            />
            {/* Layer 2: Main Text & Overlays */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 2 }}
            />

            {/* 3. Unified Scroll & Interaction Layer (z-10) */}
            <div
                ref={scrollContainerRef}
                tabIndex={0}
                className="absolute inset-0 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 interaction-scroll-layer custom-scrollbar outline-none"
                style={{ zIndex: 10 }}
                onScroll={handleScroll}
                onKeyDown={onKeyDown}
            >
                <div style={{
                    height: totalCount * rowHeight,
                    width: stableScrollWidth || '100%',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Interaction Items (Each line positioned absolutely for perfect alignment) */}
                    {visibleLines.map(({ index, line }) => {
                        const fontSize = preferences?.fontSize || 13;
                        const fontFamily = preferences?.fontFamily || "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace";

                        return (
                            <div
                                key={index}
                                className="absolute select-text whitespace-pre overflow-hidden pointer-events-auto active:bg-indigo-500/5 hover:bg-slate-500/5 interaction-line"
                                style={{
                                    top: index * rowHeight,
                                    left: CONTENT_X_OFFSET - stableScrollLeft,
                                    width: stableScrollWidth ? stableScrollWidth - CONTENT_X_OFFSET : '100%',
                                    height: rowHeight,
                                    lineHeight: `${rowHeight}px`,
                                    fontSize: `${fontSize}px`,
                                    fontFamily: fontFamily,
                                    paddingLeft: 0,
                                    boxSizing: 'border-box',
                                    WebkitFontSmoothing: 'antialiased',
                                    MozOsxFontSmoothing: 'grayscale',
                                    fontVariantLigatures: 'none',
                                    fontFeatureSettings: '"liga" 0, "clig" 0, "calt" 0',
                                    fontKerning: 'none',
                                    textRendering: 'geometricPrecision'
                                } as React.CSSProperties}
                                onMouseDown={(e) => handleLineAction(e, index, 'click')}
                                onMouseEnter={(e) => handleLineAction(e, index, 'enter')}
                                onDoubleClick={(e) => handleLineAction(e, index, 'dbclick')}
                            >
                                {line?.decodedContent || decodeHTMLEntities(line?.content || '')}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}));
HyperLogRenderer.displayName = 'HyperLogRenderer';
