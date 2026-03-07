import { LogMetadata, LogRule } from '../types';
import { extractTimestamp } from '../utils/logTime';

// 🐧⚡ 정규표현식 재사용을 위한 상수 선언
const RE_TID_1 = /\(P\s*\d+,\s*T\s*(\d+)\)/;
const RE_TID_2 = /\[\s*(\d+):/;
const RE_FILE_FUNC = /([a-zA-Z0-9_]+\.(?:cs|cpp|h|java|kt|ts|js))[:\s]*(\w+)?/i;
const RE_NON_ALPHANUM = /[^a-zA-Z\uAC00-\uD7A3]/g;
const RE_DIGITS = /[\d]/g;
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

    // 파일/함수명 추출
    let fileName = '';
    let functionName = '';
    const fileMatch = text.match(RE_FILE_FUNC);
    if (fileMatch) {
        fileName = fileMatch[1];
        functionName = fileMatch[2] || '';
    }

    const isError = RE_ERROR_LVL.test(text);
    const isWarn = RE_WARN_LVL.test(text);

    return {
        fileName,
        functionName,
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
        lineNum: number;
        prevLineNum: number; // ✅ NEW: 이전 패턴의 라인 번호
    };
}

/**
 * 🐧⚡ 메타데이터로부터 지표를 계산합니다. (대용량 고속 처리 버전)
 * @param data 처리할 메타데이터 리스트
 * @param metrics 기존 지표 맵 (In-place 업데이트됨)
 * @param state 루프간 상태 보존 객체
 */
export const computeMetricsFromMetadata = (
    data: LogMetadata[],
    metrics: AggregateMetrics,
    state: { prevTimestamp: number | null; prevSignature: string; prevFileInfo: any }
): void => {
    let { prevTimestamp, prevSignature, prevFileInfo } = state;

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        let currentSignature = '';
        if (item.fileName || item.functionName) {
            currentSignature = `${item.fileName || 'Unknown'}::${item.functionName || 'Unknown'}`;
        } else {
            currentSignature = item.preview.replace(RE_NON_ALPHANUM, '').substring(0, 60);
            if (currentSignature.length < 3) {
                currentSignature = item.preview.replace(RE_DIGITS, '').substring(0, 30);
            }
        }

        const key = `${prevSignature} ➔ ${currentSignature}`;

        let delta = 0;
        let hasDelta = false;
        if (item.timestamp !== null && prevTimestamp !== null) {
            delta = item.timestamp - prevTimestamp;
            if (delta >= 0 && delta < 3600000) {
                hasDelta = true;
            } else {
                delta = 0;
            }
        }

        if (item.timestamp !== null) {
            prevTimestamp = item.timestamp;
        }

        const existing = metrics[key];
        if (existing) {
            existing.count++;
            if (hasDelta) {
                existing.totalDelta += delta;
                existing.deltaSamples++;
            }
            if (item.tid && existing.tids.length < 50 && !existing.tids.includes(item.tid)) {
                existing.tids.push(item.tid);
            }
        } else {
            metrics[key] = {
                count: 1,
                totalDelta: hasDelta ? delta : 0,
                deltaSamples: hasDelta ? 1 : 0,
                tids: item.tid ? [item.tid] : [],
                preview: item.preview,
                fileName: item.fileName,
                functionName: item.functionName,
                prevPreview: prevFileInfo.preview,
                prevFileName: prevFileInfo.fileName,
                prevFunctionName: prevFileInfo.functionName,
                isError: item.isError,
                isWarn: item.isWarn,
                lineNum: item.visualIndex, // ✅ 점프를 위해 visualIndex 저장
                prevLineNum: prevFileInfo.lineNum !== undefined ? prevFileInfo.lineNum : item.visualIndex
            };
        }

        prevSignature = currentSignature;
        prevFileInfo = {
            fileName: item.fileName || '',
            functionName: item.functionName || '',
            preview: item.preview || '',
            lineNum: item.visualIndex // ✅ visualIndex 추적
        };
    }

    // Update state in-place
    state.prevTimestamp = prevTimestamp;
    state.prevSignature = prevSignature;
    state.prevFileInfo = prevFileInfo;
};
