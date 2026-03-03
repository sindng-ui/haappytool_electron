import { LogRule, LogWorkerResponse } from '../types';

export interface DataReaderContext {
    filteredIndices: Int32Array | null;
    isStreamMode: boolean;
    isLocalFileMode?: boolean;
    localFilePath?: string | null;
    localFileSize?: number;
    rpcCall?: (method: string, args: any) => Promise<any>;
    // ✅ 형님, 이제 문자열 배열 대신 바이너리 전용 버퍼들을 받습니다! 🐧💎
    logBuffer?: Uint8Array;
    lineOffsetsStream?: Uint32Array;
    lineLengthsStream?: Uint32Array;
    currentFile: File | null;
    lineOffsets: BigInt64Array | null;
    currentRule: LogRule | null;
    respond: (response: any) => void;
    postMessage: (message: any, transferables?: Transferable[]) => void;
}

export const getLines = async (context: DataReaderContext, startFilterIndex: number, count: number, requestId: string) => {
    const { filteredIndices, isStreamMode, logBuffer, lineOffsetsStream, lineLengthsStream, currentFile, lineOffsets, respond } = context;

    if (!filteredIndices) {
        respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
        return;
    }

    const resultLines: { lineNum: number, content: string }[] = [];
    const max = Math.min(startFilterIndex + count, filteredIndices.length);
    const decoder = new TextDecoder();

    if (isStreamMode) {
        if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        for (let i = startFilterIndex; i < max; i++) {
            const originalIdx = filteredIndices[i];
            const start = lineOffsetsStream[originalIdx];
            const len = lineLengthsStream[originalIdx];
            // ✅ Zero-copy (with slice fallback): SharedArrayBuffer cannot be decoded directly by TextDecoder
            // slice() creates a tiny non-shared copy for the decoder.
            const text = decoder.decode(logBuffer.subarray(start, start + len).slice());
            resultLines.push({ lineNum: originalIdx + 1, content: text });
        }
    } else {
        if (!context.isLocalFileMode && !currentFile) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        if (!lineOffsets || !filteredIndices) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        const maxFile = Math.min(startFilterIndex + count, filteredIndices.length);

        if (startFilterIndex >= maxFile) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        try {
            const MAX_BATCH_BYTES = 5 * 1024 * 1024;
            let i = startFilterIndex;
            while (i < maxFile) {
                let batchStart = i;
                let batchMinByte = lineOffsets[filteredIndices[i]];
                let batchMaxByte = -1n;

                let j = i;
                const batchFileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
                while (j < maxFile) {
                    const idx = filteredIndices[j];
                    const startByte = lineOffsets[idx];
                    const endByte = idx < lineOffsets.length - 1 ? lineOffsets[idx + 1] : BigInt(batchFileSize);

                    if (batchMaxByte === -1n || endByte > batchMaxByte) batchMaxByte = endByte;

                    if (j + 1 < maxFile) {
                        const nextIdx = filteredIndices[j + 1];
                        const nextEndByte = nextIdx < lineOffsets.length - 1 ? lineOffsets[nextIdx + 1] : BigInt(batchFileSize);
                        if (nextEndByte - batchMinByte > BigInt(MAX_BATCH_BYTES)) break;
                    }
                    j++;
                }

                const batchEnd = j;
                const batchSize = Number(batchMaxByte - batchMinByte);
                // console.log(`[Worker] Smart batch read: lines ${batchStart}-${batchEnd}, size: ${(batchSize / 1024).toFixed(1)} KB`);

                let uint8View: Uint8Array;
                if (context.isLocalFileMode) {
                    const startRead = performance.now();
                    uint8View = await context.rpcCall!('readFileSegment', { path: context.localFilePath, start: Number(batchMinByte), end: Number(batchMaxByte) });
                    const endRead = performance.now();
                    if (endRead - startRead > 1000) {
                        console.warn(`[Worker] Slow disk read: ${(endRead - startRead).toFixed(0)}ms for ${batchSize} bytes`);
                    }
                    if (!uint8View || uint8View.length === 0) {
                        console.error(`[Worker] readFileSegment returned EMPTY buffer for ${context.localFilePath}`);
                    }
                } else {
                    const chunkBlob = currentFile!.slice(Number(batchMinByte), Number(batchMaxByte));
                    const buffer = await chunkBlob.arrayBuffer();
                    uint8View = new Uint8Array(buffer);
                }

                for (let k = batchStart; k < batchEnd; k++) {
                    const originalIdx = filteredIndices[k];
                    const lineStart = lineOffsets[originalIdx];
                    const fileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
                    const lineEnd = originalIdx < lineOffsets.length - 1 ? lineOffsets[originalIdx + 1] : BigInt(fileSize);

                    const relStart = Number(lineStart - batchMinByte);
                    const relEnd = Number(lineEnd - batchMinByte);

                    const text = decoder.decode(uint8View.subarray(relStart, relEnd)).replace(/\r?\n$/, '');

                    resultLines.push({
                        lineNum: originalIdx + 1,
                        content: text
                    });
                }
                if (resultLines.length > 0) {
                    // console.log(`[Worker] getLines batch done. First line: ${resultLines[0].content.substring(0, 50)}`);
                }

                i = batchEnd;
            }
        } catch (err) {
            console.error('[Worker] Smart batch read failed', err);
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
    }

    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};

export const getRawLines = async (context: DataReaderContext, startLineNum: number, count: number, requestId: string) => {
    const { isStreamMode, logBuffer, lineOffsetsStream, lineLengthsStream, currentFile, lineOffsets, respond } = context;
    const startIdx = startLineNum;
    const resultLines: { lineNum: number, content: string }[] = [];
    const decoder = new TextDecoder();

    if (isStreamMode) {
        if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        // streamLineCount는 context에 직접 없으므로 lineOffsetsStream의 길이를 보거나 외부에서 주입 필요
        // 하지만 여기서는 루프 범위 제한을 위해 context 확장이 권장됨. 일단 안전패치.
        const max = Math.min(startIdx + count, lineOffsetsStream.length);
        for (let i = startIdx; i < max; i++) {
            const start = lineOffsetsStream[i];
            const len = lineLengthsStream[i];
            if (len === 0 && start === 0 && i > 0) break; // 빈 데이터 구간 도달 시 중단 (대략적 안전장치)
            const text = decoder.decode(logBuffer.subarray(start, start + len).slice());
            resultLines.push({ lineNum: i + 1, content: text });
        }
    } else {
        if (!context.isLocalFileMode && !currentFile) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        if (!lineOffsets) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        const max = Math.min(startIdx + count, lineOffsets.length);

        let minByte = -1n;
        let maxByte = -1n;
        for (let i = startIdx; i < max; i++) {
            const startByte = lineOffsets[i];
            const fileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
            const endByte = i < lineOffsets.length - 1 ? lineOffsets[i + 1] : BigInt(fileSize);
            if (minByte === -1n || startByte < minByte) minByte = startByte;
            if (maxByte === -1n || endByte > maxByte) maxByte = endByte;
        }

        try {
            if (minByte !== -1n && maxByte !== -1n) {
                let uint8View: Uint8Array;
                if (context.isLocalFileMode) {
                    uint8View = await context.rpcCall!('readFileSegment', { path: context.localFilePath, start: Number(minByte), end: Number(maxByte) });
                } else {
                    const chunkBlob = currentFile!.slice(Number(minByte), Number(maxByte));
                    const arrayBuf = await chunkBlob.arrayBuffer();
                    uint8View = new Uint8Array(arrayBuf);
                }
                const text = decoder.decode(uint8View).replace(/\r?\n$/, '');
                const lines = text.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    resultLines.push({ lineNum: startIdx + i + 1, content: lines[i] });
                }
            }
        } catch (err) {
            console.error('[Worker] getRawLines failed', err);
        }
    }
    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};

