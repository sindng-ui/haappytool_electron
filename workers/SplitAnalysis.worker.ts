import { AggregateMetrics } from './SplitAnalysisUtils';
console.log('[SplitAnalysisWorker] Script loaded');

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

    leftLineNum: number;   // visualIndex
    rightLineNum: number;  // visualIndex
    leftPrevLineNum: number;
    rightPrevLineNum: number;

    leftOrigLineNum: number;  // ✅ original line num
    rightOrigLineNum: number; // ✅ original line num
    leftPrevOrigLineNum: number;
    rightPrevOrigLineNum: number;

    leftCodeLineNum?: string | null;      // ✅ NEW: 로그 내부 코드 라인 번호
    rightCodeLineNum?: string | null;     // ✅ NEW: 로그 내부 코드 라인 번호
    leftPrevCodeLineNum?: string | null;  // ✅ NEW
    rightPrevCodeLineNum?: string | null; // ✅ NEW
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
    console.log('[SplitAnalysisWorker] Received metrics', { leftSize: Object.keys(leftMetrics || {}).length, rightSize: Object.keys(rightMetrics || {}).length });

    if (!leftMetrics || !rightMetrics) {
        console.warn('[SplitAnalysisWorker] Missing metrics data');
        ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results: [] } });
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

        // 🐧⚡ (수정) 빈도 계산은 항상 'Direct' 횟수 기준
        const lCount = left?.count || 0;
        const rCount = right?.count || 0;
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

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'ready', progress: 100 } });
    console.log(`[SplitAnalysisWorker] Analysis complete. Sending ${results.length} results.`);
    ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results } });
};
