import { LogMetadata } from '../types';

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
    leftData: LogMetadata[];
    rightData: LogMetadata[];
}

export interface SplitAnalysisWorkerResponse {
    type: 'SPLIT_ANALYSIS_COMPLETE' | 'STATUS_UPDATE';
    payload?: any;
}

const ctx: Worker = self as any;

const computeMetrics = (data: LogMetadata[]) => {
    const map = new Map<string, {
        count: number;
        totalDelta: number;
        deltaSamples: number;
        tids: Set<string>;
        preview: string;
        fileName: string;
        functionName: string;
        prevPreview?: string;
        prevFileName?: string;
        prevFunctionName?: string;
        isError: boolean;
        isWarn: boolean;
    }>();

    let prevTimestamp: number | null = null;
    let prevSignature: string = 'START';
    let prevFileInfo = { fileName: '', functionName: '', preview: '' };

    for (const item of data) {
        let currentSignature = '';
        if (item.fileName || item.functionName) {
            currentSignature = `${item.fileName || 'Unknown'}::${item.functionName || 'Unknown'}`;
        } else {
            currentSignature = item.preview.replace(/[\d:\-\.\[\]\s]/g, '').substring(0, 50);
            if (currentSignature.length < 5) currentSignature = item.preview.substring(0, 20); // fallback
        }

        // The key is now "PREV -> CURR"
        const key = `${prevSignature} ➔ ${currentSignature}`;

        let delta = 0;
        let hasDelta = false;
        if (item.timestamp !== null && prevTimestamp !== null) {
            delta = item.timestamp - prevTimestamp;
            // Abs value in case Logs are out of order, or max threshold (e.g. 1 hour) to ignore huge gaps
            if (delta >= 0 && delta < 3600000) {
                hasDelta = true;
            } else {
                delta = 0;
            }
        }

        if (item.timestamp !== null) {
            prevTimestamp = item.timestamp;
        }

        const existing = map.get(key);
        if (existing) {
            existing.count++;
            if (hasDelta) {
                existing.totalDelta += delta;
                existing.deltaSamples++;
            }
            if (item.tid) existing.tids.add(item.tid);
        } else {
            const tids = new Set<string>();
            if (item.tid) tids.add(item.tid);

            map.set(key, {
                count: 1,
                totalDelta: hasDelta ? delta : 0,
                deltaSamples: hasDelta ? 1 : 0,
                tids,
                preview: item.preview,
                fileName: item.fileName,
                functionName: item.functionName,
                prevPreview: prevFileInfo.preview,
                prevFileName: prevFileInfo.fileName,
                prevFunctionName: prevFileInfo.functionName,
                isError: item.isError,
                isWarn: item.isWarn
            });
        }

        // Update prev info for next iteration
        prevSignature = currentSignature;
        prevFileInfo = {
            fileName: item.fileName || '',
            functionName: item.functionName || '',
            preview: item.preview || ''
        };
    }

    return map;
};

ctx.onmessage = (e: MessageEvent<SplitAnalysisRequest>) => {
    const { leftData, rightData } = e.data;

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'analyzing', progress: 10 } });

    const leftMetrics = computeMetrics(leftData);
    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'analyzing', progress: 50 } });

    const rightMetrics = computeMetrics(rightData);
    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'analyzing', progress: 80 } });

    const allKeys = new Set([...leftMetrics.keys(), ...rightMetrics.keys()]);

    const results: SplitAnalysisResult[] = [];

    for (const key of allKeys) {
        const left = leftMetrics.get(key);
        const right = rightMetrics.get(key);

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

            leftUniqueTids: left?.tids.size || 0,
            rightUniqueTids: right?.tids.size || 0
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
