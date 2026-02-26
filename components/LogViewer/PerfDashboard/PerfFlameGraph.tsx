import React, { useRef, useEffect, useState } from 'react';
import { AnalysisResult, AnalysisSegment } from '../../../utils/perfAnalysis';

interface MousePos {
    x: number;
    y: number;
    time: number;
}

interface PerfFlameGraphProps {
    result: AnalysisResult;
    flameSegments: AnalysisSegment[];
    maxLane: number;
    laneTidMap: Map<number, string>;
    palette: string[];
    trimRange: { startTime: number; endTime: number; } | null;
    flameZoom: { startTime: number; endTime: number; } | null;
    applyZoom: (zoom: { startTime: number; endTime: number; } | null) => void;

    isShiftPressed: boolean;
    searchQuery: string;
    checkSegmentMatch: (s: AnalysisSegment, query: string) => boolean | null;
    showOnlyFail: boolean;
    lockedTid: string | null;
    selectedTid: string | null;

    selectedSegmentId: string | null;
    setSelectedSegmentId: (id: string | null) => void;
    multiSelectedIds: string[];
    setMultiSelectedIds: (ids: string[]) => void;

    onJumpToRange?: (startLine: number, endLine: number) => void;
    onViewRawRange?: (startLine: number, endLine: number, highlightLine?: number) => void;

    isActive: boolean;
    isOpen: boolean;
    setIsInitialDrawComplete: (complete: boolean) => void;
    exportCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const PerfFlameGraph: React.FC<PerfFlameGraphProps> = ({
    result,
    flameSegments,
    maxLane,
    laneTidMap,
    palette,
    trimRange,
    flameZoom,
    applyZoom,
    isShiftPressed,
    searchQuery,
    checkSegmentMatch,
    showOnlyFail,
    lockedTid,
    selectedTid,
    selectedSegmentId,
    setSelectedSegmentId,
    multiSelectedIds,
    setMultiSelectedIds,
    onJumpToRange,
    onViewRawRange,
    isActive,
    isOpen,
    setIsInitialDrawComplete,
    exportCanvasRef
}) => {
    const internalCanvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = exportCanvasRef || internalCanvasRef;
    const rectCacheRef = useRef<DOMRect | null>(null);
    const isDirtyRef = useRef(true);
    const zoomRef = useRef(flameZoom);
    const isActiveRef = useRef(isActive);

    const panStartRef = useRef<{ clientX: number; viewStart: number; viewEnd: number } | null>(null);

    const [mousePos, setMousePos] = useState<MousePos | null>(null);
    const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

    useEffect(() => { zoomRef.current = flameZoom; }, [flameZoom]);
    useEffect(() => {
        isActiveRef.current = isActive;
        if (isActive) isDirtyRef.current = true;
    }, [isActive]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const observer = new ResizeObserver(() => {
            rectCacheRef.current = null;
            isDirtyRef.current = true;
        });
        observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (result) setIsInitialDrawComplete(false);
    }, [result, setIsInitialDrawComplete]);

    useEffect(() => {
        if (isOpen) {
            rectCacheRef.current = null;
            isDirtyRef.current = true;
        }
    }, [isOpen]);

    useEffect(() => {
        rectCacheRef.current = null;
        isDirtyRef.current = true;
    }, [showOnlyFail, maxLane, trimRange]);

    useEffect(() => {
        isDirtyRef.current = true;
    }, [
        result, flameZoom, selectedSegmentId, hoveredSegmentId, mousePos,
        searchQuery, multiSelectedIds, lockedTid, isShiftPressed
    ]);

    const resultRef = useRef(result);
    useEffect(() => { resultRef.current = result; }, [result]);

    const drawCrosshair = (ctx: CanvasRenderingContext2D, width: number, height: number, viewStart: number, viewDuration: number) => {
        if (!mousePos) return;

        const x = ((mousePos.time - viewStart) / viewDuration) * width;
        if (x < 0 || x > width) return;

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    const drawFlameChart = (): boolean => {
        const canvas = canvasRef.current;
        if (!canvas || !resultRef.current) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const currentResult = resultRef.current;
        const dpr = window.devicePixelRatio || 1;
        const rect = rectCacheRef.current ?? canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            rectCacheRef.current = rect;
        } else {
            requestAnimationFrame(() => { isDirtyRef.current = true; });
            return false;
        }

        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const viewStart = zoomRef.current?.startTime ?? (trimRange?.startTime ?? currentResult.startTime);
        const viewEnd = zoomRef.current?.endTime ?? (trimRange?.endTime ?? currentResult.endTime);
        const viewDuration = Math.max(1, viewEnd - viewStart);
        const width = rect.width;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, rect.width, rect.height);

