import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { AnalysisResult } from '../../utils/perfAnalysis';
import { DiffSegment } from '../../utils/performanceDiff';
import { PerfFlameDiffRenderer } from './utils/PerfFlameDiffRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ZoomRange { startTime: number; endTime: number; }
interface MousePos { x: number; y: number; time: number; }

interface TooltipInfo {
    x: number;
    y: number;
    segment: DiffSegment;
}

interface PerfFlameDiffProps {
    targetResult: AnalysisResult;
    diffSegments: DiffSegment[];
    removedSegments?: DiffSegment[];
    highlightName?: string | null;
    isActive: boolean;
    onSegmentSelect?: (seg: DiffSegment | null) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LANE_STRIDE = 24; // must match renderer
const HEADER_H = 28;
const MIN_ZOOM_DURATION = 0.1; // ms – prevent over-zoom
const FMT = (ms: number) => {
    if (Math.abs(ms) >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    if (Math.abs(ms) >= 1) return `${ms.toFixed(2)}ms`;
    return `${ms.toFixed(3)}ms`;
};
const SIGN = (v: number) => (v > 0 ? '+' : '');

// ─── Hit-test ─────────────────────────────────────────────────────────────────
function hitTest(
    mx: number, my: number,
    segments: DiffSegment[],
    viewStart: number, viewDuration: number, width: number
): DiffSegment | null {
    for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i];
        const x = ((s.startTime - viewStart) / viewDuration) * width;
        const w = Math.max(2, (s.duration / viewDuration) * width);
        const y = (s.lane ?? 0) * LANE_STRIDE + HEADER_H;
        if (mx >= x && mx <= x + w && my >= y && my <= y + 22) return s;
    }
    return null;
}

// ─── Tick generator ───────────────────────────────────────────────────────────
function generateTicks(start: number, end: number): number[] {
    const dur = Math.max(1, end - start);
    const rawStep = dur / 8;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    let step = magnitude;
    if (rawStep / magnitude >= 5) step = magnitude * 5;
    else if (rawStep / magnitude >= 2) step = magnitude * 2;
    if (step < 0.001) step = 0.001;
    const first = Math.ceil(start / step) * step;
    const ticks: number[] = [];
    for (let t = first; t <= end + step * 0.01; t += step) ticks.push(t);
    return ticks;
}

