import { LogRule, LogWorkerResponse } from '../types';
import { extractTimestamp } from '../utils/logTime';
import { analyzePerfSegments, extractSourceMetadata } from '../utils/perfAnalysis';

export interface WorkerContext {
    currentFile: File | null;
    lineOffsets: BigInt64Array | null;
    filteredIndices: Int32Array | null;
    isStreamMode: boolean;
    streamLines: string[];
    respond: (response: LogWorkerResponse) => void;
    currentRule: LogRule | null;
}

// --- Handler: Analyze Performance ---
export const analyzePerformance = async (
    ctx: WorkerContext,
    payload: { targetTime: number, updatedRule?: LogRule },
    requestId: string
) => {
    let { currentRule, filteredIndices, currentFile, lineOffsets, isStreamMode, streamLines, respond } = ctx;

    if (payload.updatedRule) {
        currentRule = payload.updatedRule;
    }

    if (!filteredIndices || !currentRule) {
        respond({ type: 'PERF_ANALYSIS_RESULT', payload: null, requestId });
        return;
    }

    respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0 } });

    const results: string[] = [];
    const lineIndices: number[] = [];
    const isFile = !!currentFile && !!lineOffsets;
    const isHappyCS = !!currentRule.happyCombosCaseSensitive;

    const MAX_ANALYSIS_LINES = 100000;
    let limit = filteredIndices.length;

    if (limit > MAX_ANALYSIS_LINES) {
        console.warn(`[Worker] Performance analysis limited to first ${MAX_ANALYSIS_LINES} lines to prevent OOM.`);
        limit = MAX_ANALYSIS_LINES;
        respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0, message: 'Analysis limited to 100k lines' } });
    }

    if (isStreamMode) {
        for (let idx = 0; idx < limit; idx++) {
            const i = filteredIndices[idx];
            results.push(streamLines[i]);
            lineIndices.push(idx);
        }
    } else if (isFile) {
        const reader = new FileReaderSync();
        const BATCH_SIZE = 5000;

        for (let idx = 0; idx < limit; idx += BATCH_SIZE) {
            const maxBatch = Math.min(idx + BATCH_SIZE, limit);
            let minByte = -1n;
            let maxByte = -1n;

            for (let k = idx; k < maxBatch; k++) {
                const i = filteredIndices[k];
                const start = lineOffsets![i];
                const end = (i < lineOffsets!.length - 1) ? lineOffsets![i + 1] : BigInt(currentFile!.size);
                if (minByte === -1n || start < minByte) minByte = start;
                if (maxByte === -1n || end > maxByte) maxByte = end;
            }

            if (minByte !== -1n) {
                const fullBlob = currentFile!.slice(Number(minByte), Number(maxByte));
                const buffer = reader.readAsArrayBuffer(fullBlob);
                const decoder = new TextDecoder();

                for (let k = idx; k < maxBatch; k++) {
                    const i = filteredIndices[k];
                    const lineStart = lineOffsets![i];
                    const lineEnd = (i < lineOffsets!.length - 1) ? lineOffsets![i + 1] : BigInt(currentFile!.size);

                    const relStart = Number(lineStart - minByte);
                    const relEnd = Number(lineEnd - minByte);
                    const lineBuffer = buffer.slice(relStart, relEnd);
                    const text = decoder.decode(lineBuffer).replace(/\r?\n$/, '');

                    results.push(text);
                    lineIndices.push(k);
                }
            }

            if (idx % (BATCH_SIZE * 2) === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (idx / limit) * 100 } });
            }
        }
    }

    const targetThreshold = currentRule.perfThreshold ?? payload.targetTime ?? 1000;
    const segments = analyzePerfSegments(results, lineIndices, currentRule, targetThreshold, isHappyCS);

    if (filteredIndices) {
        segments.forEach(s => {
            s.originalStartLine = (filteredIndices![s.startLine] ?? 0) + 1;
            s.originalEndLine = (filteredIndices![s.endLine] ?? 0) + 1;
        });
    }

    const hasSegments = segments.length > 0;
    const firstTs = hasSegments ? Math.min(...segments.map(s => s.startTime)) : 0;
    const lastTs = hasSegments ? Math.max(...segments.map(s => s.endTime)) : 0;

    const bottlenecks = [...segments]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 100);

    const analysisResult = {
        fileName: isFile ? currentFile!.name : 'Live Stream',
        totalDuration: lastTs - firstTs,
        segments: segments.sort((a, b) => a.startTime - b.startTime),
        startTime: firstTs,
        endTime: lastTs,
        logCount: results.length,
        passCount: segments.filter(s => s.status === 'pass').length,
        failCount: segments.filter(s => s.status === 'fail').length,
        bottlenecks,
        perfThreshold: targetThreshold
    };

    respond({ type: 'PERF_ANALYSIS_RESULT', payload: analysisResult, requestId });
    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });

    results.length = 0;
    lineIndices.length = 0;
    segments.length = 0;
};

