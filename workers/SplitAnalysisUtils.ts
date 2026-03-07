import { LogMetadata, LogRule } from '../types';
import { extractTimestamp } from '../utils/logTime';
import { extractSourceMetadata } from '../utils/perfAnalysis';

// 🐧⚡ 정규표현식 재사용을 위한 상수 선언
const RE_TID_1 = /\(P\s*\d+,\s*T\s*(\d+)\)/;
const RE_TID_2 = /\[\s*(\d+):/;
const RE_NON_ALPHANUM = /[^a-zA-Z\uAC00-\uD7A3]/g;
const RE_DIGITS = /\d+/g;
const RE_HEX = /0x[0-9a-fA-F]+/g;
const RE_ERROR_LVL = /error|fail|critical/i;
const RE_WARN_LVL = /warn|warning/i;

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

    // TID 추출
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
            const allMatched = group.tags.every(tag => {
                const searchTag = caseSensitive ? tag : tag.toLowerCase();
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
    return !!(item.fileName || item.functionName);
};

/**
 * 🐧⚡ 메타데이터로부터 지표를 계산합니다. (Side별 차등 매칭)
 */
export const computeMetricsFromMetadata = (
    data: LogMetadata[],
    metrics: AggregateMetrics,
    pointMetrics: PointMetrics, // 신규 추가
    state: {
        prevTimestamp: number | null;
        prevSignature: string;
        prevFileInfo: any;
        lookbackWindowByTid?: Record<string, LogMetadata[]>; // TID별 윈도우 관리
        lastSignifByTid?: Record<string, LogMetadata>; // TID별 마지막 로그 관리
        aliasFirstMatch?: Record<string, LogMetadata>;
    },
    maxGap: number = 100,
    side: string = 'left'
): void => {
    if (!state.lookbackWindowByTid) state.lookbackWindowByTid = {};
    if (!state.lastSignifByTid) state.lastSignifByTid = {};

    for (let i = 0; i < data.length; i++) {
        const item = data[i];

        // 1. 시그니처 생성 (파일명:함수(라인) 우선)
        if (!item.signature) {
            if (isSignificant(item)) {
                item.signature = `${item.fileName}::${item.functionName}`;
                if (item.codeLineNum) {
                    item.signature += `(${item.codeLineNum})`;
                }
            } else {
                // 일반 로그는 기존 방식 유지
                let slim = item.preview
                    .replace(RE_HEX, '0x#')
                    .replace(RE_DIGITS, '#')
                    .replace(RE_NON_ALPHANUM, '');
                item.signature = slim.substring(0, 60) || item.preview.substring(0, 30);
            }
        }

        const currentSig = item.signature;
        const tid = item.tid || 'default';

        // [POINT METRICS] 단일 지점 지표 업데이트
        if (isSignificant(item)) {
            if (!pointMetrics[currentSig]) {
                pointMetrics[currentSig] = {
                    count: 0,
                    fileName: item.fileName,
                    functionName: item.functionName,
                    codeLineNum: item.codeLineNum || null,
                    preview: item.preview,
                    tids: [],
                    visualIndices: [],
                    originalLineNums: []
                };
            }
            const pm = pointMetrics[currentSig];
            pm.count++;
            if (item.tid && !pm.tids.includes(item.tid)) pm.tids.push(item.tid);

            // 내비게이션용 위치 정보 수집 (최대 10000개로 제한하여 메모리 보호)
            if (pm.visualIndices.length < 10000) {
                pm.visualIndices.push(item.visualIndex);
                pm.originalLineNums.push(item.lineNum);
            }
        }

        if (!state.lookbackWindowByTid[tid]) state.lookbackWindowByTid[tid] = [];
        const lookbackWindow = state.lookbackWindowByTid[tid];

        // 2. 차등 매칭 로직 (TID별 격리)
        if (isSignificant(item)) {
            if (side === 'left') {
                // [Baseline] 같은 쓰레드의 연속된 로그만 페어링
                const lastSignif = state.lastSignifByTid[tid];
                if (lastSignif) {
                    const key = `${lastSignif.signature} ➔ ${currentSig}`;
                    addMetric(metrics, key, lastSignif, item);
                }
            } else {
                // [Target] 같은 쓰레드의 최근 윈도우 내에서 매칭
                const windowLen = lookbackWindow.length;
                for (let j = 0; j < windowLen; j++) {
                    const prevItem = lookbackWindow[j];
                    const isDirect = (j === windowLen - 1);
                    const key = `${prevItem.signature} ➔ ${currentSig}`;
                    addMetric(metrics, key, prevItem, item, isDirect);
                }

                // 윈도우 관리 (TID별)
                lookbackWindow.push(item);
                if (lookbackWindow.length > 20) {
                    lookbackWindow.shift();
                }
            }

            // TID별 마지막 소스로 저장
            state.lastSignifByTid[tid] = item;
        }

        // 3. 🐧⚡ Happy Combo Alias 기반 세그먼트 (사용자 요구사항)
        if (item.alias) {
            if (!state.aliasFirstMatch) state.aliasFirstMatch = {};

            const firstMatch = state.aliasFirstMatch[item.alias];
            if (!firstMatch) {
                // 이 Alias의 첫 등장이면 저장만 함
                state.aliasFirstMatch[item.alias] = item;
            } else {
                // 이미 첫 등장이 있었다면, [First ➔ Current] 구간 생성
                // Alias 세그먼트는 흐름 전체를 보므로 키에 [Alias] 접두어 추가
                const key = `[Alias] ${item.alias}`;

                // 메트릭 추가 (단, Alias 세그먼트는 count를 늘리는 게 아니라 최종 상태를 갱신하는 식)
                // addMetric의 기존 로직을 최대한 활용하되, Alias 세그먼트임을 알림
                addAliasMetric(metrics, key, firstMatch, item);
            }
        }
    }

    // 상태 보관 (청크 간 연결을 위해)
    const last = data[data.length - 1];
    if (last) {
        state.prevTimestamp = last.timestamp;
        state.prevSignature = last.signature || '';
    }
};

/**
 * 🐧⚡ 매칭된 인터벌을 메트릭 맵에 안전하게 추가합니다.
 */
function addMetric(metrics: AggregateMetrics, key: string, prev: LogMetadata, current: LogMetadata, isDirect: boolean = true) {
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
        // [SPAM ANALYSIS FIX] directCount는 진짜 연속 발생 시에만 증가
        if (isDirect) {
            existing.count++;
            existing.directCount = (existing.directCount || 0) + 1;
            // 점프 지점은 가장 마지막(최신) 지점으로 계속 갱신하여 점프 위치의 최신성 보장
            existing.lineNum = current.visualIndex;
            existing.prevLineNum = prev.visualIndex;
            existing.originalLineNum = current.lineNum;
            existing.prevOriginalLineNum = prev.lineNum;

            if (hasDelta) {
                existing.totalDelta += delta;
                existing.deltaSamples++;
            }
        }
        if (current.tid && !existing.tids.includes(current.tid)) {
            if (existing.tids.length < 50) existing.tids.push(current.tid);
        }
    } else {
        metrics[key] = {
            count: isDirect ? 1 : 0,
            directCount: isDirect ? 1 : 0,
            totalDelta: (hasDelta && isDirect) ? delta : 0,
            deltaSamples: (hasDelta && isDirect) ? 1 : 0,
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
function addAliasMetric(metrics: AggregateMetrics, key: string, first: LogMetadata, last: LogMetadata) {
    let delta = 0;
    let hasDelta = false;
    if (last.timestamp !== null && first.timestamp !== null) {
        delta = last.timestamp - first.timestamp;
        if (delta >= 0 && delta < 3600000) {
            hasDelta = true;
        }
    }

    // Alias 세그먼트는 "하나의 시퀀스"를 의미하므로 count를 1로 고정하고 
    // delta는 가장 최신(첫 로그와 마지막 로그의 차이)으로 계속 덮어씀
    metrics[key] = {
        count: 1,
        totalDelta: hasDelta ? delta : 0,
        deltaSamples: hasDelta ? 1 : 0,
        tids: [], // Alias 전역 분석이므로 TID는 생략하거나 핵심만
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