// ─── Tooltip Component ────────────────────────────────────────────────────────
const Tooltip: React.FC<{ info: TooltipInfo; canvasW: number; canvasH: number }> = ({
    info, canvasW, canvasH
}) => {
    const { x, y, segment: s } = info;
    const tipW = 240;
    const tipH = 130;
    const left = x + tipW > canvasW ? x - tipW - 8 : x + 12;
    const top  = y + tipH > canvasH ? y - tipH - 8 : y + 12;

    const statusColors: Record<string, string> = {
        slower: '#f87171', faster: '#60a5fa',
        added: '#34d399', removed: '#9ca3af', neutral: '#94a3b8',
    };
    const statusColor = statusColors[s.diffStatus] ?? '#94a3b8';

    return (
        <div
            className="absolute z-50 pointer-events-none"
            style={{ left, top, width: tipW }}
        >
            <div className="bg-[#0f172a]/95 backdrop-blur border border-white/10 rounded-lg shadow-xl p-2.5 text-[10px]">
                {/* Header */}
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
                    <span className="font-bold text-white text-[10px] leading-tight break-all">
                        {s.functionName || s.name}
                    </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-slate-400">Base</span>
                    <span className="text-right font-mono text-slate-200">
                        {s.baseDuration !== undefined ? FMT(s.baseDuration) : '—'}
                    </span>

                    <span className="text-slate-400">Target</span>
                    <span className="text-right font-mono text-slate-200">{FMT(s.duration)}</span>

                    <span className="text-slate-400">Delta</span>
                    <span className={`text-right font-mono font-bold ${
                        (s.delta ?? 0) > 0 ? 'text-rose-400' :
                        (s.delta ?? 0) < 0 ? 'text-blue-400' : 'text-slate-400'
                    }`}>
                        {s.delta !== undefined
                            ? `${SIGN(s.delta)}${FMT(s.delta)} (${SIGN(s.deltaPercent ?? 0)}${(s.deltaPercent ?? 0).toFixed(1)}%)`
                            : '—'}
                    </span>

                    {s.selfTime !== undefined && (
                        <>
                            <span className="text-slate-400">Self Time</span>
                            <span className="text-right font-mono text-slate-200">{FMT(s.selfTime)}</span>
                        </>
                    )}
                </div>

                {/* Status badge */}
                <div className="mt-2 pt-1.5 border-t border-white/5">
                    <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest"
                        style={{ background: statusColor + '22', color: statusColor }}
                    >
                        {s.diffStatus}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const PerfFlameDiff: React.FC<PerfFlameDiffProps> = ({
    targetResult,
    diffSegments,
    removedSegments = [],
    highlightName = null,
    isActive,
    onSegmentSelect,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // State
    const [zoom, setZoom] = useState<ZoomRange | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState<MousePos | null>(null);
    const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

    // Refs for rAF loop
    const isDirtyRef = useRef(true);
    const isActiveRef = useRef(isActive);
    const zoomRef = useRef(zoom);
    const stateRef = useRef({ selectedId, hoveredId, mousePos, highlightName, zoom });
    const panStartRef = useRef<{ clientX: number; viewStart: number; viewEnd: number } | null>(null);

    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
    useEffect(() => {
        zoomRef.current = zoom;
        stateRef.current = { selectedId, hoveredId, mousePos, highlightName, zoom };
        isDirtyRef.current = true;
    }, [zoom, selectedId, hoveredId, mousePos, highlightName]);

    useEffect(() => { isDirtyRef.current = true; }, [diffSegments, removedSegments]);

    // Derived view range
    const viewStart = zoom?.startTime ?? targetResult.startTime;
    const viewEnd   = zoom?.endTime   ?? targetResult.endTime;
    const viewDuration = Math.max(MIN_ZOOM_DURATION, viewEnd - viewStart);

    const ticks = useMemo(() => generateTicks(viewStart, viewEnd), [viewStart, viewEnd]);

    // ── ResizeObserver ────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => {
            isDirtyRef.current = true;
            const r = canvas.getBoundingClientRect();
            setCanvasSize({ w: r.width, h: r.height });
        });
        ro.observe(canvas);
        return () => ro.disconnect();
    }, []);

    // ── rAF render loop ───────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let frameId: number;
        let running = true;

        const draw = () => {
            if (!running) return;
            if (isActiveRef.current && isDirtyRef.current) {
                const ctx = canvas.getContext('2d');
                const dpr = window.devicePixelRatio || 1;
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    if (canvas.width !== Math.round(rect.width * dpr) ||
                        canvas.height !== Math.round(rect.height * dpr)) {
                        canvas.width = Math.round(rect.width * dpr);
                        canvas.height = Math.round(rect.height * dpr);
                    }
                    if (ctx) {
                        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                        const s = stateRef.current;
                        const vStart = s.zoom?.startTime ?? targetResult.startTime;
                        const vDur = Math.max(MIN_ZOOM_DURATION,
                            (s.zoom?.endTime ?? targetResult.endTime) - vStart);
                        PerfFlameDiffRenderer.drawFlameChart(ctx, targetResult, diffSegments, {
                            viewStart: vStart,
                            viewDuration: vDur,
                            width: rect.width,
                            height: rect.height,
                            selectedSegmentId: s.selectedId,
                            multiSelectedIds: [],
                            hoveredSegmentId: s.hoveredId,
                            mousePos: s.mousePos,
                            ticks: generateTicks(vStart, vStart + vDur),
                            highlightName: s.highlightName,
                            removedSegments,
                        });
                        isDirtyRef.current = false;
                    }
                }
            }
            frameId = requestAnimationFrame(draw);
        };
        frameId = requestAnimationFrame(draw);
        return () => { running = false; cancelAnimationFrame(frameId); };
    }, [targetResult, diffSegments, removedSegments]);

    // ── Mouse Handlers ────────────────────────────────────────────────────────
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const vStart = zoomRef.current?.startTime ?? targetResult.startTime;
        const vDur = Math.max(MIN_ZOOM_DURATION,
            (zoomRef.current?.endTime ?? targetResult.endTime) - vStart);

        // Pan
        if (panStartRef.current) {
            const dx = e.clientX - panStartRef.current.clientX;
            const { viewStart: pStart, viewEnd: pEnd } = panStartRef.current;
            const dur = pEnd - pStart;
            const shift = -(dx / rect.width) * dur;
            let ns = pStart + shift;
            let ne = pEnd + shift;
            const totalStart = targetResult.startTime;
            const totalEnd = targetResult.endTime;
            if (ns < totalStart) { ns = totalStart; ne = totalStart + dur; }
            if (ne > totalEnd) { ne = totalEnd; ns = totalEnd - dur; }
            setZoom({ startTime: ns, endTime: ne });
        }

        const time = vStart + (mx / rect.width) * vDur;
        const mp: MousePos = { x: mx, y: my, time };
        setMousePos(mp);
        stateRef.current.mousePos = mp;
        isDirtyRef.current = true;

        // Hit test
        const hit = hitTest(mx, my, diffSegments, vStart, vDur, rect.width);
        setHoveredId(hit?.id ?? null);
        stateRef.current.hoveredId = hit?.id ?? null;

        if (hit) {
            setTooltip({ x: mx, y: my, segment: hit });
        } else {
            setTooltip(null);
        }
    }, [targetResult, diffSegments]);

    const handleMouseLeave = useCallback(() => {
        setMousePos(null);
        setHoveredId(null);
        setTooltip(null);
        panStartRef.current = null;
        stateRef.current.mousePos = null;
        stateRef.current.hoveredId = null;
        isDirtyRef.current = true;
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const vStart = zoomRef.current?.startTime ?? targetResult.startTime;
        const vDur = Math.max(MIN_ZOOM_DURATION,
            (zoomRef.current?.endTime ?? targetResult.endTime) - vStart);
        const hit = hitTest(mx, my, diffSegments, vStart, vDur, rect.width);
        if (!hit) {
            panStartRef.current = {
                clientX: e.clientX,
                viewStart: vStart,
                viewEnd: vStart + vDur,
            };
        }
    }, [targetResult, diffSegments]);

    const handleMouseUp = useCallback(() => {
        panStartRef.current = null;
    }, []);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const vStart = zoomRef.current?.startTime ?? targetResult.startTime;
        const vDur = Math.max(MIN_ZOOM_DURATION,
            (zoomRef.current?.endTime ?? targetResult.endTime) - vStart);
        const hit = hitTest(mx, my, diffSegments, vStart, vDur, rect.width);
        setSelectedId(hit?.id ?? null);
        stateRef.current.selectedId = hit?.id ?? null;
        isDirtyRef.current = true;
        onSegmentSelect?.(hit ?? null);
    }, [targetResult, diffSegments, onSegmentSelect]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;

        const vStart = zoomRef.current?.startTime ?? targetResult.startTime;
        const vEnd   = zoomRef.current?.endTime   ?? targetResult.endTime;
        const vDur = Math.max(MIN_ZOOM_DURATION, vEnd - vStart);

        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const pivotTime = vStart + (mx / rect.width) * vDur;

        let ns = pivotTime - (pivotTime - vStart) * factor;
        let ne = pivotTime + (vEnd - pivotTime) * factor;

        const totalStart = targetResult.startTime;
        const totalEnd   = targetResult.endTime;
        if (ne - ns < MIN_ZOOM_DURATION) { ne = ns + MIN_ZOOM_DURATION; }
        if (ns < totalStart) ns = totalStart;
        if (ne > totalEnd)   ne = totalEnd;

        setZoom({ startTime: ns, endTime: ne });
        zoomRef.current = { startTime: ns, endTime: ne };
        isDirtyRef.current = true;
    }, [targetResult]);

    const resetZoom = useCallback(() => {
        setZoom(null);
        zoomRef.current = null;
        isDirtyRef.current = true;
    }, []);

    const isZoomed = zoom !== null;

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: panStartRef.current ? 'grabbing' : 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onClick={handleClick}
                onWheel={handleWheel}
            />

            {/* Reset Zoom Button */}
            {isZoomed && (
                <button
                    onClick={resetZoom}
                    className="absolute bottom-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/90 border border-white/10 rounded-full text-[10px] font-bold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
                >
                    <span>⤢</span>
                    <span>Reset Zoom</span>
                </button>
            )}

            {/* Hover Tooltip */}
            {tooltip && (
                <Tooltip
                    info={tooltip}
                    canvasW={canvasSize.w || 800}
                    canvasH={canvasSize.h || 400}
                />
            )}
        </div>
    );
};