// --- Handler: Get Performance Heatmap ---
export const getPerformanceHeatmap = async (
    ctx: WorkerContext,
    points: number = 500,
    requestId: string,
    isCalculatingHeatmapRef: { current: boolean }
) => {
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, respond } = ctx;

    if (isCalculatingHeatmapRef.current) {
        console.log(`[Worker] Heatmap calculation skipped: Already calculating. (req: ${requestId})`);
        return;
    }

    const hasFileData = !isStreamMode && currentFile && lineOffsets;
    const hasStreamData = isStreamMode && streamLines.length > 0;

    if (!filteredIndices || (!hasFileData && !hasStreamData)) {
        return;
    }

    const totalLines = filteredIndices.length;
    if (totalLines < 2) {
        respond({ type: 'HEATMAP_DATA', payload: { heatmap: [] }, requestId });
        return;
    }

    isCalculatingHeatmapRef.current = true;
    try {
        const heatmap = new Float32Array(points);
        const sampleSize = Math.max(1, Math.floor(totalLines / points));
        const decoder = new TextDecoder();

        for (let i = 0; i < points; i++) {
            const startIdx = i * sampleSize;
            if (startIdx >= totalLines - 1) break;

            try {
                const idx1 = filteredIndices[startIdx];
                const idx2 = filteredIndices[startIdx + 1];

                let t1: number | null = null;
                let t2: number | null = null;

                if (isStreamMode) {
                    t1 = extractTimestamp(streamLines[idx1]);
                    t2 = extractTimestamp(streamLines[idx2]);
                } else if (currentFile && lineOffsets) {
                    const startByte1 = lineOffsets[idx1];
                    const endByte1 = idx1 < lineOffsets.length - 1 ? lineOffsets[idx1 + 1] : BigInt(currentFile.size);
                    const startByte2 = lineOffsets[idx2];
                    const endByte2 = idx2 < lineOffsets.length - 1 ? lineOffsets[idx2 + 1] : BigInt(currentFile.size);

                    const minByte = startByte1;
                    const maxByte = endByte2;

                    if (maxByte - minByte > 1024 * 1024) {
                        heatmap[i] = 0;
                        continue;
                    }

                    const chunk = await currentFile.slice(Number(minByte), Number(maxByte)).arrayBuffer();
                    const text1 = decoder.decode(chunk.slice(0, Number(endByte1 - minByte))).replace(/\r?\n$/, '');
                    const text2 = decoder.decode(chunk.slice(Number(startByte2 - minByte))).replace(/\r?\n$/, '');

                    t1 = extractTimestamp(text1);
                    t2 = extractTimestamp(text2);
                }

                if (t1 !== null && t2 !== null) {
                    const diff = Math.abs(t2 - t1);
                    heatmap[i] = Math.min(1.0, diff / 1000);
                }
            } catch (e) { }
        }

        respond({ type: 'HEATMAP_DATA', payload: { heatmap: Array.from(heatmap) }, requestId });
    } finally {
        isCalculatingHeatmapRef.current = false;
    }
};

