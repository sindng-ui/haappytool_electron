import { AnalysisResult, AnalysisSegment } from '../../../../utils/perfAnalysis';

export interface DrawOptions {
    viewStart: number;
    viewDuration: number;
    width: number;
    height: number;
    palette: string[];
    searchQuery: string;
    checkSegmentMatch: (s: AnalysisSegment, query: string, tags?: string[]) => boolean | null;
    showOnlyFail: boolean;
    lockedTid: string | null;
    selectedTid: string | null;
    selectedSegmentId: string | null;
    multiSelectedIds: string[];
    hoveredSegmentId: string | null;
    perfThreshold: number;
    mousePos: { time: number } | null;
    activeTags?: string[];
}

export class PerfFlameGraphRenderer {
    static drawCrosshair(
        ctx: CanvasRenderingContext2D,
        options: Pick<DrawOptions, 'mousePos' | 'viewStart' | 'viewDuration' | 'width' | 'height'>
    ) {
        const { mousePos, viewStart, viewDuration, width, height } = options;
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
    }

    static drawFlameChart(
        ctx: CanvasRenderingContext2D,
        result: AnalysisResult,
        flameSegments: AnalysisSegment[],
        options: DrawOptions
    ) {
        const {
            viewStart, viewDuration, width, height, palette,
            searchQuery, checkSegmentMatch, showOnlyFail,
            lockedTid, selectedTid, selectedSegmentId, multiSelectedIds,
            hoveredSegmentId, perfThreshold, mousePos, activeTags = []
        } = options;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        const viewEnd = viewStart + viewDuration;
        const visibleSegments = flameSegments.filter(s => s.endTime >= viewStart && s.startTime <= viewEnd);
        const pixelGrid = new Map<string, { x: number, y: number, w: number, color: string }>();

        visibleSegments.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 3 : 0.5, (s.duration / viewDuration) * width);
            const y = s.lane * 28 + 24;
            const h = 20;

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isHovered = s.id === hoveredSegmentId;
            const isMatch = (searchQuery !== '' || activeTags.length > 0) && checkSegmentMatch(s, searchQuery, activeTags);
            const isGlobal = s.tid === 'Global';

            if (isSelected || isHovered || isMatch || w > 3) {
                const isFail = s.duration >= (perfThreshold || 1000);
                const effectiveSelectedTid = lockedTid || selectedTid;
                const isTidFocused = effectiveSelectedTid !== null && s.tid === effectiveSelectedTid;

                let baseOpacity = (isSelected || isMatch || isHovered) ? 1 : (isGlobal ? 0.35 : 0.9);
                if (effectiveSelectedTid !== null && !isTidFocused) baseOpacity *= (lockedTid ? 0.1 : 0.3);

                // [SpeedScope Requirement] Fail Only mode: highlight only fails
                if (showOnlyFail && !isFail) baseOpacity = Math.min(baseOpacity, 0.08);

                // [SpeedScope Requirement] Keyword Search mode: highlight only matches
                if ((searchQuery !== '' || activeTags.length > 0) && !isMatch) {
                    baseOpacity = Math.min(baseOpacity, 0.08);
                }

                const finalOpacity = baseOpacity;

                const baseColor = (isSelected || isMatch) ? '#6366f1' : (s.dangerColor || (isFail ? '#be123c' : palette[s.lane % palette.length]));

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
                const isFail = s.duration >= (perfThreshold || 1000);
                const baseColor = (s.dangerColor || (isFail ? '#be123c' : palette[s.lane % palette.length]));
                if (!pixelGrid.has(key) || isFail) {
                    pixelGrid.set(key, { x, y, w: Math.max(0.5, w), color: baseColor });
                } else {
                    const existing = pixelGrid.get(key)!;
                    existing.w = Math.max(existing.w, (x + w) - existing.x);
                }
            }
        });

        // Fail Only opacity override for dense segments
        ctx.globalAlpha = (showOnlyFail || searchQuery !== '' || activeTags.length > 0) ? 0.1 : 0.9;
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

            if (w < 30) return;

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isMatch = (searchQuery !== '' || activeTags.length > 0) && checkSegmentMatch(s, searchQuery, activeTags);
            const isFail = s.duration >= (perfThreshold || 1000);
            const isGlobal = s.tid === 'Global';

            const effectiveSelectedTid = lockedTid || selectedTid;
            let opacity = isGlobal ? 0.35 : 0.9;
            if (effectiveSelectedTid && s.tid !== effectiveSelectedTid) opacity *= (lockedTid ? 0.1 : 0.3);
            if (showOnlyFail && !isFail) opacity = Math.min(opacity, 0.08);
            if ((searchQuery !== '' || activeTags.length > 0) && !isMatch) opacity = 0.08;
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

            let displayName = s.name || '';
            if (s.fileName && s.functionName) {
                displayName = `${s.fileName}: ${s.functionName}(${s.startLine})`;
            } else if (s.fileName) {
                displayName = `${s.fileName}(${s.startLine})`;
            }

            ctx.fillText(displayName, x + PAD, y + h / 2, maxTextW);
            ctx.restore();
        });

        this.drawCrosshair(ctx, { mousePos, viewStart, viewDuration, width, height });
    }
}
