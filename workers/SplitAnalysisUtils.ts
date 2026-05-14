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

export interface SequenceItem {
    sig: string;
    timestamp: number | null;
    tid: string | null;
    preview: string;
    fileName: string;
    functionName: string;
    codeLineNum: string | null;
    isError: boolean;
    isWarn: boolean;
    lineNum: number;
    originalLineNum: number;
    alias: string | null;
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

    // 🐧⚡ Burst(반복 로그) 정보
    isBurst?: boolean;
    burstCount?: number;
    // 버스트 종료 위치 (점프는 burstEndLineNum이 있으면 이 위치를 사용, 없으면 rightLineNum 사용)
    burstEndLineNum?: number;      // 마지막 반복 발생의 우측 visualIndex
    burstEndOrigLineNum?: number;  // 마지막 반복 발생의 우측 원본 라인 번호
    burstEndLeftLineNum?: number;  // 마지막 반복 발생의 좌측 visualIndex
    burstEndLeftOrigLineNum?: number; // 마지막 반복 발생의 좌측 원본 라인 번호
    // burstDuration은 leftAvgDelta/rightAvgDelta 누적치로 대체 가능하므로 제거 (인터페이스 단순화)
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
            .replace(/\s+/g, ' ') // 🐧⚡ 연속된 공백을 하나로 합침 (Whitespace Normalization)
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
    const getEventSig = (ev: AliasEvent) => {
        const normalizedPreview = (ev.preview || '').replace(/\s+/g, ' ').trim();
        return `${ev.alias}|${ev.fileName || ''}|${ev.functionName || ''}|${normalizedPreview}`;
    };
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