// --- Handler: Spam Log Analysis ---
export const analyzeSpamLogs = async (
    ctx: WorkerContext,
    requestId: string
) => {
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, respond } = ctx;

    const indicesSnapshot = filteredIndices ? new Int32Array(filteredIndices) : null;
    const streamLinesSnapshot = isStreamMode ? [...streamLines] : null;
    const isFile = !!currentFile && !!lineOffsets;

    if (!indicesSnapshot || (!isFile && !streamLinesSnapshot)) {
        respond({ type: 'SPAM_ANALYSIS_RESULT', payload: { results: [] }, requestId } as any);
        return;
    }

    respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0 } });

    const spamMap = new Map<string, { count: number, lineContent: string, fileName: string, functionName: string, lineNum: number, indices: number[] }>();

    const processSpamLine = (line: string, lineNum: number, originalIndex: number) => {
        const { fileName, functionName } = extractSourceMetadata(line);
        let key = '';
        let fName = fileName || 'Unknown File';
        let fnName = functionName || 'Unknown Location';

        if (fileName || functionName) {
            key = `${fName}::${fnName}`;
        } else {
            const messagePart = line.split('>').slice(1).join('>').trim() || line;
            const fingerprint = messagePart.replace(/[\d:\-\.\[\]\s]/g, '').substring(0, 60);
            key = fingerprint;
            if (key.length < 10) return;
        }

        const existing = spamMap.get(key);
        if (existing) {
            existing.count++;
            existing.indices.push(originalIndex);
        } else {
            spamMap.set(key, {
                count: 1,
                lineContent: line,
                fileName: fName,
                functionName: fnName,
                lineNum,
                indices: [originalIndex]
            });
        }
    };

    const totalLines = indicesSnapshot.length;

    if (isStreamMode && streamLinesSnapshot) {
        for (let i = 0; i < totalLines; i++) {
            const originalIdx = indicesSnapshot[i];
            if (originalIdx < streamLinesSnapshot.length) {
                const line = streamLinesSnapshot[originalIdx];
                processSpamLine(line, originalIdx + 1, originalIdx);
            }
            if (i % 20000 === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (i / totalLines) * 100 } });
            }
        }
    } else if (isFile && currentFile && lineOffsets) {
        const decoder = new TextDecoder();
        const MAX_SPAM_CHUNK_BYTES = 10 * 1024 * 1024;

        let i = 0;
        while (i < totalLines) {
            let chunkStartIdx = i;
            let minByte = lineOffsets[indicesSnapshot[i]];
            let maxByte = -1n;

            let j = i;
            while (j < totalLines) {
                const idx = indicesSnapshot[j];
                const endByte = idx < lineOffsets.length - 1 ? lineOffsets[idx + 1] : BigInt(currentFile.size);
                if (maxByte === -1n || endByte > maxByte) maxByte = endByte;

                if (j - i >= 50000) break;
                if (j + 1 < totalLines) {
                    const nextIdx = indicesSnapshot[j + 1];
                    const nextEndByte = nextIdx < lineOffsets.length - 1 ? lineOffsets[nextIdx + 1] : BigInt(currentFile.size);
                    if (nextEndByte - minByte > BigInt(MAX_SPAM_CHUNK_BYTES)) break;
                }
                j++;
            }

            const chunkEndIdx = Math.min(j + 1, totalLines);
            if (maxByte > minByte) {
                try {
                    const chunkBlob = currentFile.slice(Number(minByte), Number(maxByte));
                    const buffer = await chunkBlob.arrayBuffer();
                    const uint8View = new Uint8Array(buffer);

                    for (let k = chunkStartIdx; k < chunkEndIdx; k++) {
                        const originalIdx = indicesSnapshot[k];
                        const lineStart = lineOffsets[originalIdx];
                        const lineEnd = originalIdx < lineOffsets.length - 1 ? lineOffsets[originalIdx + 1] : BigInt(currentFile.size);

                        if (lineStart >= lineEnd) continue;

                        const relStart = Number(lineStart - minByte);
                        const relEnd = Number(lineEnd - minByte);

                        const line = decoder.decode(uint8View.subarray(relStart, relEnd)).replace(/\r?\n$/, '');
                        processSpamLine(line, originalIdx + 1, originalIdx);
                    }
                } catch (err) {
                    console.error('[Worker] Spam chunk processing failed', err);
                }
            }

            i = chunkEndIdx;
            respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (i / totalLines) * 100 } });
        }
    }

    const results = Array.from(spamMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);

    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
    respond({ type: 'SPAM_ANALYSIS_RESULT', payload: { results }, requestId } as any);
};