export const getSurroundingLines = async (context: DataReaderContext, absoluteIndex: number, count: number, requestId: string) => {
    const { isStreamMode, logBuffer, lineOffsetsStream, lineLengthsStream, currentFile, lineOffsets, respond } = context;
    const decoder = new TextDecoder();
    const resultLines: { lineNum: number, content: string }[] = [];

    const startIdx = Math.max(0, absoluteIndex - Math.floor(count / 2));

    if (isStreamMode) {
        if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        // streamLineCount 대신 lineOffsetsStream.length 사용 (안전장치 포함)
        const max = Math.min(startIdx + count, lineOffsetsStream.length);
        for (let i = startIdx; i < max; i++) {
            const start = lineOffsetsStream[i];
            const len = lineLengthsStream[i];
            if (len === 0 && start === 0 && i > 0) break;
            const text = decoder.decode(logBuffer.subarray(start, start + len).slice());
            resultLines.push({ lineNum: i + 1, content: text });
        }
    } else {
        if (!context.isLocalFileMode && !currentFile) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        if (!lineOffsets) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        const max = Math.min(startIdx + count, lineOffsets.length);
        let minByte = -1n;
        let maxByte = -1n;
        for (let i = startIdx; i < max; i++) {
            const startByte = lineOffsets[i];
            const fileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
            const endByte = i < lineOffsets.length - 1 ? lineOffsets[i + 1] : BigInt(fileSize);
            if (minByte === -1n || startByte < minByte) minByte = startByte;
            if (maxByte === -1n || endByte > maxByte) maxByte = endByte;
        }

        try {
            if (minByte !== -1n && maxByte !== -1n) {
                let uint8View: Uint8Array;
                if (context.isLocalFileMode) {
                    uint8View = await context.rpcCall!('readFileSegment', { path: context.localFilePath, start: Number(minByte), end: Number(maxByte) });
                } else {
                    const chunkBlob = currentFile!.slice(Number(minByte), Number(maxByte));
                    const arrayBuf = await chunkBlob.arrayBuffer();
                    uint8View = new Uint8Array(arrayBuf);
                }
                const text = decoder.decode(uint8View).replace(/\r?\n$/, '');
                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    resultLines.push({ lineNum: startIdx + i + 1, content: lines[i] });
                }
            }
        } catch (err) {
            console.error('[Worker] getSurroundingLines failed', err);
        }
    }
    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};

