export interface PointAnalysisResult {
    sig: string;
    fileName: string;
    functionName: string;
    codeLineNum: string | null;
    preview: string;
    count: number;
    visualIndices: number[];
    originalLineNums: number[];
}

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

    prevFileName?: string;
    prevFunctionName?: string;
    prevPreview?: string;

    leftUniqueTids: number;
    rightUniqueTids: number;

    leftLineNum: number;   // visualIndex
    rightLineNum: number;  // visualIndex
    leftPrevLineNum: number;
    rightPrevLineNum: number;

    leftOrigLineNum: number;
    rightOrigLineNum: number;
    leftPrevOrigLineNum: number;
    rightPrevOrigLineNum: number;

    leftCodeLineNum?: string | null;
    rightCodeLineNum?: string | null;
    leftPrevCodeLineNum?: string | null;
    rightPrevCodeLineNum?: string | null;
}

import { AggregateMetrics, PointMetrics } from './SplitAnalysisUtils';

export interface SplitAnalysisRequest {
    leftMetrics: AggregateMetrics;
    rightMetrics: AggregateMetrics;
    leftPointMetrics?: PointMetrics;
    rightPointMetrics?: PointMetrics;
}

export interface SplitAnalysisWorkerResponse {
    type: 'SPLIT_ANALYSIS_COMPLETE' | 'STATUS_UPDATE';
    payload?: any;
}

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<SplitAnalysisRequest>) => {
    const { leftMetrics, rightMetrics, leftPointMetrics, rightPointMetrics } = e.data;
    console.log('[SplitAnalysisWorker] Received metrics', {
        leftIntervals: Object.keys(leftMetrics || {}).length,
        rightIntervals: Object.keys(rightMetrics || {}).length,
        leftPoints: Object.keys(leftPointMetrics || {}).length,
        rightPoints: Object.keys(rightPointMetrics || {}).length
    });

    if (!leftMetrics || !rightMetrics) {
        console.warn('[SplitAnalysisWorker] Missing metrics data');
        ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results: [], pointResults: [] } });
        return;
    }

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'analyzing', progress: 10 } });

    const results: SplitAnalysisResult[] = [];
    const rightKeys = Object.keys(rightMetrics);
    console.log(`[SplitAnalysisWorker] Starting comparison. Right keys: ${rightKeys.length}`);

    for (const key of rightKeys) {
        const left = leftMetrics[key];
        const right = rightMetrics[key];

        // 🐧🛡️ 노이즈 필터링:
        // 1. 왼쪽 로그와 매칭된 경우 (Mapped Node) 이거나,
        // 2. 오른쪽 로그에서 실제로 연속해서 발생한(Direct) 경우만 포함
        // 슬라이딩 윈도우로 인해 발생한 단순 스킵(Bridge) 페어링 중 매칭 안 된 녀석들은 버림
        const isMapped = !!left;
        const isRightDirect = (right?.directCount || 0) > 0;

        if (!isMapped && !isRightDirect) continue;

        const leftAvgDelta = (left?.deltaSamples || 0) > 0 ? (left?.totalDelta || 0) / (left?.deltaSamples || 1) : 0;
        const rightAvgDelta = (right?.deltaSamples || 0) > 0 ? (right?.totalDelta || 0) / (right?.deltaSamples || 1) : 0;

        const isError = (left?.isError || right?.isError) ?? false;
        const isWarn = (left?.isWarn || right?.isWarn) ?? false;

        // "New" error: 왼쪽엔 에러가 없었는데 오른쪽엔 에러인 경우
        const isNewError = (!!right?.isError && !left?.isError);

        // [SPAM ANALYSIS FIX] 빈도 계산은 항상 'Direct' 횟수 기준
        const lCount = left?.directCount || 0;
        const rCount = right?.directCount || 0;
        const countDiff = rCount - lCount;

        results.push({
            key,
            fileName: right?.fileName || left?.fileName || '',
            functionName: right?.functionName || left?.functionName || '',
            preview: right?.preview || left?.preview || '',

            leftCount: lCount,
            rightCount: rCount,
            countDiff: countDiff,

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
            rightUniqueTids: right?.tids.length || 0,

            leftLineNum: left?.lineNum || 0,
            rightLineNum: right?.lineNum || 0,
            leftPrevLineNum: left?.prevLineNum || 0,
            rightPrevLineNum: right?.prevLineNum || 0,

            leftOrigLineNum: left?.originalLineNum || 0,
            rightOrigLineNum: right?.originalLineNum || 0,
            leftPrevOrigLineNum: left?.prevOriginalLineNum || 0,
            rightPrevOrigLineNum: right?.prevOriginalLineNum || 0,

            leftCodeLineNum: left?.codeLineNum,
            rightCodeLineNum: right?.codeLineNum,
            leftPrevCodeLineNum: left?.prevCodeLineNum,
            rightPrevCodeLineNum: right?.prevCodeLineNum
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

    // [POINT ANALYSIS] 신규 로그 (Point-based) 추출
    const pointResults: PointAnalysisResult[] = [];
    if (rightPointMetrics) {
        for (const sig in rightPointMetrics) {
            // 왼쪽에 해당 시그니처가 없으면 신규 로그로 판정
            if (!leftPointMetrics || !leftPointMetrics[sig]) {
                const pm = rightPointMetrics[sig];
                pointResults.push({
                    sig,
                    fileName: pm.fileName,
                    functionName: pm.functionName,
                    codeLineNum: pm.codeLineNum,
                    preview: pm.preview,
                    count: pm.count,
                    visualIndices: pm.visualIndices,
                    originalLineNums: pm.originalLineNums
                });
            }
        }
    }
    // 빈도순 정렬
    pointResults.sort((a, b) => b.count - a.count);

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'ready', progress: 100 } });
    console.log(`[SplitAnalysisWorker] Analysis complete. Intervals: ${results.length}, New Points: ${pointResults.length}`);
    ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results, pointResults } });
};
