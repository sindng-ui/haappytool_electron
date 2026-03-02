import React, { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { LogHighlight, LogViewPreferences } from '../../types';
import { LOG_VIEW_CONFIG } from '../../constants/logViewUI';

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
    isActive: boolean;
    clearCacheTick?: number;
    sharedBuffers?: {
        logBuffer: SharedArrayBuffer;
        lineOffsets: SharedArrayBuffer;
        lineLengths: SharedArrayBuffer;
        filteredIndices: SharedArrayBuffer;
        isStreamMode: boolean;
    } | null;
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
    getCenterLineInfo: () => { index: number; offset: number; viewportHeight: number };
    focus: () => void;
}

// ✅ 형님, Canvas와 DOM 레이어의 폰트 렌더링을 100% 일치시키기 위한 공통 폰트 스택입니다.
const MONO_FONT_STACK = "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace";
const DEFAULT_FONT_WEIGHT = '400';

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
// 형님, HTML 엔터티를 완벽하게 디코딩해야 폰트 너비 계산 시 오차가 생기지 않습니다.
const decodeHTMLEntities = (text: string) => {
    if (!text) return '';
    return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ') // 👈 nbsp 처리 추가
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec)) // 👈 숫자형 엔터티 처리 추가
        .replace(/\t/g, '    '); // 👈 탭 문자를 공백으로 치환하여 Canvas/DOM 일치
};