export const getLinesByIndices = async (context: DataReaderContext, indices: number[], requestId: string) => {
    const { filteredIndices, isStreamMode, logBuffer, lineOffsetsStream, lineLengthsStream, currentFile, lineOffsets, respond } = context;

    if (!filteredIndices) {
        respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
        return;
    }

    const resultLines: any[] = [];
    const sortedIndices = [...indices].sort((a, b) => a - b);
    const decoder = new TextDecoder();

    if (isStreamMode) {
        if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < filteredIndices.length) {
                const originalIdx = filteredIndices[idx];
                const start = lineOffsetsStream[originalIdx];
                const len = lineLengthsStream[originalIdx];
                const text = decoder.decode(logBuffer.subarray(start, start + len).slice());
                resultLines.push({
                    lineNum: originalIdx + 1,
                    content: text,
                    formattedLineIndex: idx
                });
            }
        }
    } else {
        if (!context.isLocalFileMode && !currentFile) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        if (!lineOffsets) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        const readSlice = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.onerror = () => resolve('');
                r.readAsText(blob);
            });
        };

        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < filteredIndices.length) {
                const originalIdx = filteredIndices[idx];
                if (originalIdx < lineOffsets.length) {
                    const startByte = Number(lineOffsets[originalIdx]);
                    const fileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
                    const endByte = originalIdx < lineOffsets.length - 1 ? Number(lineOffsets[originalIdx + 1]) : fileSize;

                    if (startByte < endByte) {
                        let text = '';
                        if (context.isLocalFileMode) {
                            const buffer = await context.rpcCall!('readFileSegment', { path: context.localFilePath, start: startByte, end: endByte });
                            text = decoder.decode(buffer);
                        } else {
                            text = await readSlice(currentFile!.slice(startByte, endByte));
                        }
                        resultLines.push({
                            lineNum: originalIdx + 1,
                            content: text.replace(/\r?\n$/, ''),
                            formattedLineIndex: idx
                        });
                    }
                }
            }
        }
    }

    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};

