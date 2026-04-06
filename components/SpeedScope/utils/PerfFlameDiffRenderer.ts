import { AnalysisResult } from '../../../utils/perfAnalysis';
import { DiffSegment, getDiffColor } from '../../../utils/performanceDiff';

export interface DiffDrawOptions {
    viewStart: number;
    viewDuration: number;
    width: number;
    height: number;
    selectedSegmentId: string | null;
    multiSelectedIds: string[];
    hoveredSegmentId: string | null;
    mousePos: { x: number; y: number; time: number } | null;
    ticks?: number[];
    highlightName?: string | null;
    /** Base-only removed segments to ghost-render */
    removedSegments?: DiffSegment[];
}

const LANE_H = 22;
const LANE_GAP = 2;
const LANE_STRIDE = LANE_H + LANE_GAP;
const HEADER_H = 28; // space for timeline axis

/** Format milliseconds compactly */
const fmtMs = (ms: number): string => {
    if (Math.abs(ms) >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    if (Math.abs(ms) >= 1) return `${ms.toFixed(0)}ms`;
    return `${ms.toFixed(2)}ms`;
};

/** Format delta with sign */
const fmtDelta = (delta: number): string => {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${fmtMs(delta)}`;
};

export class PerfFlameDiffRenderer {

    // ── Timeline Axis ───────────────────────────────────────────────────────
    static drawTimeline(
        ctx: CanvasRenderingContext2D,
        ticks: number[],
        viewStart: number,
        viewDuration: number,
        width: number
    ) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, HEADER_H);

        ctx.font = `500 9px 'Inter', monospace`;
        ctx.fillStyle = 'rgba(148,163,184,0.8)';
        ctx.textBaseline = 'middle';

        // Border line below header
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, HEADER_H);
        ctx.lineTo(width, HEADER_H);
        ctx.stroke();

        ticks.forEach(t => {
            const x = ((t - viewStart) / viewDuration) * width;
            if (x < 5 || x > width - 5) return;

            // Tick mark
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, HEADER_H - 6);
            ctx.lineTo(x, HEADER_H);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(148,163,184,0.7)';
            ctx.textAlign = 'center';
            ctx.fillText(fmtMs(t - ticks[0]), x, HEADER_H / 2 - 1);
        });
        ctx.textAlign = 'left';
    }

    // ── Vertical Grid ───────────────────────────────────────────────────────
    static drawGrid(
        ctx: CanvasRenderingContext2D,
        ticks: number[],
        viewStart: number,
        viewDuration: number,
        width: number,
        height: number
    ) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ticks.forEach(t => {
            const x = ((t - viewStart) / viewDuration) * width;
            ctx.moveTo(x, HEADER_H);
            ctx.lineTo(x, height);
        });
        ctx.stroke();
    }

    // ── Crosshair ───────────────────────────────────────────────────────────
    static drawCrosshair(
        ctx: CanvasRenderingContext2D,
        mousePos: { x: number; y: number; time: number } | null,
        viewStart: number,
        viewDuration: number,
        width: number,
        height: number
    ) {
        if (!mousePos) return;
        const x = ((mousePos.time - viewStart) / viewDuration) * width;
        if (x < 0 || x > width) return;

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(99,102,241,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, HEADER_H);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ── Main draw ───────────────────────────────────────────────────────────
    static drawFlameChart(
        ctx: CanvasRenderingContext2D,
        _targetResult: AnalysisResult,
        diffSegments: DiffSegment[],
        options: DiffDrawOptions
    ) {
        const {
            viewStart, viewDuration, width, height,
            selectedSegmentId, multiSelectedIds,
            hoveredSegmentId, mousePos,
            highlightName = null,
            removedSegments = [],
        } = options;

        // Background
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, width, height);

        const viewEnd = viewStart + viewDuration;
        const ticks = options.ticks ?? [];

        this.drawGrid(ctx, ticks, viewStart, viewDuration, width, height);

        // ── Draw target diff segments ──────────────────────────────────────
        const visible = diffSegments.filter(
            s => s.endTime >= viewStart && s.startTime <= viewEnd
        );

        visible.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const rawW = (s.duration / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 2 : 0.5, rawW);
            const y = (s.lane ?? 0) * LANE_STRIDE + HEADER_H;

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isHovered = s.id === hoveredSegmentId;
            const isDimmed = highlightName !== null && s.name !== highlightName;

            const baseColor = isSelected ? '#6366f1' : getDiffColor(s);
            let alpha = isSelected || isHovered ? 1 : isDimmed ? 0.08 : 0.88;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y, w, LANE_H);

            if (isSelected || isHovered) {
                ctx.strokeStyle = isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.6)';
                ctx.lineWidth = isSelected ? 1.5 : 1;
                ctx.strokeRect(x, y, w, LANE_H);
            }

            // Text label (only if wide enough)
            if (w >= 30 && alpha > 0.2) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(x + 1, y, w - 2, LANE_H);
                ctx.clip();

                ctx.globalAlpha = Math.min(1, alpha * 1.5);
                ctx.fillStyle = '#ffffff';
                ctx.font = `600 10px 'Inter', system-ui, sans-serif`;
                ctx.textBaseline = 'middle';

                const displayName = s.functionName || s.name;
                let label = w > 120 && s.delta !== undefined && Math.abs(s.delta) > 0.5
                    ? `${displayName} (${fmtDelta(s.delta)})`
                    : displayName;

                ctx.fillText(label, x + 4, y + LANE_H / 2);
                ctx.restore();
            }
        });

        // ── Draw removed (ghost) segments ──────────────────────────────────
        const visibleRemoved = removedSegments.filter(
            s => s.endTime >= viewStart && s.startTime <= viewEnd
        );
        visibleRemoved.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(2, (s.duration / viewDuration) * width);
            const y = (s.lane ?? 0) * LANE_STRIDE + HEADER_H;

            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(x, y, w, LANE_H);
            ctx.setLineDash([]);

            if (w > 30) {
                ctx.fillStyle = '#9ca3af';
                ctx.font = `italic 9px 'Inter', sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.fillText(`[removed] ${s.functionName || s.name}`, x + 4, y + LANE_H / 2);
            }
        });

        ctx.globalAlpha = 1;

        this.drawTimeline(ctx, ticks, viewStart, viewDuration, width);
        this.drawCrosshair(ctx, mousePos, viewStart, viewDuration, width, height);
    }
}