export const HyperLogRenderer = React.memo(React.forwardRef<HyperLogHandle, HyperLogRendererProps>((props, ref) => {
    const {
        totalCount, rowHeight, onScrollRequest, preferences,
        selectedIndices, bookmarks, onLineClick, onLineDoubleClick,
        onAtBottomChange, onScroll, absoluteOffset, isRawMode,
        onKeyDown, isActive, clearCacheTick, sharedBuffers
    } = props;

    // Apply default values for optional props
    const activeLineIndex = props.activeLineIndex ?? -1;
    const textHighlights = props.textHighlights ?? [];
    const lineHighlights = props.lineHighlights ?? [];
    const lineHighlightRanges = props.lineHighlightRanges ?? [];
    const highlightCaseSensitive = props.highlightCaseSensitive ?? false;
    const levelMatchers = props.levelMatchers ?? [];
    const performanceHeatmap = props.performanceHeatmap ?? [];

    // ✅ 형님, 레이아웃 상수들을 컴포넌트 내부에서 계산하여 HMR이나 설정 변경에 즉각 대응하게 합니다.
    const {
        GUTTER_STAR_WIDTH,
        GUTTER_INDEX_WIDTH,
        GUTTER_LINENUM_WIDTH,
        GUTTER_TOTAL_WIDTH,
        CONTENT_X_OFFSET
    } = useMemo(() => {
        const fontSize = preferences?.fontSize || 13;
        const star = LOG_VIEW_CONFIG.COLUMN_WIDTHS.BOOKMARK;

        // 🎯 형님, 폰트가 작을 때도 간격이 너무 넓어 보이지 않게 고정 최소 너비를 제거하고 비례식으로만 계산합니다! 🐧📐
        const charWidth = fontSize * 0.65; // 모노스페이스 폰트 대략적인 너비 비중
        const index = Math.ceil(charWidth * 7.0); // #999,999 등 인덱스 영역 (더 타이트하게! 🐧🎯)
        const lineNum = Math.ceil(charWidth * 6.0); // 원본 라인 번호 영역 (더 타이트하게! 🐧🎯)

        const total = star + index + lineNum;
        const offset = total + LOG_VIEW_CONFIG.SPACING.CONTENT_LEFT_OFFSET;
        return {
            GUTTER_STAR_WIDTH: star,
            GUTTER_INDEX_WIDTH: index,
            GUTTER_LINENUM_WIDTH: lineNum,
            GUTTER_TOTAL_WIDTH: total,
            CONTENT_X_OFFSET: offset
        };
    }, [preferences?.fontSize]);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bgCanvasRef = useRef<HTMLCanvasElement>(null); // ✅ NEW: Background Layer
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [stableScrollTop, setStableScrollTop] = useState(0);
    const [stableScrollLeft, setStableScrollLeft] = useState(0);
    const [stableScrollWidth, setStableScrollWidth] = useState(0); // ✅ NEW: Dynamic Width
    const [viewportHeight, setViewportHeight] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number>(-1); // ✅ NEW: Hover Tracking
    const [cachedLines, setCachedLines] = useState<Map<number, CachedLine>>(new Map());
    const pendingIndices = useRef<Set<number>>(new Set());
    const isDraggingRef = useRef(false); // ✅ 상태가 아닌 Ref로 관리하여 재렌더링 방지
    const scrollTopRef = useRef(0);
    const scrollLeftRef = useRef(0); // ✅ NEW: Horizontal Scroll Ref
    const frameId = useRef<number | null>(null);

    // ✅ NEW: 줌 (rowHeight 변경) 시 1프레임 지터링 및 연속 줌 튀는 현상 방지를 위한 동기적 스크롤 보정
    const prevRowHeightRef = useRef(rowHeight);
    useLayoutEffect(() => {
        if (prevRowHeightRef.current !== rowHeight) {
            if (scrollContainerRef.current && viewportHeight > 0) {
                const prevRH = prevRowHeightRef.current;
                const currentScrollTop = scrollTopRef.current;

                // ✅ 형님, 중앙이 아닌 상단(First Visible Line)을 기준으로 줌을 보정합니다.
                // 이렇게 해야 로그가 몇 줄 없을 때 화면 위로 사라지는 현상을 막을 수 있습니다.
                const topFractionalIndex = currentScrollTop / prevRH;
                const newScrollTop = topFractionalIndex * rowHeight;

                scrollContainerRef.current.scrollTop = newScrollTop;
                scrollTopRef.current = newScrollTop;
            }
            prevRowHeightRef.current = rowHeight;
        }
    }, [rowHeight, viewportHeight]);


    const cachedLinesRef = useRef(cachedLines);
    useEffect(() => { cachedLinesRef.current = cachedLines; }, [cachedLines]);

    // ✅ clearCacheTick이 변경되면 내부 캐시를 비워줍니다. (wrapper의 clear 액션과 동기화)
    useEffect(() => {
        setCachedLines(new Map());
    }, [clearCacheTick]);

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
        getCenterLineInfo: () => {
            if (!scrollContainerRef.current) return { index: 0, offset: 0, viewportHeight: 0 };
            const scrollTop = scrollTopRef.current;
            const centerAbsY = scrollTop + viewportHeight / 2;
            const centerIndex = Math.floor(centerAbsY / rowHeight);
            const centerOffset = centerAbsY % rowHeight;
            return { index: centerIndex, offset: centerOffset, viewportHeight };
        },
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

            // --- Phase 2: Zero-copy Binary Load (SharedArrayBuffer) ---
            if (sharedBuffers && sharedBuffers.isStreamMode && sharedBuffers.logBuffer) {
                try {
                    const logArr = new Uint8Array(sharedBuffers.logBuffer);
                    const offsets = new Uint32Array(sharedBuffers.lineOffsets);
                    const lengths = new Uint32Array(sharedBuffers.lineLengths);
                    const indices = new Int32Array(sharedBuffers.filteredIndices);

                    const decodedLines = [];
                    const actualAbsoluteOffset = absoluteOffset || 0;

                    const decoder = new TextDecoder();
                    for (let i = batchStart; i < batchStart + batchCount; i++) {
                        const globalIdx = i + actualAbsoluteOffset;
                        if (globalIdx >= indices.length) break;
                        const realLineNum = indices[globalIdx];
                        const off = offsets[realLineNum];
                        const len = lengths[realLineNum];

                        const bytes = logArr.subarray(off, off + len);
                        const content = decoder.decode(bytes.slice());
                        decodedLines.push({ lineNum: globalIdx, content });
                    }

                    if (decodedLines.length > 0) {
                        // console.log(`[HyperLog] Zero-copy loaded ${decodedLines.length} lines`);
                        processLines(batchStart, batchCount, decodedLines);
                        return; // Done! No need for onScrollRequest
                    }
                } catch (err) {
                    console.error('[HyperLog] Binary load failed, falling back to IPC', err);
                }
            }

            // Fallback: Legacy IPC Fetch
            for (let i = batchStart; i < batchStart + batchCount; i++) pendingIndices.current.add(i);

            try {
                const lines = await onScrollRequest(batchStart, batchCount);
                if (!lines || lines.length === 0) {
                    for (let i = batchStart; i < batchStart + batchCount; i++) pendingIndices.current.delete(i);
                    return;
                }
                processLines(batchStart, batchCount, lines);
            } catch (err) {
                console.error('[Renderer] Batch fetch failed', err);
            }
        }
    }, [totalCount, onScrollRequest, levelMatchers, sharedBuffers, absoluteOffset]);

    // Helper to unify processing
    const processLines = useCallback((batchStart: number, batchCount: number, lines: any[]) => {
        setCachedLines(prev => {
            const next = new Map(prev);
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
                    content: '',
                    decodedContent,
                    levelColor
                };
                next.set(batchStart + idx, cached);
            });

            if (next.size > 50000) {
                const keys = Array.from(next.keys());
                for (let k = 0; k < (keys.length - 30000); k++) next.delete(keys[k]);
            }
            return next;
        });
    }, [levelMatchers]); // Dependencies for processLines

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

    const selectionColor = 'rgba(79, 70, 229, 0.55)'; // 👈 0.4 -> 0.55 상향
    const activeColor = 'rgba(79, 70, 229, 0.35)';    // 👈 0.2 -> 0.35 상향
    const bookmarkColor = 'rgba(234, 179, 8, 0.2)';
    const gutterColor = '#64748b';
    const defaultTextColor = '#ccc';

    // 🔥 Monospaced Font Metrics Cache
    const charWidthRef = useRef<number>(8); // Default fallback
    const measureCache = useRef<Map<string, number>>(new Map());

    // ✅ 형님, 폰트가 늦게 로드되어 너비 계산이 틀어지는 현상을 방지합니다.
    useEffect(() => {
        const handleFontsReady = () => {
            console.log('[HyperLog] 🖋️ Fonts loaded, clearing measure cache...');
            measureCache.current.clear();

            // 폰트가 로드되었으니 기본 글자 너비도 다시 재줍니다.
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const fontSize = preferences?.fontSize || 13;
                const fontFamily = preferences?.fontFamily || MONO_FONT_STACK;
                ctx.font = `${DEFAULT_FONT_WEIGHT} ${fontSize}px ${fontFamily}`;
                charWidthRef.current = ctx.measureText('M').width;
                console.log(` - Re-measured char width: ${charWidthRef.current}px`);
            }
            render(); // Canvas 다시 그리기
        };

        if ('fonts' in document) {
            document.fonts.ready.then(handleFontsReady);
        }

        // 초기 로드 시에도 한번 더 확인
        handleFontsReady();
    }, [preferences?.fontSize, preferences?.fontFamily]);

    useLayoutEffect(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const fontSize = preferences?.fontSize || 13;
            const fontFamily = preferences?.fontFamily || MONO_FONT_STACK;
            ctx.font = `${DEFAULT_FONT_WEIGHT} ${fontSize}px ${fontFamily}`;
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
            // ✅ Ensure settings match DOM precisely
            (ctx as any).fontVariantLigatures = 'none';
            (ctx as any).fontKerning = 'none';

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
        if (!isActive) return; // ✅ Skip rendering when hidden

        const canvas = canvasRef.current;
        const bgCanvas = bgCanvasRef.current;
        if (!canvas || !bgCanvas) return;

        const ctx = canvas.getContext('2d', { alpha: true }); // Need alpha for text layer
        const bgCtx = bgCanvas.getContext('2d', { alpha: false }); // Background can be opaque
        if (!ctx || !bgCtx) return;

        // ✅ 형님, DOM과 100% 일치시키기 위해 리게이처와 커닝을 명시적으로 끕니다.
        (ctx as any).fontVariantLigatures = 'none';
        (ctx as any).fontKerning = 'none';
        (bgCtx as any).fontVariantLigatures = 'none';
        (bgCtx as any).fontKerning = 'none';

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
        const fontFamily = preferences?.fontFamily || MONO_FONT_STACK;

        // 🎯 형님, 라인 번호 크기를 본문 폰트 크기와 동일하게 맞춰서 시인성을 높입니다!
        const gutterFontSize = fontSize;
        const gutterFont = `${DEFAULT_FONT_WEIGHT} ${gutterFontSize}px ${fontFamily}`;
        const mainFont = `${DEFAULT_FONT_WEIGHT} ${fontSize}px ${fontFamily}`;

        // --- 1. RENDER BACKGROUND LAYER ---
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bgCtx.fillStyle = '#020617'; // Slate-950 (Main Content Background)
        bgCtx.fillRect(0, 0, width, height);

        // --- 0.1 RENDER GUTTER BACKGROUND (Z-DEPTH) ---
        // 형님, 왼쪽 영역을 더 짙게 깔아서 본문과 확실히 분리해줍니다.
        bgCtx.fillStyle = '#010410'; // Darker than Slate-950
        bgCtx.fillRect(0, 0, GUTTER_TOTAL_WIDTH, height);

        // --- 0.2 RENDER VERTICAL DIVIDER ---
        // 형님, 요청하신 세로 구분선입니다! 옅은 그라데이션 느낌의 선을 추가합니다.
        bgCtx.strokeStyle = 'rgba(71, 85, 105, 0.5)'; // Slate-500 with opacity
        bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        bgCtx.moveTo(GUTTER_TOTAL_WIDTH, 0);
        bgCtx.lineTo(GUTTER_TOTAL_WIDTH, height);
        bgCtx.stroke();

        for (let i = startIdx; i <= endIdx; i++) {
            const y = (i * rowHeight) - currentScrollTop;
            if (y + rowHeight < 0 || y > height) continue;

            const globalIdx = i + (absoluteOffset || 0);

            let bgColor: string | null = null;
            if (selectedIndices?.has(globalIdx)) bgColor = selectionColor;
            else if (activeLineIndex === globalIdx) bgColor = activeColor;
            else if (hoveredIndex === i) bgColor = 'rgba(255, 255, 255, 0.04)'; // ✅ NEW: Subtle Hover Effect
            // else if (bookmarks.has(globalIdx)) bgColor = bookmarkColor; // 👈 Removed: No more full-line bookmark background
            else {
                const rangeMatch = compiledLineHighlightRanges.find(r => globalIdx >= r.start && globalIdx <= r.end);
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

            const globalIdx = i + (absoluteOffset || 0);

            // --- 🌟 Restoration: Bookmark Highlight in Gutter ---
            if (bookmarks.has(globalIdx)) {
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
                // #Index - 🎯 형님, 인덱스는 조금 더 어둡게!
                ctx.fillStyle = '#475569'; // Slate-500
                ctx.fillText(`#${globalIdx + 1}`, GUTTER_STAR_WIDTH, centerY);

                // Line Number - Yellow only if bookmarked, else neutral-400
                ctx.fillStyle = bookmarks.has(globalIdx) ? '#fef08a' : '#94a3b8'; // neutral-400
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

                // ✅ 캔버스 렌더링 극한 성능 튜닝: 정규식 대신 indexOf 사용 🐧🚀
                const segments: { start: number, end: number, color: string | null }[] = [];
                if (compiledTextHighlights.length > 0) {
                    for (const h of compiledTextHighlights) {
                        // 1. 단순 텍스트 매칭 여단 판단 (대부분의 하이라이트가 해당)
                        const isSimpleKeyword = /^[a-zA-Z0-9_\-\s]+$/.test(h.keyword);

                        if (isSimpleKeyword) {
                            // 단순 문자열 매칭: 고속 indexOf 루프 🚀
                            const searchContent = highlightCaseSensitive ? displayContent : displayContent.toLowerCase();
                            const keyword = highlightCaseSensitive ? h.keyword : h.keyword.toLowerCase();
                            const kwLen = keyword.length;

                            let startIndex = 0;
                            let index;
                            while ((index = searchContent.indexOf(keyword, startIndex)) > -1) {
                                segments.push({
                                    start: index,
                                    end: index + kwLen,
                                    color: h.canvasColor
                                });
                                startIndex = index + kwLen;
                            }
                        } else {
                            // 복잡한 정규식 매칭: 기존 fallback 
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
                }

                segments.sort((a, b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)));

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
    }, [stableScrollTop, cachedLines, totalCount, rowHeight, preferences, levelMatchers, selectedIndices, activeLineIndex, bookmarks, loadVisibleLines, compiledTextHighlights, compiledLineHighlights, highlightCaseSensitive, compiledLineHighlightRanges, getCachedWidth, performanceHeatmap, CONTENT_X_OFFSET, GUTTER_STAR_WIDTH, GUTTER_INDEX_WIDTH, isActive]);

    const renderHeatmap = useCallback(() => {
        render(); // 히트맵 렌더링은 이제 render 함수 통합됨
    }, [render]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            isDraggingRef.current = false;
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        let resizeRafId: number | null = null;
        let isFirstRender = true;

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;

                const applyResize = () => {
                    const dpr = window.devicePixelRatio || 1;
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
                };

                if (isFirstRender) {
                    isFirstRender = false;
                    applyResize();
                } else {
                    if (resizeRafId) cancelAnimationFrame(resizeRafId);
                    // 🎯 형님, 기존의 setTimeout(16ms) 디바운스가 타이머 기근(Starvation)을 일으켜
                    // 리사이즈 렌더가 멈추고 흰 바탕이 노출되던 버그를 고치기 위해,
                    // 무조건 다음 화면 페인트 시점에 캔버스가 함께 커지도록 rAF로 교체합니다! 🐧🚀
                    resizeRafId = requestAnimationFrame(applyResize);
                }
            }
        });
        observer.observe(containerRef.current);
        return () => {
            if (resizeRafId) cancelAnimationFrame(resizeRafId);
            observer.disconnect();
        };
    }, [render, renderHeatmap]);

    useLayoutEffect(() => {
        render();
        renderHeatmap();
    }, [render, cachedLines, selectedIndices, activeLineIndex, hoveredIndex, bookmarks, performanceHeatmap, isActive]);

    // ✅ Dynamic Width Calculation (Sample based for performance)
    useEffect(() => {
        if (cachedLines.size === 0) return;

        // Measure a sample of lines to estimate max width
        // 형님, 성능을 위해 전체가 아닌 최근 로드된 라인들 위주로 검사합니다.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.font = `${DEFAULT_FONT_WEIGHT} ${preferences?.fontSize || 13}px ${preferences?.fontFamily || MONO_FONT_STACK}`;

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
                const isAtBottom = top + clientHeight >= scrollHeight - 50;
                onAtBottomChange(isAtBottom);
            }
        }, 16);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!scrollContainerRef.current) return;
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const currentTop = scrollTopRef.current;
        const index = Math.floor((currentTop + y) / rowHeight);

        if (index >= 0 && index < totalCount) {
            if (hoveredIndex !== index) setHoveredIndex(index);
        } else {
            if (hoveredIndex !== -1) setHoveredIndex(-1);
        }
    };

    const handleMouseLeave = () => {
        if (hoveredIndex !== -1) setHoveredIndex(-1);
    };

    const visibleLines = useMemo(() => {
        const start = Math.floor(stableScrollTop / rowHeight);
        const end = Math.min(totalCount - 1, Math.ceil((stableScrollTop + viewportHeight) / rowHeight) + 2);
        const res = [];
        for (let i = start; i <= end; i++) {
            res.push({ index: i, line: cachedLines.get(i) });
        }
        return res;
    }, [stableScrollTop, viewportHeight, rowHeight, totalCount, cachedLines, isActive]);
    const handleLineAction = (e: React.MouseEvent, index: number, type: 'click' | 'dbclick' | 'enter') => {
        if (e.altKey) {
            // ✅ Alt 클릭으로 텍스트 선택을 시작하면 기존 라인 선택(파란 줄)을 지워줍니다.
            if (type === 'click' && onLineClick) {
                onLineClick(-1, false, false);
            }
            // Alt 모드일 때는 브라우저 기본 텍스트 선택을 위해 아무것도 하지 않습니다.
            return;
        }

        // ✅ 실제 왼쪽 클릭(button 0)이거나 줄 선택 드래그 중인 경우에만 기존 텍스트 선택을 지워줍니다.
        // 단순히 마우스가 줄 위로 올라가는(enter) 상황이나 우클릭 시에는 지우지 않습니다.
        if (e.button === 0 && (type !== 'enter' || isDraggingRef.current)) {
            window.getSelection()?.removeAllRanges();
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
                const globalIndex = lineIndex + (absoluteOffset || 0);

                // ✅ 텍스트 선택 영역이 있거나, 이미 선택된 라인이라면 우클릭 시 라인 선택을 새로 하지 않습니다.
                const sel = window.getSelection();
                const hasText = sel && !sel.isCollapsed && sel.toString().trim().length > 0;

                if (e.button === 2 && (hasText || selectedIndices?.has(globalIndex))) {
                    return;
                }

                // 형님, 일반 드래그 시에는 브라우저 선택을 막아야 깔끔한 줄 선택이 됩니다.
                if (e.button === 0) {
                    e.preventDefault();
                    isDraggingRef.current = true;
                }
                onLineClick(globalIndex, e.shiftKey, e.ctrlKey || e.metaKey);
            }
        } else if (type === 'enter' && isDraggingRef.current && onLineClick) {
            // 드래그 중인 라인에 마우스가 들어오면 자동으로 선택 범위를 확장합니다.
            onLineClick(lineIndex + (absoluteOffset || 0), true, false);
        } else if (type === 'dbclick' && onLineDoubleClick) {
            onLineDoubleClick(lineIndex + (absoluteOffset || 0));
        }
    };



    return (
        <div
            ref={containerRef}
            // 🎯 형님, 컨테이너 배경색을 `bg-white dark:bg-slate-950` 대신 캔버스와 동일한 
            // `#020617`(Slate-950 HEX)로 고정시켜 리사이즈 지연 시에도 흰색으로 번쩍이지 못하게 원천 봉쇄해버립니다! 🐧🛡️
            className="flex-1 relative overflow-hidden bg-[#020617] font-mono hyper-log-container"
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
                    pointer-events: auto; /* ✅ Block selection behind gutter */
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
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
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
                        const fontFamily = preferences?.fontFamily || MONO_FONT_STACK;

                        return (
                            <div
                                key={index}
                                className="absolute select-text whitespace-pre overflow-hidden pointer-events-auto active:bg-indigo-500/5 hover:bg-slate-500/5 interaction-line"
                                style={{
                                    top: index * rowHeight,
                                    left: CONTENT_X_OFFSET, // ✅ Fixed: Horizontal scroll handled by browser
                                    width: stableScrollWidth ? stableScrollWidth - CONTENT_X_OFFSET : '100%',
                                    height: rowHeight,
                                    lineHeight: `${rowHeight}px`,
                                    fontSize: `${fontSize}px`,
                                    fontFamily: fontFamily,
                                    fontWeight: DEFAULT_FONT_WEIGHT,
                                    letterSpacing: '0px',
                                    wordSpacing: '0px',
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
                            >{(line?.decodedContent || decodeHTMLEntities(line?.content || '')) + '\n'}</div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}));
HyperLogRenderer.displayName = 'HyperLogRenderer';