export const findHighlight = async (context: DataReaderContext, keyword: string, startFilterIndex: number, direction: 'next' | 'prev', requestId: string) => {
    const { filteredIndices, isStreamMode, logBuffer, lineOffsetsStream, lineLengthsStream, currentFile, lineOffsets, currentRule, respond } = context;

    if (!filteredIndices) {
        respond({ type: 'FIND_RESULT', payload: { foundIndex: -1 }, requestId });
        return;
    }

    let searchIdx = startFilterIndex;
    if (direction === 'next') searchIdx++; else searchIdx--;

    const isCaseSensitive = currentRule?.colorHighlightsCaseSensitive || false;
    const effectiveKeyword = isCaseSensitive ? keyword : keyword.toLowerCase();
    const decoder = new TextDecoder();

    if (isStreamMode) {
        if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) return;
        while (searchIdx >= 0 && searchIdx < filteredIndices.length) {
            const originalIdx = filteredIndices[searchIdx];
            const start = lineOffsetsStream[originalIdx];
            const len = lineLengthsStream[originalIdx];
            const line = decoder.decode(logBuffer.subarray(start, start + len).slice());
            const lineCheck = isCaseSensitive ? line : line.toLowerCase();
            if (lineCheck.includes(effectiveKeyword)) {
                respond({ type: 'FIND_RESULT', payload: { foundIndex: searchIdx, originalLineNum: originalIdx + 1 }, requestId });
                return;
            }
            if (direction === 'next') searchIdx++; else searchIdx--;
        }
    } else {
        if (!context.isLocalFileMode && !currentFile) return;
        if (!lineOffsets) return;

        const readSlice = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.readAsText(blob);
            });
        };

        while (searchIdx >= 0 && searchIdx < filteredIndices.length) {
            const originalLineNum = filteredIndices[searchIdx];
            const startByte = Number(lineOffsets[originalLineNum]);
            const fileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
            const endByte = originalLineNum < lineOffsets.length - 1 ? Number(lineOffsets[originalLineNum + 1]) : fileSize;

            if (startByte < endByte) {
                let line = '';
                if (context.isLocalFileMode) {
                    const buffer = await context.rpcCall!('readFileSegment', { path: context.localFilePath, start: startByte, end: endByte });
                    line = decoder.decode(buffer);
                } else {
                    line = await readSlice(currentFile!.slice(startByte, endByte));
                }
                const lineCheck = isCaseSensitive ? line : line.toLowerCase();
                if (lineCheck.includes(effectiveKeyword)) {
                    respond({ type: 'FIND_RESULT', payload: { foundIndex: searchIdx, originalLineNum: originalLineNum + 1 }, requestId });
                    return;
                }
            }
            if (direction === 'next') searchIdx++; else searchIdx--;
        }
    }

    respond({ type: 'FIND_RESULT', payload: { foundIndex: -1, originalLineNum: -1 }, requestId });
};

