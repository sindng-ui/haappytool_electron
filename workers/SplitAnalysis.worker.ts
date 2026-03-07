import { AggregateMetrics } from './SplitAnalysisUtils';

export interface SplitAnalysisResult {
    key: string;
    fileName: string;
    functionName: string;
    preview: string;

    leftCount: number;
    rightCount: number;
    countDiff: number;

    leftAvgDelta: number;
    rightAvgDelta: number;
    deltaDiff: number;

    isNewError: boolean;
    isError: boolean;
    isWarn: boolean;

    // Previous metrics for context
    prevFileName?: string;
    prevFunctionName?: string;
    prevPreview?: string;

    leftUniqueTids: number;
    rightUniqueTids: number;
}

export interface SplitAnalysisRequest {
    leftMetrics: AggregateMetrics;
    rightMetrics: AggregateMetrics;
}

export interface SplitAnalysisWorkerResponse {
    type: 'SPLIT_ANALYSIS_COMPLETE' | 'STATUS_UPDATE';
    payload?: any;
}

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<SplitAnalysisRequest>) => {
    const { leftMetrics, rightMetrics } = e.data;

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'analyzing', progress: 10 } });

    const allKeys = new Set([...Object.keys(leftMetrics), ...Object.keys(rightMetrics)]);

    const results: SplitAnalysisResult[] = [];

    for (const key of allKeys) {
        const left = leftMetrics[key];
        const right = rightMetrics[key];

        const leftAvgDelta = left && left.deltaSamples > 0 ? left.totalDelta / left.deltaSamples : 0;
        const rightAvgDelta = right && right.deltaSamples > 0 ? right.totalDelta / right.deltaSamples : 0;

        const isError = (left?.isError || right?.isError) ?? false;
        const isWarn = (left?.isWarn || right?.isWarn) ?? false;

        // It's a "New" error if it's an error in right, but not in left (or didn't exist in left)
        const isNewError = (right?.isError && !left?.isError) ?? false;

        results.push({
            key,
            fileName: right?.fileName || left?.fileName || '',
            functionName: right?.functionName || left?.functionName || '',
            preview: right?.preview || left?.preview || '',

            leftCount: left?.count || 0,
            rightCount: right?.count || 0,
            countDiff: (right?.count || 0) - (left?.count || 0),

            leftAvgDelta,
            rightAvgDelta,
            deltaDiff: rightAvgDelta - leftAvgDelta,

            isNewError,
            isError,
            isWarn,

            prevFileName: right?.prevFileName || left?.prevFileName || '',
            prevFunctionName: right?.prevFunctionName || left?.prevFunctionName || '',
            prevPreview: right?.prevPreview || left?.prevPreview || '',

            leftUniqueTids: left?.tids.length || 0,
            rightUniqueTids: right?.tids.length || 0
        });
    }

    // Sort: New Errors First, then biggest count/delta diffs.
    results.sort((a, b) => {
        if (a.isNewError && !b.isNewError) return -1;
        if (!a.isNewError && b.isNewError) return 1;

        // Magnitude of issues (slowdowns, massive spam)
        const aSeverity = Math.abs(a.deltaDiff) * 0.5 + Math.abs(a.countDiff) * 10;
        const bSeverity = Math.abs(b.deltaDiff) * 0.5 + Math.abs(b.countDiff) * 10;

        return bSeverity - aSeverity;
    });

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'ready', progress: 100 } });
    ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results } });
};
