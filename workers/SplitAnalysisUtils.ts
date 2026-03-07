import { LogMetadata } from '../types';

export interface AggregateMetrics {
    [key: string]: {
        count: number;
        totalDelta: number;
        deltaSamples: number;
        tids: string[]; // Use array for serialization
        preview: string;
        fileName: string;
        functionName: string;
        prevPreview?: string;
        prevFileName?: string;
        prevFunctionName?: string;
        isError: boolean;
        isWarn: boolean;
    };
}

export const computeMetricsFromMetadata = (
    data: LogMetadata[],
    existingMetrics: AggregateMetrics = {},
    state: { prevTimestamp: number | null; prevSignature: string; prevFileInfo: any } = {
        prevTimestamp: null,
        prevSignature: 'START',
        prevFileInfo: { fileName: '', functionName: '', preview: '' }
    }
): { metrics: AggregateMetrics; state: any } => {
    const metrics = existingMetrics;
    let { prevTimestamp, prevSignature, prevFileInfo } = state;

    for (const item of data) {
        let currentSignature = '';
        if (item.fileName || item.functionName) {
            currentSignature = `${item.fileName || 'Unknown'}::${item.functionName || 'Unknown'}`;
        } else {
            // 형님, 알파벳과 한글 등 '글자'만 남기고 숫자/특수문자/공백은 싹 다 밀어서 매칭률을 최고조로 끌어올렸습니다! 🚀
            currentSignature = item.preview.replace(/[^a-zA-Z\uAC00-\uD7A3]/g, '').substring(0, 60);
            if (currentSignature.length < 3) {
                // 글자가 너무 없으면 원본에서 숫자만 뺀 버전으로 fallback
                currentSignature = item.preview.replace(/[\d]/g, '').substring(0, 30);
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
            // Simple check to avoid duplicated TIDs if needed, 
            // but for summary, we can compromise or use a Set locally
            if (item.tid && !existing.tids.includes(item.tid)) {
                if (existing.tids.length < 100) { // Limit TIDs to prevent bloat
                    existing.tids.push(item.tid);
                }
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
                isWarn: item.isWarn
            };
        }

        prevSignature = currentSignature;
        prevFileInfo = {
            fileName: item.fileName || '',
            functionName: item.functionName || '',
            preview: item.preview || ''
        };
    }

    if (data.length > 0) {
        console.log(`[SplitAnalysisUtils] Computing metrics for ${data.length} lines. Sample timestamp: ${data[0].timestamp}`);
    }
    return { metrics, state: { prevTimestamp, prevSignature, prevFileInfo } };
};