// --- Handler: Analyze Transaction ---
export const analyzeTransaction = async (
    ctx: WorkerContext,
    identity: { type: 'pid' | 'tid' | 'tag', value: string },
    requestId: string
) => {
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, respond } = ctx;
    const results: { lineNum: number, content: string, visualIndex: number }[] = [];
    const val = identity.value;
    const isFile = !!currentFile && !!lineOffsets;

    respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0 } });

    if (!filteredIndices) {
        respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    const lowerVal = val.toLowerCase();
    let regex: RegExp | null = null;

    if (identity.type === 'pid' || identity.type === 'tid') {
        const regexVal = val.replace(/^(P|T)(\d+)$/i, '$1\\s*$2');
        regex = new RegExp(`(?:^|[^0-9a-zA-Z])${regexVal}(?:$|[^0-9a-zA-Z])`, 'i');
    }

    const MAX_RESULTS = 100000;

    if (isStreamMode) {
        for (let idx = 0; idx < filteredIndices.length; idx++) {
            if (results.length >= MAX_RESULTS) break;

            const i = filteredIndices[idx];
            const line = streamLines[i];
            if (!line) continue;

            let match = false;
            if (regex) match = regex.test(line);
            else match = line.toLowerCase().includes(lowerVal);

            if (match) {
                results.push({
                    lineNum: i + 1,
                    content: line,
                    visualIndex: idx
                });
            }
        }
    } else if (isFile) {
        const reader = new FileReaderSync();
        const totalFiltered = filteredIndices.length;
        const BATCH_SIZE = 5000;

        for (let idx = 0; idx < totalFiltered; idx += BATCH_SIZE) {
            if (results.length >= MAX_RESULTS) break;

            const maxBatch = Math.min(idx + BATCH_SIZE, totalFiltered);
            let minByte = -1n;
            let maxByte = -1n;
            for (let k = idx; k < maxBatch; k++) {
                const i = filteredIndices[k];
                const start = lineOffsets![i];
                const end = (i < lineOffsets!.length - 1) ? lineOffsets![i + 1] : BigInt(currentFile!.size);
                if (minByte === -1n || start < minByte) minByte = start;
                if (maxByte === -1n || end > maxByte) maxByte = end;
            }

            if (minByte !== -1n) {
                const fullBlob = currentFile!.slice(Number(minByte), Number(maxByte));
                const buffer = reader.readAsArrayBuffer(fullBlob);
                const decoder = new TextDecoder();

                for (let k = idx; k < maxBatch; k++) {
                    if (results.length >= MAX_RESULTS) break;

                    const i = filteredIndices[k];
                    const lineStart = lineOffsets![i];
                    const lineEnd = (i < lineOffsets!.length - 1) ? lineOffsets![i + 1] : BigInt(currentFile!.size);

                    const relStart = Number(lineStart - minByte);
                    const relEnd = Number(lineEnd - minByte);
                    const lineBuffer = buffer.slice(relStart, relEnd);
                    const text = decoder.decode(lineBuffer).replace(/\r?\n$/, '');

                    let match = false;
                    if (regex) match = regex.test(text);
                    else match = text.toLowerCase().includes(lowerVal);

                    if (match) {
                        results.push({
                            lineNum: i + 1,
                            content: text,
                            visualIndex: k
                        });
                    }
                }
            }

            if (idx % (BATCH_SIZE * 2) === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (idx / totalFiltered) * 100 } });
            }
        }
    }

    respond({ type: 'LINES_DATA', payload: { lines: results }, requestId });
    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
};