        const visibleSegments = flameSegments.filter(s => s.endTime >= viewStart && s.startTime <= viewEnd);
        const pixelGrid = new Map<string, { x: number, y: number, w: number, color: string }>();

        visibleSegments.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 3 : 0.5, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;
            const h = 20;

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isHovered = s.id === hoveredSegmentId;
            const isMatch = searchQuery !== '' && checkSegmentMatch(s, searchQuery);
            const isGlobal = s.tid === 'Global';

            if (isSelected || isHovered || isMatch || w > 3) {
                const isBottleneck = s.duration >= (currentResult.perfThreshold || 1000);
                const isFail = s.duration >= (currentResult.perfThreshold || 1000);
                const effectiveSelectedTid = lockedTid || selectedTid;
                const isTidFocused = effectiveSelectedTid !== null && s.tid === effectiveSelectedTid;

                let baseOpacity = (isSelected || isMatch || isHovered) ? 1 : (isGlobal ? 0.35 : 0.9);
                if (effectiveSelectedTid !== null && !isTidFocused) baseOpacity *= (lockedTid ? 0.1 : 0.3);
                if (showOnlyFail && !isFail) baseOpacity = Math.min(baseOpacity, 0.12);
                const finalOpacity = searchQuery !== '' ? (isMatch ? baseOpacity : 0.1) : baseOpacity;

                const baseColor = (isSelected || isMatch) ? '#6366f1' : (s.dangerColor || (isBottleneck ? '#be123c' : palette[s.lane % palette.length]));

                ctx.globalAlpha = finalOpacity;
                ctx.fillStyle = baseColor;

                ctx.beginPath();
                if (w > 1.5) {
                    ctx.roundRect(x, y, w, h, isGlobal ? 2 : 4);
                } else {
                    ctx.rect(x, y, w, h);
                }
                ctx.fill();

                if (isSelected || isHovered || isMatch) {
                    ctx.strokeStyle = isGlobal ? '#f59e0b' : 'white';
                    ctx.lineWidth = isSelected ? 2 : 1;
                    ctx.stroke();
                }
            } else {
                const pixX = Math.floor(x * 2) / 2;
                const key = `${s.lane}-${pixX}`;
                const isBottleneck = s.duration >= (currentResult.perfThreshold || 1000);
                const baseColor = (s.dangerColor || (isBottleneck ? '#be123c' : palette[s.lane % palette.length]));
                if (!pixelGrid.has(key) || isBottleneck) {
                    pixelGrid.set(key, { x, y, w: Math.max(0.5, w), color: baseColor });
                } else {
                    const existing = pixelGrid.get(key)!;
                    existing.w = Math.max(existing.w, (x + w) - existing.x);
                }
            }
        });

        // Fail Only opacity override for dense segments
        ctx.globalAlpha = showOnlyFail ? 0.2 : 0.9;
        pixelGrid.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, Math.max(0.5, p.w), 20);
        });
        ctx.globalAlpha = 1;

        // --- Segment Name Text Rendering ---
        ctx.font = `bold 9px 'Inter', system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        visibleSegments.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 3 : 0.5, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;
            const h = 20;

            if (w < 30) return; // too narrow to render text

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isMatch = searchQuery !== '' && checkSegmentMatch(s, searchQuery);
            const isFail = s.duration >= (currentResult.perfThreshold || 1000);
            const isGlobal = s.tid === 'Global';

            // Skip very faded segments
            const effectiveSelectedTid = lockedTid || selectedTid;
            let opacity = isGlobal ? 0.35 : 0.9;
            if (effectiveSelectedTid && s.tid !== effectiveSelectedTid) opacity *= (lockedTid ? 0.1 : 0.3);
            if (showOnlyFail && !isFail) opacity = Math.min(opacity, 0.12);
            if (searchQuery !== '' && !isMatch) opacity = 0.1;
            if (opacity < 0.15) return;

            const PAD = 5;
            const maxTextW = w - PAD * 2;
            if (maxTextW < 10) return;

            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();

            ctx.globalAlpha = Math.min(1, opacity * 1.5);
            ctx.fillStyle = (isSelected || isMatch || isFail) ? '#fff' : 'rgba(255,255,255,0.85)';
            const name = s.name || '';
            ctx.fillText(name, x + PAD, y + h / 2, maxTextW);
            ctx.restore();
        });

        drawCrosshair(ctx, width, rect.height, viewStart, viewDuration);
        ctx.globalAlpha = 1;
        return true;
    };

    const drawFlameChartRef = useRef<() => boolean>(() => true);
    drawFlameChartRef.current = drawFlameChart;

    useEffect(() => {
        let frameId: number;
        let running = true;

        const render = () => {
            if (!running) return;

            if (isActiveRef.current && isDirtyRef.current && resultRef.current) {
                const flameSuccess = drawFlameChartRef.current();
                if (flameSuccess !== false) {
                    isDirtyRef.current = false;
                    setIsInitialDrawComplete(true);
                }
            }

            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);
        return () => {
            running = false;
            cancelAnimationFrame(frameId);
        };
    }, [setIsInitialDrawComplete]);

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isShiftPressed || !resultRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentResult = resultRef.current;
        const viewStart = zoomRef.current?.startTime ?? (trimRange?.startTime ?? currentResult.startTime);
        const viewEnd = zoomRef.current?.endTime ?? (trimRange?.endTime ?? currentResult.endTime);
        const viewDuration = Math.max(1, viewEnd - viewStart);
        const width = rect.width;

        let found = null;
        let globalFallback = null;

        for (let i = flameSegments.length - 1; i >= 0; i--) {
            const s = flameSegments[i];
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 3 : 0.5, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;

            if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + 20) {
                if (s.tid === 'Global') {
                    globalFallback = s;
                } else {
                    found = s;
                    break;
                }
            }
        }

        const target = found || globalFallback;
        if (target?.id !== hoveredSegmentId) {
            setHoveredSegmentId(target?.id || null);
        }

        const time = viewStart + (mouseX / width) * viewDuration;
        setMousePos({ x: mouseX, y: mouseY, time });
    };

    const handleCanvasMouseLeave = () => {
        setMousePos(null);
        setHoveredSegmentId(null);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isShiftPressed || !resultRef.current) return;
        if (hoveredSegmentId) {
            setSelectedSegmentId(hoveredSegmentId);
            setMultiSelectedIds([]);
            const s = resultRef.current.segments.find(seg => seg.id === hoveredSegmentId);
            if (s && onJumpToRange) onJumpToRange(s.startLine, s.endLine);
        } else {
            setSelectedSegmentId(null);
            setMultiSelectedIds([]);
        }
    };

    const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isShiftPressed || !resultRef.current || !hoveredSegmentId) return;
        const s = resultRef.current.segments.find(seg => seg.id === hoveredSegmentId);
        if (s && onViewRawRange) {
            onViewRawRange(s.originalStartLine || s.startLine, s.originalEndLine || s.endLine, s.startLine + 1);
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button !== 0 || isShiftPressed || !resultRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const currentResult = resultRef.current;
        const viewStart = zoomRef.current?.startTime ?? (trimRange?.startTime ?? currentResult.startTime);
        const viewEnd = zoomRef.current?.endTime ?? (trimRange?.endTime ?? currentResult.endTime);
        const viewDuration = Math.max(1, viewEnd - viewStart);
        const width = rect.width;

        let onSegment = false;
        for (let i = flameSegments.length - 1; i >= 0; i--) {
            const s = flameSegments[i];
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 3 : 0.5, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;
            if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + 20) {
                onSegment = true;
                break;
            }
        }
        if (!onSegment) {
            panStartRef.current = { clientX: e.clientX, viewStart, viewEnd };
            e.currentTarget.style.cursor = 'grabbing';
        }
    };

    const handleCanvasPanMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!panStartRef.current || !resultRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dx = e.clientX - panStartRef.current.clientX;
        const { viewStart, viewEnd } = panStartRef.current;
        const dur = viewEnd - viewStart;
        const panAmount = -(dx / rect.width) * dur;
        let newStart = viewStart + panAmount;
        let newEnd = viewEnd + panAmount;
        const currentResult = resultRef.current;
        const boundStart = trimRange?.startTime ?? currentResult.startTime;
        const boundEnd = trimRange?.endTime ?? currentResult.endTime;
        if (newStart < boundStart) { newStart = boundStart; newEnd = newStart + dur; }
        if (newEnd > boundEnd) { newEnd = boundEnd; newStart = newEnd - dur; }
        applyZoom({ startTime: newStart, endTime: newEnd });
    };

    const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (panStartRef.current) {
            panStartRef.current = null;
            e.currentTarget.style.cursor = '';
        }
    };

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={(e) => {
                handleCanvasPanMove(e);
                handleCanvasMouseMove(e);
            }}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={(e) => {
                handleCanvasMouseLeave();
                handleCanvasMouseUp(e);
            }}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            style={{
                pointerEvents: isShiftPressed ? 'none' : 'auto',
                cursor: panStartRef.current ? 'grabbing' : 'default'
            }}
        />
    );
};