export const getFullText = async (context: DataReaderContext, requestId: string) => {
    const { filteredIndices, isStreamMode, logBuffer, lineOffsetsStream, lineLengthsStream, currentFile, lineOffsets, respond, postMessage } = context;

    if (!filteredIndices) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }

    if (isStreamMode) {
        if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) {
            respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
            return;
        }
        const decoder = new TextDecoder();
        const lines: string[] = [];
        for (let i = 0; i < filteredIndices.length; i++) {
            const originalIdx = filteredIndices[i];
            const start = lineOffsetsStream[originalIdx];
            const len = lineLengthsStream[originalIdx];
            lines.push(decoder.decode(logBuffer.subarray(start, start + len).slice()));
        }
        const fullText = lines.join('\n');
        try {
            const encoder = new TextEncoder();
            const raw = encoder.encode(fullText);
            postMessage({ type: 'FULL_TEXT_DATA', payload: { buffer: raw.buffer }, requestId }, [raw.buffer]);
        } catch (e) {
            console.error('Failed to encode full text', e);
            respond({ type: 'ERROR', payload: { error: 'Failed to encode text buffer' }, requestId });
        }
        return;
    }

    if (!context.isLocalFileMode && !currentFile) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }
    if (!lineOffsets) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }

    try {
        const rawChunks: { start: number, end: number }[] = [];
        let rangeStartIdx = 0;
        let totalLen = 0;

        for (let i = 0; i < filteredIndices.length; i++) {
            const currentLine = filteredIndices[i];
            const nextLine = (i + 1 < filteredIndices.length) ? filteredIndices[i + 1] : -2;

            if (nextLine !== currentLine + 1) {
                const startLine = filteredIndices[rangeStartIdx];
                const endLine = currentLine;

                const startByte = Number(lineOffsets[startLine]);
                const endByteLine = endLine < lineOffsets.length - 1 ? endLine + 1 : -1;
                const fileSize = context.isLocalFileMode ? context.localFileSize! : currentFile!.size;
                const endByte = endByteLine !== -1 ? Number(lineOffsets[endByteLine]) : fileSize;

                if (startByte < endByte) {
                    rawChunks.push({ start: startByte, end: endByte });
                    totalLen += (endByte - startByte);
                }
                rangeStartIdx = i + 1;
            }
        }

        const GAP_THRESHOLD = 64 * 1024; // 64KB
        const readOps: { fileStart: number, fileEnd: number, subCopies: { srcOffset: number, len: number, dstOffset: number }[] }[] = [];

        let currentDstOffset = 0;

        if (rawChunks.length > 0) {
            let currentOp = {
                fileStart: rawChunks[0].start,
                fileEnd: rawChunks[0].end,
                subCopies: [{ srcOffset: 0, len: rawChunks[0].end - rawChunks[0].start, dstOffset: 0 }]
            };
            currentDstOffset += (rawChunks[0].end - rawChunks[0].start);

            for (let i = 1; i < rawChunks.length; i++) {
                const chunk = rawChunks[i];
                const gap = chunk.start - currentOp.fileEnd;

                if (gap < GAP_THRESHOLD) {
                    const srcOffset = chunk.start - currentOp.fileStart;
                    const len = chunk.end - chunk.start;
                    currentOp.subCopies.push({ srcOffset, len, dstOffset: currentDstOffset });
                    currentOp.fileEnd = chunk.end;
                } else {
                    readOps.push(currentOp);
                    currentOp = {
                        fileStart: chunk.start,
                        fileEnd: chunk.end,
                        subCopies: [{ srcOffset: 0, len: chunk.end - chunk.start, dstOffset: currentDstOffset }]
                    };
                }
                currentDstOffset += (chunk.end - chunk.start);
            }
            readOps.push(currentOp);
        }

        const merged = new Uint8Array(totalLen);
        const reader = new FileReaderSync();

        for (const op of readOps) {
            let buf: Uint8Array;
            if (context.isLocalFileMode) {
                buf = await context.rpcCall!('readFileSegment', { path: context.localFilePath, start: op.fileStart, end: op.fileEnd });
            } else {
                const blob = currentFile!.slice(op.fileStart, op.fileEnd);
                buf = new Uint8Array(reader.readAsArrayBuffer(blob));
            }

            for (const copy of op.subCopies) {
                if (copy.srcOffset < buf.length) {
                    const slice = buf.subarray(copy.srcOffset, Math.min(buf.length, copy.srcOffset + copy.len));
                    merged.set(slice, copy.dstOffset);
                }
            }
        }

        postMessage({ type: 'FULL_TEXT_DATA', payload: { buffer: merged.buffer }, requestId }, [merged.buffer]);

    } catch (e) {
        console.error('Fast copy failed', e);
        respond({ type: 'ERROR', payload: { error: 'Failed to copy logs' }, requestId });
    }
};
