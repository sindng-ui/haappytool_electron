import { LogMetadata, LogRule } from '../types';
import { extractTimestamp } from '../utils/logTime';
import { extractSourceMetadata } from '../utils/perfAnalysis';

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

// 🐧⚡ 정규표현식 재사용을 위한 상수 선언
const RE_TID_1 = /\(P\s*\d+,\s*T\s*(\d+)\)/;
const RE_TID_2 = /\[\s*(\d+):/;
const RE_NON_ALPHANUM = /[^a-zA-Z\uAC00-\uD7A3]/g;
const RE_DIGITS = /\d+/g;
const RE_HEX = /0x[0-9a-fA-F]+/g;
const RE_ERROR_LVL = /error|fail|critical/i;
const RE_WARN_LVL = /warn|warning/i;

export interface AliasEvent {
    alias: string;
    timestamp: number | null;
    visualIndex: number;
    lineNum: number;
    preview: string;
    fileName?: string;
    functionName?: string;
    codeLineNum?: string | null;
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
    isAliasMatch?: boolean;
    isAliasInterval?: boolean;
    isGlobalBatch?: boolean; // 🐧⚡ 거대 묶음 표시용 (최상단 노출)

    prevFileName?: string;
    prevFunctionName?: string;
    prevPreview?: string;

    leftUniqueTids?: number;
    rightUniqueTids?: number;

    leftLineNum: number;
    rightLineNum: number;
    leftPrevLineNum: number;
    rightPrevLineNum: number;

    leftOrigLineNum?: number;
    rightOrigLineNum?: number;
    leftPrevOrigLineNum?: number;
    rightPrevOrigLineNum?: number;

    leftCodeLineNum?: string | null;
    rightCodeLineNum?: string | null;
    leftPrevCodeLineNum?: string | null;
    rightPrevCodeLineNum?: string | null;
}

/**
 * 🐧⚡ 파일명, 함수명, 라인번호를 조합하여 통일된 시그니처 포맷을 반환합니다.
 */
export const getFormattedSig = (fileName?: string, functionName?: string, codeLineNum?: string | null, preview?: string): string => {
    const fn = (fileName || '').split(/[\\/]/).pop() || '';
    const func = functionName || '';

    // 🐧⚡ 메시지 패턴 추출: 숫자, Hex 등 변하는 부분을 #으로 치환하여 정적 패턴 생성
    let pattern = '';
    if (preview) {
        // 🐧⚡ '>' 가 있다면 그 이후의 진짜 본문 내용만 패턴 추출에 사용 (타임스탬프 등 제외)
        const markerIdx = preview.indexOf('>');
        const realBody = markerIdx !== -1 ? preview.substring(markerIdx + 1) : preview;

        pattern = realBody
            .replace(RE_HEX, '0x#')
            .replace(RE_DIGITS, '#')
            .substring(0, 40)
            .trim();
    }

    const patternStr = pattern ? `::[${pattern}]` : '';
    const emptyFallback = (fileName || functionName || pattern) ? '' : '(?)';

    return `${fn}::${func}${patternStr}${emptyFallback}`;
};

/**
 * 🐧⚡ 단일 로그 라인에서 메타데이터를 추출합니다. (최적화 버전)
 */
export const extractSingleMetadata = (
    text: string,
    originalIdx: number,
    visualIdx: number,
    currentRule: LogRule | null
): LogMetadata => {
    const timestamp = extractTimestamp(text);

    // TID 추출 (표시 장식용으로 유지)
    const tidMatch = text.match(RE_TID_1) || text.match(RE_TID_2);
    const tid = tidMatch ? tidMatch[1] : null;

    // 파일/함수/라인명 추출
    const { fileName, functionName, codeLineNum } = extractSourceMetadata(text);

    const isError = RE_ERROR_LVL.test(text);
    const isWarn = RE_WARN_LVL.test(text);

    // Happy Combo Alias 매칭
    let matchedAlias: string | null = null;
    if (currentRule?.happyGroups) {
        const caseSensitive = currentRule.happyCombosCaseSensitive ?? false;
        const lowerText = caseSensitive ? text : text.toLowerCase();

        for (const group of currentRule.happyGroups) {
            if (!group.enabled || !group.alias || !group.tags.length) continue;

            // 모든 태그가 포함되어 있는지 확인 (AND 조건)
            const allMatched = group.tags.every((tag, idx) => {
                // 🐧⚡ 사전 소문자화된 태그가 있으면 사용, 없으면 즉석 변환 (호환성 유지)
                const searchTag = (group as any)._lowercasedTags?.[idx] || (caseSensitive ? tag : tag.toLowerCase());
                return lowerText.includes(searchTag);
            });

            if (allMatched) {
                matchedAlias = group.alias;
                break;
            }
        }
    }

    return {
        fileName: fileName || '',
        functionName: functionName || '',
        codeLineNum,
        timestamp,
        tid,
        lineNum: originalIdx + 1,
        visualIndex: visualIdx,
        isError,
        isWarn,
        preview: text.length > 150 ? text.substring(0, 150) : text,
        alias: matchedAlias
    };
};

/**
 * 🐧⚡ 특정 라인에서 Happy Combo Alias만 쏙 뽑아냅니다.
 */
export const extractAliasFromLine = (text: string, currentRule: LogRule | null): string | null => {
    if (!currentRule?.happyGroups) return null;
    const caseSensitive = currentRule.happyCombosCaseSensitive ?? false;
    const lowerText = caseSensitive ? text : text.toLowerCase();

    for (const group of currentRule.happyGroups) {
        if (!group.enabled || !group.alias || !group.tags.length) continue;

        const allMatched = group.tags.every(tag => {
            const searchTag = caseSensitive ? tag : tag.toLowerCase();
            return lowerText.includes(searchTag);
        });

        if (allMatched) return group.alias;
    }
    return null;
};

/**
 * 🐧⚡ Alias 이벤트를 매칭하여 결과를 반환합니다.
 */
export const matchAliasEvents = (
    leftAliasEvents: AliasEvent[],
    rightAliasEvents: AliasEvent[]
): SplitAnalysisResult[] => {
    const results: SplitAnalysisResult[] = [];
    const getEventSig = (ev: AliasEvent) => `${ev.alias}|${ev.fileName || ''}|${ev.functionName || ''}|${ev.preview || ''}`;
    const getFormattedEventSig = (ev: AliasEvent) => getFormattedSig(ev.fileName, ev.functionName || ev.alias, ev.codeLineNum, ev.preview);

    const leftAliasMap = new Map<string, AliasEvent[]>();
    leftAliasEvents.forEach(ev => {
        const sig = getEventSig(ev);
        const list = leftAliasMap.get(sig) || [];
        list.push(ev);
        leftAliasMap.set(sig, list);
    });

    const rightAliasCounts = new Map<string, number>();
    rightAliasEvents.forEach(rev => {
        const sig = getEventSig(rev);
        const count = rightAliasCounts.get(sig) || 0;
        const leftEvents = leftAliasMap.get(sig);
        const lev = leftEvents ? leftEvents[count] : null;

        if (lev) {
            const leftTs = lev.timestamp || 0;
            const rightTs = rev.timestamp || 0;
            const delta = leftTs > 0 && rightTs > 0 ? (rightTs - leftTs) : 0;

            results.push({
                key: `${getFormattedEventSig(rev)} (#${count + 1})`,
                fileName: rev.fileName || lev.fileName || '',
                functionName: rev.functionName || lev.functionName || rev.alias,
                preview: rev.preview,
                leftCount: 1,
                rightCount: 1,
                countDiff: 0,
                leftAvgDelta: 0,
                rightAvgDelta: 0,
                deltaDiff: delta,
                isNewError: false,
                isError: false,
                isWarn: false,
                isAliasMatch: true,
                leftLineNum: lev.visualIndex,
                rightLineNum: rev.visualIndex,
                leftPrevLineNum: lev.visualIndex,
                rightPrevLineNum: rev.visualIndex,
                leftOrigLineNum: lev.lineNum,
                rightOrigLineNum: rev.lineNum,
                leftPrevOrigLineNum: lev.lineNum,
                rightPrevOrigLineNum: rev.lineNum,
                leftCodeLineNum: lev.codeLineNum,
                rightCodeLineNum: rev.codeLineNum,
                leftUniqueTids: 1,
                rightUniqueTids: 1
            });
        } else {
            results.push({
                key: `${getFormattedEventSig(rev)} [NEW] (#${count + 1})`,
                fileName: rev.fileName || '',
                functionName: rev.functionName || rev.alias,
                preview: rev.preview,
                leftCount: 0,
                rightCount: 1,
                countDiff: 1,
                leftAvgDelta: 0,
                rightAvgDelta: 0,
                deltaDiff: 0,
                isNewError: false,
                isError: false,
                isWarn: false,
                isAliasMatch: true,
                leftLineNum: 0,
                rightLineNum: rev.visualIndex,
                leftPrevLineNum: 0,
                rightPrevLineNum: rev.visualIndex,
                leftOrigLineNum: 0,
                rightOrigLineNum: rev.lineNum,
                leftPrevOrigLineNum: 0,
                rightPrevOrigLineNum: rev.lineNum,
                rightCodeLineNum: rev.codeLineNum,
                leftUniqueTids: 0,
                rightUniqueTids: 1
            });
        }
        rightAliasCounts.set(sig, count + 1);
    });

    return results;
};

/**
 * 🐧⚡ Alias 사이의 구간(Interval)을 분석합니다.
 */
export const computeAliasIntervals = (
    leftAliasEvents: AliasEvent[],
    rightAliasEvents: AliasEvent[]
): SplitAnalysisResult[] => {
    const results: SplitAnalysisResult[] = [];
    const getFormattedEventSig = (ev: AliasEvent) => getFormattedSig(ev.fileName, ev.functionName || ev.alias, ev.codeLineNum, ev.preview);

    const getIntervals = (events: AliasEvent[]) => {
        const intervals: { start: AliasEvent; end: AliasEvent; duration: number; sig: string }[] = [];
        for (let i = 0; i < events.length - 1; i++) {
            const start = events[i];
            const end = events[i + 1];
            if (start.timestamp && end.timestamp) {
                intervals.push({
                    start,
                    end,
                    duration: end.timestamp - start.timestamp,
                    sig: `${getFormattedEventSig(start)} ➔ ${getFormattedEventSig(end)}`
                });
            }
        }
        return intervals;
    };

    const leftIntervals = getIntervals(leftAliasEvents);
    const rightIntervals = getIntervals(rightAliasEvents);

    const leftInvMap = new Map<string, typeof leftIntervals>();
    leftIntervals.forEach(inv => {
        const list = leftInvMap.get(inv.sig) || [];
        list.push(inv);
        leftInvMap.set(inv.sig, list);
    });

    const rightInvCounts = new Map<string, number>();
    rightIntervals.forEach(rinv => {
        const count = rightInvCounts.get(rinv.sig) || 0;
        const linv = leftInvMap.get(rinv.sig)?.[count];

        if (linv) {
            results.push({
                key: `${rinv.sig} (#${count + 1})`,
                fileName: rinv.end.fileName || linv.end.fileName || '',
                functionName: rinv.end.functionName || linv.end.functionName || rinv.end.alias,
                preview: `${rinv.start.alias} ... ${rinv.end.alias}`,
                leftCount: 1,
                rightCount: 1,
                countDiff: 0,
                leftAvgDelta: linv.duration,
                rightAvgDelta: rinv.duration,
                deltaDiff: rinv.duration - linv.duration,
                isNewError: false,
                isError: false,
                isWarn: false,
                isAliasInterval: true,
                leftLineNum: linv.end.visualIndex,
                rightLineNum: rinv.end.visualIndex,
                leftPrevLineNum: linv.start.visualIndex,
                rightPrevLineNum: rinv.start.visualIndex,
                leftOrigLineNum: linv.end.lineNum,
                rightOrigLineNum: rinv.end.lineNum,
                leftPrevOrigLineNum: linv.start.lineNum,
                rightPrevOrigLineNum: rinv.start.lineNum,
                leftCodeLineNum: linv.end.codeLineNum,
                rightCodeLineNum: rinv.end.codeLineNum,
                leftUniqueTids: 1,
                rightUniqueTids: 1
            });
        }
        rightInvCounts.set(rinv.sig, count + 1);
    });

    return results;
};

/**
 * 🐧⚡ 동일한 Alias의 최초 발생부터 최후 발생까지를 하나의 거대한 세그먼트로 계산합니다.
 */
export const computeGlobalAliasRanges = (
    leftAliasEvents: AliasEvent[],
    rightAliasEvents: AliasEvent[]
): SplitAnalysisResult[] => {
    const results: SplitAnalysisResult[] = [];
    const getFormattedEventSig = (ev: AliasEvent) => getFormattedSig(ev.fileName, ev.functionName || ev.alias, ev.codeLineNum, ev.preview);

    const getRanges = (events: AliasEvent[]) => {
        const groups = new Map<string, AliasEvent[]>();
        events.forEach(ev => {
            const sig = ev.alias; // 🐧⚡ 단순하게 알리아스 명칭으로만 그룹화합니다. (위치 무관)
            const list = groups.get(sig) || [];
            list.push(ev);
            groups.set(sig, list);
        });

        const ranges: { sig: string; first: AliasEvent; last: AliasEvent; duration: number; count: number }[] = [];
        groups.forEach((list, sig) => {
            if (list.length >= 2) {
                const first = list[0];
                const last = list[list.length - 1];
                if (first.timestamp && last.timestamp) {
                    ranges.push({
                        sig,
                        first,
                        last,
                        duration: last.timestamp - first.timestamp,
                        count: list.length
                    });
                }
            }
        });
        return ranges;
    };

    const leftRanges = getRanges(leftAliasEvents);
    const rightRanges = getRanges(rightAliasEvents);

    const leftRangeMap = new Map<string, typeof leftRanges[0]>();
    leftRanges.forEach(r => leftRangeMap.set(r.sig, r));

    // 🐧⚡ 양쪽 매칭 및 오른쪽 신규 배치 처리
    rightRanges.forEach(rr => {
        const lr = leftRangeMap.get(rr.sig);
        if (lr) {
            results.push({
                key: `${getFormattedEventSig(rr.first)} ➔ ${getFormattedEventSig(rr.last)}`,
                fileName: rr.last.fileName || lr.last.fileName || '',
                functionName: rr.last.functionName || lr.last.functionName || rr.last.alias,
                prevFileName: rr.first.fileName || lr.first.fileName || '',
                prevFunctionName: rr.first.functionName || lr.first.functionName || rr.first.alias,
                preview: `Global Batch: ${rr.first.alias} (First: line ${rr.first.lineNum}) ➔ ${rr.last.alias} (Last: line ${rr.last.lineNum})`,
                leftCount: lr.count,
                rightCount: rr.count,
                countDiff: rr.count - lr.count,
                leftAvgDelta: lr.duration,
                rightAvgDelta: rr.duration,
                deltaDiff: rr.duration - lr.duration,
                isNewError: false,
                isError: false,
                isWarn: false,
                isAliasMatch: true, // ⚠️ 중복 제거 방지용
                isAliasInterval: true,
                isGlobalBatch: true, // 🐧⚡ 거대 묶음 표시
                leftLineNum: lr.last.visualIndex,
                rightLineNum: rr.last.visualIndex,
                leftPrevLineNum: lr.first.visualIndex,
                rightPrevLineNum: rr.first.visualIndex,
                leftOrigLineNum: lr.last.lineNum,
                rightOrigLineNum: rr.last.lineNum,
                leftPrevOrigLineNum: lr.first.lineNum,
                rightPrevOrigLineNum: rr.first.lineNum,
                leftCodeLineNum: lr.last.codeLineNum,
                rightCodeLineNum: rr.last.codeLineNum,
                leftPrevCodeLineNum: lr.first.codeLineNum,
                rightPrevCodeLineNum: rr.first.codeLineNum,
                leftUniqueTids: 1,
                rightUniqueTids: 1
            });
            leftRangeMap.delete(rr.sig); // 처리 완료
        } else {
            results.push({
                key: `${getFormattedEventSig(rr.first)} ➔ ${getFormattedEventSig(rr.last)} [NEW]`,
                fileName: rr.last.fileName || '',
                functionName: rr.last.functionName || rr.last.alias,
                prevFileName: rr.first.fileName || '',
                prevFunctionName: rr.first.functionName || rr.first.alias,
                preview: `Global New: ${rr.first.alias} (First: line ${rr.first.lineNum}) ➔ ${rr.last.alias} (Last: line ${rr.last.lineNum})`,
                leftCount: 0,
                rightCount: rr.count,
                countDiff: rr.count,
                leftAvgDelta: 0,
                rightAvgDelta: rr.duration,
                deltaDiff: 0,
                isNewError: false,
                isError: false,
                isWarn: false,
                isAliasMatch: true,
                isAliasInterval: true,
                isGlobalBatch: true,
                leftLineNum: 0,
                rightLineNum: rr.last.visualIndex,
                leftPrevLineNum: 0,
                rightPrevLineNum: rr.first.visualIndex,
                leftOrigLineNum: 0,
                rightOrigLineNum: rr.last.lineNum,
                leftPrevOrigLineNum: 0,
                rightPrevOrigLineNum: rr.first.lineNum,
                rightCodeLineNum: rr.last.codeLineNum,
                rightPrevCodeLineNum: rr.first.codeLineNum,
                leftUniqueTids: 0,
                rightUniqueTids: 1
            });
        }
    });

    // 🐧⚡ 왼쪽만 존재하는 배치 처리 (Optional)
    leftRangeMap.forEach((lr, sig) => {
        results.push({
            key: `${getFormattedEventSig(lr.first)} ➔ ${getFormattedEventSig(lr.last)} [MISSING]`,
            fileName: lr.last.fileName || '',
            functionName: lr.last.functionName || lr.first.alias || sig,
            prevFileName: lr.first.fileName || '',
            prevFunctionName: lr.first.functionName || lr.first.alias || sig,
            preview: `Global Missing: ${lr.first.alias} (First: line ${lr.first.lineNum}) ➔ ${lr.last.alias} (Last: line ${lr.last.lineNum})`,
            leftCount: lr.count,
            rightCount: 0,
            countDiff: -lr.count,
            leftAvgDelta: lr.duration,
            rightAvgDelta: 0,
            deltaDiff: 0,
            isNewError: false,
            isError: false,
            isWarn: false,
            isAliasMatch: true,
            isAliasInterval: true,
            isGlobalBatch: true,
            leftLineNum: lr.last.visualIndex,
            rightLineNum: 0,
            leftPrevLineNum: lr.first.visualIndex,
            rightPrevLineNum: 0,
            leftOrigLineNum: lr.last.lineNum,
            rightOrigLineNum: 0,
            leftPrevOrigLineNum: lr.first.lineNum,
            rightPrevOrigLineNum: 0,
            leftCodeLineNum: lr.last.codeLineNum,
            leftPrevCodeLineNum: lr.first.codeLineNum,
            leftUniqueTids: 1,
            rightUniqueTids: 0
        });
    });

    return results;
};


export interface AggregateMetrics {
    [key: string]: {
        count: number;
        totalDelta: number;
        deltaSamples: number;
        tids: string[];
        preview: string;
        fileName: string;
        functionName: string;
        prevPreview?: string;
        prevFileName?: string;
        prevFunctionName?: string;
        isError: boolean;
        isWarn: boolean;
        lineNum: number;      // visualIndex (for jump)
        prevLineNum: number;  // visualIndex (for jump)
        originalLineNum: number;     // 디스플레이용 원본 라인 번호
        prevOriginalLineNum: number; // 디스플레이용 원본 라인 번호
        codeLineNum?: string | null;     // 로그 내부 코드 라인 번호 (예: 350)
        prevCodeLineNum?: string | null; // 로그 내부 코드 라인 번호
        directCount?: number;            // 실제 연속된 로그 페어링 횟수
    };
}

export interface PointMetrics {
    [sig: string]: {
        count: number;
        fileName: string;
        functionName: string;
        codeLineNum: string | null;
        preview: string;
        tids: string[];
        visualIndices: number[];     // 상세 내비게이션용 (< > 버튼)
        originalLineNums: number[];  // 디스플레이용
    };
}

/**
 * 🐧⚡ 'Significant' 로그(파일명/함수명 포함)인지 확인합니다.
 */
export const isSignificant = (item: LogMetadata): boolean => {
    return !!(item.fileName || item.functionName || item.alias);
};

/**
 * 🐧⚡ 메타데이터로부터 지표를 계산합니다. (Side별 차등 매칭)
 * [UPDATE] 쓰레드 격리를 제거하고 파일의 선형적인 발생 순서대로만 매칭합니다.
 */
export const computeMetricsFromMetadata = (
    data: LogMetadata[],
    metrics: AggregateMetrics,
    pointMetrics: PointMetrics,
    state: {
        prevTimestamp: number | null;
        prevSignature: string;
        prevFileInfo: any;
        lastSignif?: LogMetadata;
        lookbackWindow?: LogMetadata[];
        aliasFirstMatch?: Record<string, LogMetadata>;
        metricsCount?: { val: number };
        pointMetricsCount?: { val: number }; // 🐧⚡ 추가: O(N) Object.keys().length 방지용
    },
    maxGap: number = 100,
    side: string = 'left'
): void => {
    if (!state.lookbackWindow) state.lookbackWindow = [];
    if (!state.metricsCount) state.metricsCount = { val: Object.keys(metrics).length };
    if (!state.pointMetricsCount) state.pointMetricsCount = { val: Object.keys(pointMetrics).length };

    for (let i = 0; i < data.length; i++) {
        const item = data[i];

        // 1. 시그니처 생성
        if (!item.signature) {
            if (item.alias) {
                // 🐧⚡ 알리아스 시그니처도 통일된 포맷을 사용하되, 알리아스임을 구분할 수 있도록 합니다.
                item.signature = `[Alias] ${item.alias}|${getFormattedSig(item.fileName, item.functionName, item.codeLineNum, item.preview)}`;
            } else if (isSignificant(item)) {
                item.signature = getFormattedSig(item.fileName, item.functionName, item.codeLineNum, item.preview);
            } else {
                let slim = item.preview
                    .replace(RE_HEX, '0x#')
                    .replace(RE_DIGITS, '#')
                    .replace(RE_NON_ALPHANUM, '');
                item.signature = slim.substring(0, 60) || item.preview.substring(0, 30);
            }
        }

        const currentSig = item.signature;

        // [POINT METRICS] 단일 지점 지표 업데이트 (CAP 적용)
        if (isSignificant(item)) {
            const hasExisting = !!pointMetrics[currentSig];
            if (hasExisting || (state.pointMetricsCount?.val || 0) < 50000) {
                if (!pointMetrics[currentSig]) {
                    pointMetrics[currentSig] = {
                        count: 0,
                        fileName: item.fileName || (item.alias ? `[Alias]` : ''),
                        functionName: item.functionName || item.alias || '',
                        codeLineNum: item.codeLineNum || null,
                        preview: item.preview,
                        tids: [],
                        visualIndices: [],
                        originalLineNums: []
                    };
                    if (state.pointMetricsCount) state.pointMetricsCount.val++; // 🐧⚡ 1인 가구 추가요!
                }
                const pm = pointMetrics[currentSig];
                pm.count++;
                if (item.tid && !pm.tids.includes(item.tid)) {
                    if (pm.tids.length < 10) pm.tids.push(item.tid);
                }

                if (pm.visualIndices.length < 5000) {
                    pm.visualIndices.push(item.visualIndex);
                    pm.originalLineNums.push(item.lineNum);
                }
            }
        }

        // 2. 차등 매칭 로직 (글로벌 시퀀스 기준)
        if (isSignificant(item)) {
            const lastSignif = state.lastSignif;

            if (side === 'left') {
                // [Baseline] 왼쪽은 오직 직전의 Significant 로그와만 매칭
                if (lastSignif) {
                    const key = `${lastSignif.signature} ➔ ${currentSig}`;
                    addMetric(metrics, key, lastSignif, item, true, state.metricsCount);
                }
            } else {
                // [Target] 오른쪽은 윈도우 내에서 매칭
                for (let j = 0; j < state.lookbackWindow.length; j++) {
                    const prev = state.lookbackWindow[j];
                    const isDirect = (j === state.lookbackWindow.length - 1);
                    const key = `${prev.signature} ➔ ${currentSig}`;
                    addMetric(metrics, key, prev, item, isDirect, state.metricsCount);
                }

                // 윈도우 관리 (글로벌)
                state.lookbackWindow.push(item);
                if (state.lookbackWindow.length > 20) state.lookbackWindow.shift();
            }

            // 글로벌 마지막 Significant 로그 업데이트
            state.lastSignif = item;
        }

        // 🐧🛡️ 메모리 보호: 메트릭 항목이 너무 많아지면 분석 비상 제동 (OOM 방지)
        if (state.metricsCount && state.metricsCount.val > 100000) {
            console.warn(`[SplitAnalysis] Hard cap reached (100k intervals). Stopping analysis for memory safety.`);
            break;
        }
    }

    const last = data[data.length - 1];
    if (last) {
        state.prevTimestamp = last.timestamp;
        state.prevSignature = last.signature || '';
    }
};

/**
 * 🐧⚡ 매칭된 인터벌을 메트릭 맵에 안전하게 추가합니다.
 */
function addMetric(
    metrics: AggregateMetrics,
    key: string,
    prev: LogMetadata,
    current: LogMetadata,
    isDirect: boolean = true,
    metricsCount?: { val: number } // 🐧⚡ 카운터 전달받음
) {
    let delta = 0;
    let hasDelta = false;
    if (current.timestamp !== null && prev.timestamp !== null) {
        delta = current.timestamp - prev.timestamp;
        if (delta >= 0 && delta < 3600000) {
            hasDelta = true;
        }
    }

    const existing = metrics[key];
    if (existing) {
        if (isDirect) {
            existing.count++;
            existing.directCount = (existing.directCount || 0) + 1;
        }

        // Timeline 정렬 및 점프는 항상 "최초 발생 지점"을 우선시합니다.
        if (existing.lineNum === undefined || existing.lineNum === -1) {
            existing.lineNum = current.visualIndex;
            existing.prevLineNum = prev.visualIndex;
            existing.originalLineNum = current.lineNum;
            existing.prevOriginalLineNum = prev.lineNum;
        }

        if (hasDelta) {
            existing.totalDelta += delta;
            existing.deltaSamples++;
        }
        if (current.tid && !existing.tids.includes(current.tid)) {
            if (existing.tids.length < 10) existing.tids.push(current.tid);
        }
    } else {
        // [MEMORY PROTECTION] 메트릭 신규 생성 제한
        if (metricsCount && metricsCount.val >= 100000) return;

        if (metricsCount) metricsCount.val++; // 펭귄 가라사대, 새 식구가 늘었구나!
        metrics[key] = {
            count: isDirect ? 1 : 0,
            directCount: isDirect ? 1 : 0,
            totalDelta: hasDelta ? delta : 0,
            deltaSamples: hasDelta ? 1 : 0,
            tids: current.tid ? [current.tid] : [],
            preview: current.preview,
            fileName: current.fileName,
            functionName: current.functionName,
            codeLineNum: current.codeLineNum,
            prevPreview: prev.preview,
            prevFileName: prev.fileName,
            prevFunctionName: prev.functionName,
            prevCodeLineNum: prev.codeLineNum,
            isError: current.isError,
            isWarn: current.isWarn,
            lineNum: current.visualIndex,
            prevLineNum: prev.visualIndex,
            originalLineNum: current.lineNum,
            prevOriginalLineNum: prev.lineNum
        };
    }
}

/**
 * 🐧⚡ Alias 기반의 거대 세그먼트를 메트릭 맵에 추가/갱신합니다.
 */
function addAliasMetric(
    metrics: AggregateMetrics,
    key: string,
    first: LogMetadata,
    last: LogMetadata,
    metricsCount?: { val: number }
) {
    // [MEMORY PROTECTION] 메트릭 신규 생성 제한
    if (!metrics[key] && metricsCount && metricsCount.val >= 100000) return;
    if (!metrics[key] && metricsCount) metricsCount.val++;
    let delta = 0;
    let hasDelta = false;
    if (last.timestamp !== null && first.timestamp !== null) {
        delta = last.timestamp - first.timestamp;
        if (delta >= 0 && delta < 3600000) {
            hasDelta = true;
        }
    }

    metrics[key] = {
        count: 1,
        directCount: 1, // 🐧⚡ 워커 필터링 통과를 위해 추가!
        totalDelta: hasDelta ? delta : 0,
        deltaSamples: hasDelta ? 1 : 0,
        tids: [],
        preview: last.preview,
        fileName: last.fileName || `[Alias]`,
        functionName: last.functionName || last.alias || '',
        codeLineNum: last.codeLineNum,
        prevPreview: first.preview,
        prevFileName: first.fileName || `[Alias]`,
        prevFunctionName: first.functionName || first.alias || '',
        prevCodeLineNum: first.codeLineNum,
        isError: last.isError || first.isError,
        isWarn: last.isWarn || first.isWarn,
        lineNum: last.visualIndex,
        prevLineNum: first.visualIndex,
        originalLineNum: last.lineNum,
        prevOriginalLineNum: first.lineNum
    };
}
