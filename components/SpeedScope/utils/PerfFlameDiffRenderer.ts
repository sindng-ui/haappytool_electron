import { AnalysisResult } from '../../../utils/perfAnalysis';
import { DiffSegment, getDiffColor } from '../../../utils/performanceDiff';

export interface DiffDrawOptions {
    viewStart: number;
    viewDuration: number;
    width: number;
    height: number;
    searchTerms: string[];
    checkSegmentMatch: (s: any, currentActiveTags: string[]) => boolean;
    selectedSegmentId: string | null;
    multiSelectedIds: string[];
    hoveredSegmentId: string | null;
    mousePos: { time: number } | null;
    activeTags?: string[];
    ticks?: number[];
    highlightName?: string | null;
}

export class PerfFlameDiffRenderer {
    static drawFlameChart(
        ctx: CanvasRenderingContext2D,
        targetResult: AnalysisResult,
        diffSegments: DiffSegment[],
        options: DiffDrawOptions
    ) {
        const {
            viewStart, viewDuration, width, height,
            searchTerms, checkSegmentMatch,
            selectedSegmentId, multiSelectedIds,
            hoveredSegmentId, mousePos, activeTags = [],
            highlightName = null
        } = options;

        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, width, height);

        const viewEnd = viewStart + viewDuration;
        const visibleSegments = diffSegments.filter(s => s.endTime >= viewStart && s.startTime <= viewEnd);

        visibleSegments.forEach(s => {
            const x = ((s.startTime - viewStart) / viewDuration) * width;
            const w = Math.max(s.duration === 0 ? 3 : 0.5, (s.duration / viewDuration) * width);
            const y = (s.lane || 0) * 24 + 40;
            const h = 22;

            const isSelected = s.id === selectedSegmentId || multiSelectedIds.includes(s.id);
            const isHovered = s.id === hoveredSegmentId;
            const isMatch = (searchTerms.length > 0 || activeTags.length > 0) && checkSegmentMatch(s, []);

            let baseOpacity = (isSelected || isHovered) ? 1 : 0.85;
            if ((searchTerms.length > 0 || activeTags.length > 0) && !isMatch) {
                baseOpacity = 0.1;
            }
            if (highlightName && s.name !== highlightName) {
                baseOpacity = 0.05;
            }

            const baseColor = isSelected ? '#6366f1' : getDiffColor(s);

            ctx.globalAlpha = baseOpacity;
            ctx.fillStyle = baseColor;

            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();

            if (isSelected || isHovered) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.stroke();
            }

            // Draw text if wide enough
            if (w > 40 && baseOpacity > 0.3) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(x, y, w, h);
                ctx.clip();
                
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold 10px 'Inter', sans-serif`;
                ctx.textBaseline = 'middle';
                
                let label = s.name;
                if (s.delta !== 0) {
                    const sign = s.delta > 0 ? '+' : '';
                    label += ` (${sign}${Math.round(s.delta)}ms)`;
                }
                
                ctx.fillText(label, x + 5, y + h / 2);
                ctx.restore();
            }
        });

        ctx.globalAlpha = 1;
        
        // Draw Ticks (Simple)
        if (options.ticks) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            options.ticks.forEach(t => {
                const x = ((t - viewStart) / viewDuration) * width;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            });
            ctx.stroke();
        }
    }
}
