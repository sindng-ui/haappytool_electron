import React, { useRef, useEffect, useState } from 'react';
import { AnalysisResult } from '../../utils/perfAnalysis';
import { DiffSegment, getDiffColor } from '../../utils/performanceDiff';
import { PerfFlameDiffRenderer } from './utils/PerfFlameDiffRenderer';

interface PerfFlameDiffProps {
    targetResult: AnalysisResult;
    diffSegments: DiffSegment[];
    maxLane: number;
    flameZoom: { startTime: number; endTime: number; } | null;
    applyZoom: (zoom: { startTime: number; endTime: number; } | null) => void;
    searchTerms: string[];
    checkSegmentMatch: (s: any, currentActiveTags: string[]) => boolean;
    selectedSegmentId: string | null;
    setSelectedSegmentId: (id: string | null) => void;
    multiSelectedIds: string[];
    setMultiSelectedIds: (ids: string[]) => void;
    isActive: boolean;
}

export const PerfFlameDiff: React.FC<PerfFlameDiffProps> = ({
    targetResult,
    diffSegments,
    maxLane,
    flameZoom,
    applyZoom,
    searchTerms,
    checkSegmentMatch,
    selectedSegmentId,
    setSelectedSegmentId,
    multiSelectedIds,
    setMultiSelectedIds,
    isActive
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState<{ time: number } | null>(null);

    const viewStart = flameZoom?.startTime ?? targetResult.startTime;
    const viewEnd = flameZoom?.endTime ?? targetResult.endTime;
    const viewDuration = Math.max(1, viewEnd - viewStart);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isActive) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const render = () => {
            PerfFlameDiffRenderer.drawFlameChart(ctx, targetResult, diffSegments, {
                viewStart,
                viewDuration,
                width: rect.width,
                height: rect.height,
                searchTerms,
                checkSegmentMatch,
                selectedSegmentId,
                multiSelectedIds,
                hoveredSegmentId,
                mousePos,
                ticks: generateTicks(viewStart, viewEnd)
            });
        };

        render();
    }, [
        isActive, diffSegments, viewStart, viewDuration, searchTerms, 
        selectedSegmentId, multiSelectedIds, hoveredSegmentId, mousePos
    ]);

    const generateTicks = (start: number, end: number) => {
        const dur = end - start;
        const step = dur / 10;
        const ticks = [];
        for (let t = start; t <= end; t += step) ticks.push(t);
        return ticks;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = viewStart + (x / rect.width) * viewDuration;
        
        setMousePos({ time });

        // Simple hit test
        const hit = diffSegments.find(s => {
            const sx = ((s.startTime - viewStart) / viewDuration) * rect.width;
            const sw = (s.duration / viewDuration) * rect.width;
            const sy = (s.lane || 0) * 24 + 40;
            return x >= sx && x <= sx + sw && y >= sy && y <= sy + 22;
        });
        setHoveredSegmentId(hit?.id || null);
    };

    const handleClick = () => {
        setSelectedSegmentId(hoveredSegmentId);
    };

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => { setMousePos(null); setHoveredSegmentId(null); }}
            onClick={handleClick}
        />
    );
};