            // 🐧⚡ [FIX] 완전 동일한 시그니처의 반복(A ➔ A)은 Global Batch와 LCS Burst Grouping으로 완벽히 커버되므로
            // 무의미한 1:1 간격 생성을 방지하기 위해 스킵합니다. (단, Alias가 같더라도 시그니처가 다르면 진행)
            if (getFormattedEventSig(start) === getFormattedEventSig(end)) continue;

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
export const isSignificant = (item: { fileName?: string, functionName?: string, alias?: string | null }): boolean => {
    return !!(item.fileName || item.functionName || item.alias);
};

/**
 * 🐧⚡ [NEW DP ALGORITHM] Needleman-Wunsch 기반의 글로벌 서열 정렬 
 * N-gram 윈도우 한계를 극복하기 위해 거대한 두 시퀀스를 O(N*M) 최적화로 정렬합니다. 
 */
export const alignSequences = (
    leftSeq: SequenceItem[],
    rightSeq: SequenceItem[]
): SplitAnalysisResult[] => {
    // 1. Find Anchors: 정확히 1:1로 등장하거나 동일 횟수로 등장하는 시그니처를 앵커 후보로 선정 🐧⚡
    const leftCounts = new Map<string, number>();
    const rightCounts = new Map<string, number>();
    
    for (const item of leftSeq) leftCounts.set(item.sig, (leftCounts.get(item.sig) || 0) + 1);
    for (const item of rightSeq) rightCounts.set(item.sig, (rightCounts.get(item.sig) || 0) + 1);
    
    // 1:1 고유 앵커 (기존 방식)
    const uniqueSigs = new Set<string>();
    for (const [sig, count] of leftCounts) {
        if (count === 1 && rightCounts.get(sig) === 1) {
            uniqueSigs.add(sig);
        }
    }
    
    // 🐧⚡ 반복 앵커: 양쪽에 2개 이상 등장하는 시그니처를 순서 보존 페어링 (N:M 매칭)
    // 예: OnError가 좌 7개, 우 9개면 앞에서 min(7,9)=7개를 1:1 앵커로 생성
    //     → 나머지 우측 2개는 unmatched gap으로 남음
    //     → 이렇게 해야 gap DP가 엉뚱한 위치와 매칭하지 않음
    const repeatedSigLeftIndices = new Map<string, number[]>(); // sig -> leftSeq 인덱스 배열
    const repeatedSigRightIndices = new Map<string, number[]>(); // sig -> rightSeq 인덱스 배열
    for (const [sig, leftCount] of leftCounts) {
        const rightCount = rightCounts.get(sig) ?? 0;
        // 1:1은 uniqueSigs에서 처리하므로 제외 (leftCount > 1 && rightCount > 1)
        // 최대 100개까지 지원 (성능 보호)
        if (leftCount > 1 && rightCount > 1 && Math.max(leftCount, rightCount) <= 100) {
            repeatedSigLeftIndices.set(sig, []);
            repeatedSigRightIndices.set(sig, []);
        }
    }
    for (let i = 0; i < leftSeq.length; i++) {
        const sig = leftSeq[i].sig;
        if (repeatedSigLeftIndices.has(sig)) repeatedSigLeftIndices.get(sig)!.push(i);
    }
    for (let j = 0; j < rightSeq.length; j++) {
        const sig = rightSeq[j].sig;
        if (repeatedSigRightIndices.has(sig)) repeatedSigRightIndices.get(sig)!.push(j);
    }
    
    // leftSeq에서 uniqueSig의 인덱스를 추출 (sig -> index map)
    const leftUniqueIdx = new Map<string, number>();
    for (let i = 0; i < leftSeq.length; i++) {
        if (uniqueSigs.has(leftSeq[i].sig)) {
            leftUniqueIdx.set(leftSeq[i].sig, i);
        }
    }
    
    // rightSeq를 순회하며 leftIdx 매핑 (고유 앵커 탐색)
    const matches: { leftIdx: number, rightIdx: number }[] = [];
    for (let j = 0; j < rightSeq.length; j++) {
        const sig = rightSeq[j].sig;
        if (uniqueSigs.has(sig) && leftUniqueIdx.has(sig)) {
            matches.push({ leftIdx: leftUniqueIdx.get(sig)!, rightIdx: j });
        }
    }
    // 🐧⚡ 반복 앵커 페어링 추가 (N:M 매칭 순서 보존)
    for (const [sig, leftIdxArr] of repeatedSigLeftIndices) {
        const rightIdxArr = repeatedSigRightIndices.get(sig)!;
        const pairCount = Math.min(leftIdxArr.length, rightIdxArr.length);
        for (let k = 0; k < pairCount; k++) {
            matches.push({ leftIdx: leftIdxArr[k], rightIdx: rightIdxArr[k] });
        }
    }
    
    // 🐧⚡ LIS 계산 전 rightIdx 기준으로 반드시 정렬해야 함 (반복 앵커가 뒤에 무작위로 추가되었기 때문)
    // 원래 unique 앵커는 rightSeq를 순회하며 넣어서 정렬되어 있었지만, 반복 앵커가 들어가며 순서가 깨짐
    matches.sort((a, b) => a.rightIdx - b.rightIdx);
    
    // LIS 알고리즘 (leftIdx 기준)을 통해 교차되지 않는 가장 긴 앵커 시퀀스 추출
    const anchors = computeLIS(matches);
    
    const aggregatedMatches: { left: SequenceItem, right: SequenceItem }[] = [];
    
    // 가상의 시작/끝 앵커 추가
    anchors.unshift({ leftIdx: -1, rightIdx: -1 });
    anchors.push({ leftIdx: leftSeq.length, rightIdx: rightSeq.length });
    
    // 앵커와 앵커 사이의 갭을 O(N*M) DP로 채운 뒤 합칩니다.
    for (let i = 0; i < anchors.length - 1; i++) {
        const startAnchor = anchors[i];
        const endAnchor = anchors[i + 1];
        
        if (startAnchor.leftIdx !== -1) {
            aggregatedMatches.push({ left: leftSeq[startAnchor.leftIdx], right: rightSeq[startAnchor.rightIdx] });
        }
        
        const L_start = startAnchor.leftIdx + 1;
        const L_end = endAnchor.leftIdx - 1;
        const R_start = startAnchor.rightIdx + 1;
        const R_end = endAnchor.rightIdx - 1;
        
        if (L_start <= L_end || R_start <= R_end) {
            const gapMatches = alignGapDP(leftSeq, rightSeq, L_start, L_end, R_start, R_end);
            for (const gm of gapMatches) {
                aggregatedMatches.push(gm);
            }
        }
    }
    
    // 2-1. 순서가 보장된 결과 리스트 생성 (aggregatedMatches의 순서 기반) 🐧⚡
    const rawResults: SplitAnalysisResult[] = [];
    const seenIntervals = new Set<string>();
    for (let i = 1; i < aggregatedMatches.length; i++) {
        const prev = aggregatedMatches[i-1];
        const curr = aggregatedMatches[i];
        const key = `${prev.left.sig} ➔ ${curr.left.sig}`;
        
        // 해당 지점의 metrics 정보를 순서대로 push (이미 push된 key는 metrics 객체에 누적되어 있으므로 skip)
        // 하지만 '연속된' 동일 인터벌을 그룹화해야 하므로, key가 같더라도 위치(Index)가 다르면 개별적으로 취급해야 함
        // 따라서 metrics 객체 접근 대신, 여기서 즉석에서 Result 객체를 생성하여 raw 리스트를 만듦
        
        let leftDelta = 0;
        let rightDelta = 0;
        if (curr.left.timestamp !== null && prev.left.timestamp !== null) {
            leftDelta = curr.left.timestamp - prev.left.timestamp;
            if (leftDelta < 0 || leftDelta > 3600000) leftDelta = 0;
        }
        if (curr.right.timestamp !== null && prev.right.timestamp !== null) {
            rightDelta = curr.right.timestamp - prev.right.timestamp;
            if (rightDelta < 0 || rightDelta > 3600000) rightDelta = 0;
        }

        rawResults.push({
            key,
            fileName: curr.right.fileName || curr.left.fileName,
            functionName: curr.right.functionName || curr.left.functionName,
            preview: curr.right.preview || curr.left.preview,
            leftCount: 1,
            rightCount: 1,
            countDiff: 0,
            leftAvgDelta: leftDelta,
            rightAvgDelta: rightDelta,
            deltaDiff: rightDelta - leftDelta,
            isNewError: false,
            isError: curr.left.isError || curr.right.isError,
            isWarn: curr.left.isWarn || curr.right.isWarn,
            
            leftLineNum: curr.left.lineNum,
            rightLineNum: curr.right.lineNum,
            leftPrevLineNum: prev.left.lineNum,
            rightPrevLineNum: prev.right.lineNum,
            leftOrigLineNum: curr.left.originalLineNum,
            rightOrigLineNum: curr.right.originalLineNum,
            leftPrevOrigLineNum: prev.left.originalLineNum,
            rightPrevOrigLineNum: prev.right.originalLineNum,
            
            leftCodeLineNum: curr.left.codeLineNum,
            rightCodeLineNum: curr.right.codeLineNum,
            leftPrevCodeLineNum: prev.left.codeLineNum,
            rightPrevCodeLineNum: prev.right.codeLineNum,
            
            prevFileName: prev.right.fileName || prev.left.fileName,
            prevFunctionName: prev.right.functionName || prev.left.functionName
        });
    }
    
    // 3. Extract Unmatched NEW ERRORS from rightSeq
    const matchedRightSet = new Set<number>();
    for (const m of aggregatedMatches) matchedRightSet.add(m.right.lineNum);
    
    for (const rItem of rightSeq) {
        if (!matchedRightSet.has(rItem.lineNum) && rItem.isError) {
            const key = `NEW_ERROR_${rItem.sig}_${rItem.lineNum}`;
            rawResults.push({
                key,
                fileName: rItem.fileName,
                functionName: rItem.functionName,
                preview: rItem.preview,
                leftCount: 0,
                rightCount: 1,
                countDiff: 1,
                leftAvgDelta: 0,
                rightAvgDelta: 0,
                deltaDiff: 0,
                isNewError: true,
                isError: true,
                isWarn: false,
                leftLineNum: -1,
                rightLineNum: rItem.lineNum,
                leftPrevLineNum: -1,
                rightPrevLineNum: Math.max(0, rItem.lineNum - 1),
                leftOrigLineNum: -1,
                rightOrigLineNum: rItem.originalLineNum,
                leftPrevOrigLineNum: -1,
                rightPrevOrigLineNum: Math.max(0, rItem.originalLineNum - 1),
                prevFileName: '',
                prevFunctionName: ''
            });
        }
    }

    // 4. 후처리: 연속된 동일 시그니처 매칭 결과 그룹화 (Burst/N-회 반복) 🐧⚡
    const finalizedResults: SplitAnalysisResult[] = [];
    if (rawResults.length > 0) {
        let currentGroup: SplitAnalysisResult | null = null;
        let groupCount = 0;

        for (let i = 0; i < rawResults.length; i++) {
            const res = rawResults[i];
            
            // Interval 매칭이고, 이전 그룹과 동일한 서명(Key)인 경우 병합 시도
            // (AliasMatch나 NewError는 건드리지 않고 일반 DP 매칭 구간만 병합)
            const canGroup = currentGroup && 
                             !res.isAliasMatch && !res.isAliasInterval && !res.isNewError &&
                             !currentGroup.isAliasMatch && !currentGroup.isAliasInterval && !currentGroup.isNewError &&
                             res.key === currentGroup.key;

            if (canGroup && currentGroup) {
                groupCount++;
                currentGroup.isBurst = true;
                currentGroup.burstCount = groupCount;
                
                // Duration 및 카운트 누적
                currentGroup.leftAvgDelta += res.leftAvgDelta;
                currentGroup.rightAvgDelta += res.rightAvgDelta;
                currentGroup.deltaDiff = currentGroup.rightAvgDelta - currentGroup.leftAvgDelta;
                currentGroup.leftCount += res.leftCount;
                currentGroup.rightCount += res.rightCount;
                currentGroup.countDiff = currentGroup.rightCount - currentGroup.leftCount;
                
                // 🐧⚡ 점프 위치(lineNum)는 첫 번째 발생 위치 유지!
                // 버스트 종료 위치는 별도 필드에 저장
                currentGroup.burstEndLineNum = res.rightLineNum;
                currentGroup.burstEndOrigLineNum = res.rightOrigLineNum;
                currentGroup.burstEndLeftLineNum = res.leftLineNum;
                currentGroup.burstEndLeftOrigLineNum = res.leftOrigLineNum;
            } else {
                if (currentGroup) {
                    finalizedResults.push(currentGroup);
                }
                currentGroup = { ...res };
                groupCount = 1;
            }
        }
        if (currentGroup) {
            finalizedResults.push(currentGroup);
        }
    }

    return finalizedResults;
};

// --- HLEPERS ---

function computeLIS(matches: { leftIdx: number, rightIdx: number }[]): { leftIdx: number, rightIdx: number }[] {
    const n = matches.length;
    if (n === 0) return [];
    
    const dp = new Int32Array(n);
    const prev = new Int32Array(n);
    let len = 0;
    
    for (let i = 0; i < n; i++) {
        const val = matches[i].leftIdx;
        let low = 0, high = len - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            if (matches[dp[mid]].leftIdx < val) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        const pos = low;
        prev[i] = pos > 0 ? dp[pos - 1] : -1;
        dp[pos] = i;
        if (pos === len) len++;
    }
    
    const result: { leftIdx: number, rightIdx: number }[] = [];
    let curr = dp[len - 1];
    while (curr !== -1) {
        result.push(matches[curr]);
        curr = prev[curr];
    }
    return result.reverse();
}

function alignGapDP(
    leftSeq: SequenceItem[], rightSeq: SequenceItem[],
    ls: number, le: number, rs: number, re: number
): { left: SequenceItem, right: SequenceItem }[] {
    const results: { left: SequenceItem, right: SequenceItem }[] = [];
    
    // 단순 최적화: 공통 접두사 매칭
    while (ls <= le && rs <= re && leftSeq[ls].sig === rightSeq[rs].sig) {
        results.push({ left: leftSeq[ls], right: rightSeq[rs] });
        ls++; rs++;
    }
    // 단순 최적화: 공통 접미사 매칭
    const suffixes: { left: SequenceItem, right: SequenceItem }[] = [];
    while (ls <= le && rs <= re && leftSeq[le].sig === rightSeq[re].sig) {
        suffixes.unshift({ left: leftSeq[le], right: rightSeq[re] });
        le--; re--;
    }
    
    const N = le - ls + 1;
    const M = re - rs + 1;
    
    if (N > 0 && M > 0) {
        // [LIMIT CAP] DP 너무 길면 메모리 파괴. 하드 캡
        if (N * M > 25000000) {
            console.warn(`[SplitAnalysis] Gap too large for DP (${N}x${M}). Falling back to greedy matching.`);
            let currR = rs;
            for (let i = ls; i <= le; i++) {
                for (let j = currR; j <= re; j++) {
                    if (leftSeq[i].sig === rightSeq[j].sig) {
                        results.push({ left: leftSeq[i], right: rightSeq[j] });
                        currR = j + 1;
                        break;
                    }
                }
            }
        } else {
            // Needleman-Wunsch / LCS (Only Matches)
            const dp = new Int32Array((N + 1) * (M + 1));
            
            for (let i = 1; i <= N; i++) {
                for (let j = 1; j <= M; j++) {
                    if (leftSeq[ls + i - 1].sig === rightSeq[rs + j - 1].sig) {
                        dp[i * (M + 1) + j] = dp[(i - 1) * (M + 1) + (j - 1)] + 1;
                    } else {
                        dp[i * (M + 1) + j] = Math.max(dp[(i - 1) * (M + 1) + j], dp[i * (M + 1) + (j - 1)]);
                    }
                }
            }
            
            // Backtrack
            let i = N;
            let j = M;
            const dpResults: { left: SequenceItem, right: SequenceItem }[] = [];
            while (i > 0 && j > 0) {
                // 🐧⚡ (핵심 픽스) dp 테이블 값이 이전 값과 같다면 실제 매칭 채택을 건너뜀
                // 뒤에서부터 거꾸로 추적하므로, "건너뛸 수 있다면 먼저 건너뛰는 것"이
                // [A] vs [A, A] 상황에서 두 번째 A 대신 앞쪽의 첫 번째 A와 매칭되도록 강제함
                if (dp[i * (M + 1) + j] === dp[(i - 1) * (M + 1) + j]) {
                    i--;
                } else if (dp[i * (M + 1) + j] === dp[i * (M + 1) + (j - 1)]) {
                    j--;
                } else {
                    // 이제 dp값이 줄어드는 지점(실제로 공통 길이 +1을 만든 주역)에서만 페어링
                    dpResults.unshift({ left: leftSeq[ls + i - 1], right: rightSeq[rs + j - 1] });
                    i--; j--;
                }
            }
            for (const dpR of dpResults) results.push(dpR);
        }
    }
    
    for (const suf of suffixes) results.push(suf);
    return results;
};
