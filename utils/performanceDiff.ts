import { AnalysisResult, AnalysisSegment } from './perfAnalysis';

export interface DiffSegment extends AnalysisSegment {
    baseDuration?: number;
    delta?: number;
    deltaPercent?: number;
    diffStatus: 'added' | 'removed' | 'slower' | 'faster' | 'neutral';
}

export interface DiffAnalysisResult {
    targetResult: AnalysisResult;
    baseResult: AnalysisResult;
    diffSegments: DiffSegment[];
    globalStats: {
        totalDelta: number;
        improvedFunctions: string[];
        regressedFunctions: string[];
    };
}

/**
 * [PerformanceDiff] 
 * Matches segments from target result with base result to calculate performance deltas.
 */
export const comparePerformanceResults = (
    base: AnalysisResult,
    target: AnalysisResult
): DiffAnalysisResult => {
    
    const diffSegments: DiffSegment[] = [];
    const improvedFunctions: Set<string> = new Set();
    const regressedFunctions: Set<string> = new Set();
    let totalDelta = 0;

    // 1. Group base segments by Lane for faster matching
    const baseLanes = new Map<number, AnalysisSegment[]>();
    base.segments.forEach(s => {
        const lane = s.lane ?? 0;
        if (!baseLanes.has(lane)) baseLanes.set(lane, []);
        baseLanes.get(lane)!.push(s);
    });

    // 2. Iterate through target segments and find best matches in base
    target.segments.forEach(ts => {
        const lane = ts.lane ?? 0;
        const candidates = baseLanes.get(lane) || [];
        
        // Match heuristic: Same Name and closest startTime/position
        // In FlameGraphs, segments in the same lane usually appear in sequence.
        // We look for a segment with the same name that overlaps or is nearby.
        const match = candidates.find(bs => bs.name === ts.name && 
            Math.abs(bs.startTime - ts.startTime) < (base.totalDuration * 0.1)); // 10% tolerance

        let diffStatus: DiffSegment['diffStatus'] = 'neutral';
        let delta = 0;
        let deltaPercent = 0;
        let baseDuration = 0;

        if (match) {
            baseDuration = match.duration;
            delta = ts.duration - match.duration;
            deltaPercent = (delta / match.duration) * 100;

            if (delta > 5 && deltaPercent > 10) diffStatus = 'slower';
            else if (delta < -5 && deltaPercent < -10) diffStatus = 'faster';
            else diffStatus = 'neutral';

            totalDelta += delta;
            if (diffStatus === 'slower') regressedFunctions.add(ts.name);
            if (diffStatus === 'faster') improvedFunctions.add(ts.name);
        } else {
            diffStatus = 'added';
            delta = ts.duration;
            deltaPercent = 100;
        }

        diffSegments.push({
            ...ts,
            baseDuration,
            delta,
            deltaPercent,
            diffStatus
        });
    });

    return {
        targetResult: target,
        baseResult: base,
        diffSegments,
        globalStats: {
            totalDelta,
            improvedFunctions: Array.from(improvedFunctions),
            regressedFunctions: Array.from(regressedFunctions)
        }
    };
};

/**
 * Returns a color for a DiffSegment based on its status and delta magnitude.
 */
export const getDiffColor = (segment: DiffSegment): string => {
    switch (segment.diffStatus) {
        case 'added':
            return '#10b981'; // Green-500
        case 'slower': {
            // Intense red for larger deltas
            const intensity = Math.min(100, Math.abs(segment.deltaPercent || 0));
            return `hsl(0, ${40 + intensity * 0.6}%, ${40 - intensity * 0.15}%)`;
        }
        case 'faster': {
            // Intense blue for larger improvements
            const intensity = Math.min(100, Math.abs(segment.deltaPercent || 0));
            return `hsl(220, ${40 + intensity * 0.6}%, ${40 - intensity * 0.15}%)`;
        }
        case 'neutral':
            return '#475569'; // Slate-600
        default:
            return '#64748b';
    }
};
