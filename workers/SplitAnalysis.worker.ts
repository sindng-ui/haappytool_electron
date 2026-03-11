// PointAnalysisResult 등 필요한 인터페이스는 남겨두고 나머지는 SplitAnalysisUtils에서 가져옵니다.
import {
    AggregateMetrics,
    PointMetrics,
    AliasEvent,
    SplitAnalysisResult,
    PointAnalysisResult,
    matchAliasEvents,
    computeAliasIntervals
} from './SplitAnalysisUtils';

export interface SplitAnalysisRequest {
    leftMetrics: AggregateMetrics;
    rightMetrics: AggregateMetrics;
    leftPointMetrics?: PointMetrics;
    rightPointMetrics?: PointMetrics;
    leftAliasEvents?: AliasEvent[];
    rightAliasEvents?: AliasEvent[];
}

export interface SplitAnalysisWorkerResponse {
    type: 'SPLIT_ANALYSIS_COMPLETE' | 'STATUS_UPDATE';
    payload?: any;
}

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<SplitAnalysisRequest>) => {
    const { leftMetrics, rightMetrics, leftPointMetrics, rightPointMetrics, leftAliasEvents, rightAliasEvents } = e.data;
    console.log('[SplitAnalysisWorker] Received metrics', {
        leftIntervals: Object.keys(leftMetrics || {}).length,
        rightIntervals: Object.keys(rightMetrics || {}).length,
        leftPoints: Object.keys(leftPointMetrics || {}).length,
        rightPoints: Object.keys(rightPointMetrics || {}).length,
        leftAliasEvents: leftAliasEvents?.length,
        rightAliasEvents: rightAliasEvents?.length
    });

    if (!leftMetrics || !rightMetrics) {
        console.warn('[SplitAnalysisWorker] Missing metrics data');
        ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results: [], pointResults: [] } });
        return;
    }

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'analyzing', progress: 10 } });

    // --- Part 1: Interval Analysis (Original) ---
    const results: SplitAnalysisResult[] = [];
    // ... (기존 interval 분석 로직 생략 - 실제로는 포함되어야 함)
    // 🐧💡 속도를 위해 기존 로직을 그대로 유지하되, Alias 매칭 결과를 상단에 추가합니다.

    // --- Part 2: Alias Sequence Matching (New Engine) ---
    if (leftAliasEvents && rightAliasEvents) {
        const aliasMatches = matchAliasEvents(leftAliasEvents, rightAliasEvents);
        const aliasIntervals = computeAliasIntervals(leftAliasEvents, rightAliasEvents);

        results.push(...aliasMatches);
        results.push(...aliasIntervals);
    }

    // --- Part 3: Interval Analysis Loop ---
    const rightKeys = Object.keys(rightMetrics);
    for (const key of rightKeys) {
        const left = leftMetrics[key];
        const right = rightMetrics[key];

        const isMapped = !!left;
        const isRightDirect = (right?.directCount || 0) > 0;
        if (!isMapped && !isRightDirect) continue;

        const leftAvgDelta = (left?.deltaSamples || 0) > 0 ? (left?.totalDelta || 0) / (left?.deltaSamples || 1) : 0;
        const rightAvgDelta = (right?.deltaSamples || 0) > 0 ? (right?.totalDelta || 0) / (right?.deltaSamples || 1) : 0;

        results.push({
            key,
            fileName: right?.fileName || left?.fileName || '',
            functionName: right?.functionName || left?.functionName || '',
            preview: right?.preview || left?.preview || '',
            leftCount: left?.directCount || 0,
            rightCount: right?.directCount || 0,
            countDiff: (right?.directCount || 0) - (left?.directCount || 0),
            leftAvgDelta,
            rightAvgDelta,
            deltaDiff: rightAvgDelta - leftAvgDelta,
            isNewError: (!!right?.isError && !left?.isError),
            isError: (left?.isError || right?.isError) ?? false,
            isWarn: (left?.isWarn || right?.isWarn) ?? false,
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

    // Sort: Alias Intervals first, then Alias matches, then New Errors, then Severity.
    results.sort((a, b) => {
        if (a.isAliasInterval && !b.isAliasInterval) return -1;
        if (!a.isAliasInterval && b.isAliasInterval) return 1;

        if (a.isAliasMatch && !b.isAliasMatch) return -1;
        if (!a.isAliasMatch && b.isAliasMatch) return 1;

        if (a.isNewError && !b.isNewError) return -1;
        if (!a.isNewError && b.isNewError) return 1;

        const aSeverity = Math.abs(a.deltaDiff) * 0.5 + Math.abs(a.countDiff) * 10;
        const bSeverity = Math.abs(b.deltaDiff) * 0.5 + Math.abs(b.countDiff) * 10;
        return bSeverity - aSeverity;
    });

    // 🐧⚡ Deduplication: 시각적으로 동일한 구간을 가리키는 중복 세그먼트 제거
    // Alias 분석 결과와 일반 분석 결과가 겹칠 경우, 상단에 정렬된(Alias 등) 결과를 우선순위로 남깁니다.
    const finalResults: SplitAnalysisResult[] = [];
    const seenRanges = new Set<string>();

    for (const res of results) {
        // 좌/우 로그의 시작~끝 라인이 모두 동일하면 중복으로 판단
        const rangeKey = `${res.leftPrevLineNum}-${res.leftLineNum}|${res.rightPrevLineNum}-${res.rightLineNum}`;

        // 유니크한 키(시그니처)도 고려해야 할 수 있으나, 사용자에게는 '범위'가 같으면 중복임
        if (!seenRanges.has(rangeKey)) {
            finalResults.push(res);
            seenRanges.add(rangeKey);
        } else {
            console.log(`[SplitAnalysisWorker] Deduplicated redundant segment: ${res.key} (Range: ${rangeKey})`);
        }
    }

    const pointResults: PointAnalysisResult[] = [];
    if (rightPointMetrics) {
        for (const sig in rightPointMetrics) {
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
    pointResults.sort((a, b) => b.count - a.count);

    ctx.postMessage({ type: 'STATUS_UPDATE', payload: { status: 'ready', progress: 100 } });
    ctx.postMessage({ type: 'SPLIT_ANALYSIS_COMPLETE', payload: { results: finalResults, pointResults } });
};
