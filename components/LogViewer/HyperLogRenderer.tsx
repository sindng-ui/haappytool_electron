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
}

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
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [stableScrollTop, setStableScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [cachedLines, setCachedLines] = useState<Map<number, CachedLine>>(new Map());
    const pendingIndices = useRef<Set<number>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const scrollTopRef = useRef(0);
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
        getScrollTop: () => scrollTopRef.current
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
        return textHighlights.map(h => ({
            ...h,
            regex: new RegExp(h.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), highlightCaseSensitive ? 'g' : 'gi'),
            canvasColor: mapColor(h.color, 0.5)
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
    useLayoutEffect(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const fontSize = preferences?.fontSize || 13;
            const fontFamily = preferences?.fontFamily || "'JetBrains Mono', monospace";
            ctx.font = `${fontSize}px ${fontFamily}`;
            charWidthRef.current = ctx.measureText('M').width;
        }
    }, [preferences?.fontSize, preferences?.fontFamily]);

    // Rendering Logic (Canvas)
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // 🔥 Performance: Disable alpha if possible (actually we need it for overlays, but let's keep it default if unsure)
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        // Reset Transform and Clear
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#020617'; // Hardcoded dark theme for slate-950 compatibility
        ctx.fillRect(0, 0, width, height);

        const currentScrollTop = scrollTopRef.current;
        const visibleStart = Math.floor(currentScrollTop / rowHeight);
        const visibleEnd = Math.ceil((currentScrollTop + height) / rowHeight);

        const startIdx = Math.max(0, visibleStart - 50);
        const endIdx = Math.min(totalCount - 1, visibleEnd + 150);

        loadVisibleLines(startIdx, endIdx);

        const fontSize = preferences?.fontSize || 13;
        const fontFamily = preferences?.fontFamily || "'JetBrains Mono', monospace";
        const gutterFont = `10px ${fontFamily}`;
        const mainFont = `${fontSize}px ${fontFamily}`;
        const hasLetterSpacing = 'letterSpacing' in ctx;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        // --- PASS 1: BACKGROUNDS ---
        for (let i = startIdx; i <= endIdx; i++) {
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue; // Early exit for far-out lines

            let bgColor: string | null = null;
            if (selectedIndices?.has(i)) bgColor = selectionColor;
            else if (activeLineIndex === i) bgColor = activeColor;
            else if (bookmarks.has(i)) bgColor = bookmarkColor;
            else {
                const rangeMatch = compiledLineHighlightRanges.find(r => i >= r.start && i <= r.end);
                if (rangeMatch) bgColor = rangeMatch.canvasColor;
            }

            if (bgColor) {
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, y, width, rowHeight);
            }
        }

        // --- PASS 2: GUTTERS ---
        ctx.font = gutterFont;
        ctx.fillStyle = gutterColor;
        for (let i = startIdx; i <= endIdx; i++) {
            const lineData = cachedLinesRef.current.get(i);
            if (!lineData) continue;
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue;

            const centerY = y + (rowHeight / 2);
            ctx.fillText(`#${(i + 1).toLocaleString()}`, 5, centerY);
            ctx.fillText(String(lineData.lineNum), 80, centerY);
        }

        // --- PASS 3: MAIN TEXT & KEYWORD LINE HIGHLIGHTS ---
        ctx.font = mainFont;
        for (let i = startIdx; i <= endIdx; i++) {
            const lineData = cachedLinesRef.current.get(i);
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue;
            const centerY = y + (rowHeight / 2);

            if (!lineData) {
                ctx.fillStyle = 'rgba(51, 65, 85, 0.3)';
                ctx.fillRect(180, centerY - (fontSize / 4), 300, fontSize / 2);
                continue;
            }

            // Keyword Line Background (if no primary BG)
            const isDecorated = selectedIndices?.has(i) || activeLineIndex === i || bookmarks.has(i);
            if (!isDecorated && compiledLineHighlights.length > 0) {
                for (const h of compiledLineHighlights) {
                    const match = highlightCaseSensitive
                        ? lineData.content.includes(h.keyword)
                        : lineData.content.toLowerCase().includes(h.keyword.toLowerCase());
                    if (match) {
                        ctx.fillStyle = h.canvasColor;
                        ctx.fillRect(0, y, width, rowHeight);
                        break;
                    }
                }
            }

            // Level Based Text Color
            // Level Based Text Color (Now pre-calculated!)
            ctx.fillStyle = lineData.levelColor || defaultTextColor;
            const displayContent = lineData.decodedContent;
            ctx.fillText(displayContent, 180, centerY);

            // PASS 4: KEYWORD HIGHLIGHTS (In-line)
            if (compiledTextHighlights.length > 0) {
                const charWidth = charWidthRef.current;
                for (const h of compiledTextHighlights) {
                    h.regex.lastIndex = 0;
                    let match;
                    while ((match = h.regex.exec(displayContent)) !== null) {
                        const matchStr = match[0];
                        ctx.fillStyle = h.canvasColor;
                        // 🔥 NO measureText inside hot loop! Use monospaced math.
                        ctx.fillRect(180 + (match.index * charWidth), y + 2, matchStr.length * charWidth, rowHeight - 4);
                    }
                }
                ctx.fillStyle = lineData.levelColor || defaultTextColor;
            }
        }
    }, [stableScrollTop, cachedLines, totalCount, rowHeight, preferences, levelMatchers, selectedIndices, activeLineIndex, bookmarks, loadVisibleLines, compiledTextHighlights, compiledLineHighlights, highlightCaseSensitive, compiledLineHighlightRanges]);

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
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [render]);

    useLayoutEffect(() => {
        render();
    }, [render, cachedLines, selectedIndices, activeLineIndex, bookmarks]);



    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        const scrollHeight = e.currentTarget.scrollHeight;
        const clientHeight = e.currentTarget.clientHeight;
        scrollTopRef.current = top;

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
    }, [stableScrollTop, viewportHeight, rowHeight, totalCount, cachedLines]);
    const handleLineAction = (e: React.MouseEvent, index: number, type: 'click' | 'dbclick' | 'enter') => {
        if (e.altKey) {
            // Alt 모드일 때는 브라우저 기본 텍스트 선택을 위해 아무것도 하지 않습니다.
            return;
        }

        const rect = scrollContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const lineIndex = Math.floor((scrollTopRef.current + y) / rowHeight);

        if (type === 'click' && onLineClick) {
            // 형님, 일반 드래그 시에는 브라우저 선택을 막아야 깔끔한 줄 선택이 됩니다.
            e.preventDefault();
            setIsDragging(true);
            onLineClick(lineIndex + (absoluteOffset || 0), e.shiftKey, e.ctrlKey || e.metaKey);
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
                    text-indent: 0px !important; /* 👈 들여쓰기 오차 방지 */
                }
            `}</style>
            {/* 1. Background Canvas (z-0) */}
            <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

            {/* 2. Unified Scroll & Interaction Layer (z-10) */}
            <div
                ref={scrollContainerRef}
                className="absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 z-10"
                onScroll={handleScroll}
            >
                <div style={{ height: totalCount * rowHeight, position: 'relative' }}>

                    {/* Interaction Items (Each line positioned absolutely for perfect alignment) */}
                    {visibleLines.map(({ index, line }) => {
                        const fontSize = preferences?.fontSize || 13;
                        const fontFamily = preferences?.fontFamily || "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace";

                        // 형님, 글자가 겹쳐 보이는 '분신술'은 style 객체 안에 무효한 !important가 있어서 
                        // transparent가 무시되었기 때문입니다. 이를 표준 방식으로 수정합니다.
                        return (
                            <div
                                key={index}
                                className="absolute select-text whitespace-pre overflow-hidden pointer-events-auto active:bg-indigo-500/5 hover:bg-slate-500/5 interaction-line"
                                style={{
                                    top: index * rowHeight,
                                    left: 180, // 👈 텍스트 시작점으로 정확히 이동
                                    width: 'calc(100% - 180px)', // 👈 남은 너비 전체 차지
                                    height: rowHeight,
                                    lineHeight: `${rowHeight}px`,
                                    fontSize: `${fontSize}px`,
                                    fontFamily: fontFamily,
                                    paddingLeft: 0, // 👈 padding 대신 left 사용
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
