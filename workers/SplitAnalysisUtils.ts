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
    },
    maxGap: number = 100,
    side: string = 'left'
): void => {
    if (!state.lookbackWindow) state.lookbackWindow = [];
    if (!state.metricsCount) state.metricsCount = { val: Object.keys(metrics).length };

    for (let i = 0; i < data.length; i++) {
        const item = data[i];

        // 1. 시그니처 생성
        if (!item.signature) {
            if (item.alias) {
                // 🐧⚡ 알리아스가 있으면 최우선 시그니처로 사용!
                item.signature = `[Alias] ${item.alias}`;
            } else if (isSignificant(item)) {
                item.signature = `${item.fileName}::${item.functionName}`;
                if (item.codeLineNum) {
                    item.signature += `(${item.codeLineNum})`;
                }
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
            if (hasExisting || Object.keys(pointMetrics).length < 50000) {
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
        if (existing.lineNum === undefined || existing.lineNum === 0) {
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
