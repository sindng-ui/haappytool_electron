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
        preview: text.length > 150 ? text.substring(0, 150) : text
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
        originalLineNum: number;     // ✅ 디스플레이용 원본 라인 번호
        prevOriginalLineNum: number; // ✅ 디스플레이용 원본 라인 번호
        codeLineNum?: string | null;     // ✅ NEW: 로그 내부 코드 라인 번호 (예: 350)
        prevCodeLineNum?: string | null; // ✅ NEW: 로그 내부 코드 라인 번호
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
    state: {
        prevTimestamp: number | null;
        prevSignature: string;
        prevFileInfo: any;
        lookbackWindow?: LogMetadata[];
        lastGlobalSignif?: LogMetadata;
    },
    maxGap: number = 100,
    side: string = 'left'
): void => {
    if (!state.lookbackWindow) {
        state.lookbackWindow = [];
    }

    const lookbackWindow = state.lookbackWindow;

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

        // 2. 차등 매칭 로직 (사용자 피드백 반영 핵심)
        if (isSignificant(item)) {
            if (side === 'left') {
                // [Baseline] 연속된 소스 로그만 페어링하여 기준 세그먼트 생성
                const lastSignif = state.lastGlobalSignif;
                if (lastSignif) {
                    const key = `${lastSignif.signature} ➔ ${currentSig}`;
                    addMetric(metrics, key, lastSignif, item);
                }
            } else {
                // [Target] 슬라이딩 윈도우를 이용해 중간에 로그가 삽입되어도 왼쪽 세그먼트를 검색 매칭
                // 최근 20개의 소스 로그와 페어링 시도 (오른쪽 로그에 신규 로그 삽입 대응)
                for (const prevItem of lookbackWindow) {
                    const key = `${prevItem.signature} ➔ ${currentSig}`;
                    addMetric(metrics, key, prevItem, item);
                }

                // 윈도우 관리 (오른쪽 로그 전용)
                lookbackWindow.push(item);
                if (lookbackWindow.length > 20) {
                    lookbackWindow.shift();
                }
            }

            // 공통: 현재 소스를 마지막 소스로 저장
            state.lastGlobalSignif = item;
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
function addMetric(metrics: AggregateMetrics, key: string, prev: LogMetadata, current: LogMetadata) {
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
        existing.count++;
        if (hasDelta) {
            existing.totalDelta += delta;
            existing.deltaSamples++;
        }
        if (current.tid && !existing.tids.includes(current.tid)) {
            if (existing.tids.length < 50) existing.tids.push(current.tid);
        }
    } else {
        metrics[key] = {
            count: 1,
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
