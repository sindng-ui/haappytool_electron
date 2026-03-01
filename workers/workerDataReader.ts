import { LogRule, LogWorkerResponse } from '../types';

export interface DataReaderContext {
    filteredIndices: Int32Array | null;
    isStreamMode: boolean;
    streamLines: string[];
    currentFile: File | null;
    lineOffsets: BigInt64Array | null;
    currentRule: LogRule | null;
    respond: (response: any) => void;
    postMessage: (message: any, transferables?: Transferable[]) => void;
}

export const getLines = async (context: DataReaderContext, startFilterIndex: number, count: number, requestId: string) => {
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, respond } = context;

    if (!filteredIndices) {
        console.warn('[Worker] No filteredIndices available');
        respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
        return;
    }

    const resultLines: { lineNum: number, content: string }[] = [];
    const max = Math.min(startFilterIndex + count, filteredIndices.length);

    if (isStreamMode) {
        for (let i = startFilterIndex; i < max; i++) {
            const originalIdx = filteredIndices[i];
            if (originalIdx < streamLines.length) {
                resultLines.push({ lineNum: originalIdx + 1, content: streamLines[originalIdx] });
            }
        }
    } else {
        if (!currentFile || !lineOffsets || !filteredIndices) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        const maxFile = Math.min(startFilterIndex + count, filteredIndices.length);

        if (startFilterIndex >= maxFile) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        const decoder = new TextDecoder();

        try {
            // ✅ Smart Batching: 행 간격이 너무 벌어질 경우(5MB 초과) 분할 읽기 수행
            const MAX_BATCH_BYTES = 5 * 1024 * 1024;

            let i = startFilterIndex;
            while (i < maxFile) {
                let batchStart = i;
                let batchMinByte = lineOffsets[filteredIndices[i]];
                let batchMaxByte = -1n;

                // 현재 배치에 포함할 행들 결정 (최대 5MB)
                let j = i;
                while (j < maxFile) {
                    const idx = filteredIndices[j];
                    const startByte = lineOffsets[idx];
                    const endByte = idx < lineOffsets.length - 1 ? lineOffsets[idx + 1] : BigInt(currentFile.size);

                    if (batchMaxByte === -1n || endByte > batchMaxByte) batchMaxByte = endByte;

                    // 다음 행을 포함했을 때 5MB를 초과하면 여기서 끊음
                    if (j + 1 < maxFile) {
                        const nextIdx = filteredIndices[j + 1];
                        const nextEndByte = nextIdx < lineOffsets.length - 1 ? lineOffsets[nextIdx + 1] : BigInt(currentFile.size);
                        if (nextEndByte - batchMinByte > BigInt(MAX_BATCH_BYTES)) break;
                    }
                    j++;
                }

                const batchEnd = j;
                const chunkBlob = currentFile.slice(Number(batchMinByte), Number(batchMaxByte));
                const buffer = await chunkBlob.arrayBuffer();
                const uint8View = new Uint8Array(buffer);

                for (let k = batchStart; k < batchEnd; k++) {
                    const originalIdx = filteredIndices[k];
                    const lineStart = lineOffsets[originalIdx];
                    const lineEnd = originalIdx < lineOffsets.length - 1 ? lineOffsets[originalIdx + 1] : BigInt(currentFile.size);

                    const relStart = Number(lineStart - batchMinByte);
                    const relEnd = Number(lineEnd - batchMinByte);

                    // ✅ Zero-copy: subarray로 필요한 부분만 참조하여 디코딩
                    const text = decoder.decode(uint8View.subarray(relStart, relEnd)).replace(/\r?\n$/, '');

                    resultLines.push({
                        lineNum: originalIdx + 1,
                        content: text
                    });
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
    const { isStreamMode, streamLines, currentFile, lineOffsets, respond } = context;
    const startIdx = startLineNum;
    const resultLines: { lineNum: number, content: string }[] = [];

    if (isStreamMode) {
        const max = Math.min(startIdx + count, streamLines.length);
        for (let i = startIdx; i < max; i++) {
            resultLines.push({ lineNum: i + 1, content: streamLines[i] });
        }
    } else {
        if (!currentFile || !lineOffsets) {
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
        const max = Math.min(startIdx + count, lineOffsets.length);

        // ✅ Batch Reading Optimization for Raw Lines
        let minByte = -1n;
        let maxByte = -1n;
        for (let i = startIdx; i < max; i++) {
            const startByte = lineOffsets[i];
            const endByte = i < lineOffsets.length - 1 ? lineOffsets[i + 1] : BigInt(currentFile.size);
            if (minByte === -1n || startByte < minByte) minByte = startByte;
            if (maxByte === -1n || endByte > maxByte) maxByte = endByte;
        }

        try {
            if (minByte !== -1n && maxByte !== -1n) {
                const fullBlob = currentFile.slice(Number(minByte), Number(maxByte));
                const buffer = await fullBlob.arrayBuffer();
                const decoder = new TextDecoder();

                for (let i = startIdx; i < max; i++) {
                    const lineStart = lineOffsets[i];
                    const lineEnd = i < lineOffsets.length - 1 ? lineOffsets[i + 1] : BigInt(currentFile.size);

                    if (lineStart >= lineEnd) {
                        resultLines.push({ lineNum: i + 1, content: '' });
                        continue;
                    }

                    const relStart = Number(lineStart - minByte);
                    const relEnd = Number(lineEnd - minByte);

                    const lineBuffer = buffer.slice(relStart, relEnd);
                    const text = decoder.decode(lineBuffer).replace(/\r?\n$/, '');

                    resultLines.push({ lineNum: i + 1, content: text });
                }
            }
        } catch (err) {
            console.error('[Worker] Raw batch read failed', err);
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }
    }

    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};

export const getLinesByIndices = async (context: DataReaderContext, indices: number[], requestId: string) => {
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, respond } = context;

    if (!filteredIndices) {
        respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
        return;
    }

    const resultLines: any[] = [];
    const sortedIndices = [...indices].sort((a, b) => a - b);

    if (isStreamMode) {
        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < filteredIndices.length) {
                const originalIdx = filteredIndices[idx];
                if (originalIdx < streamLines.length) {
                    resultLines.push({
                        lineNum: originalIdx + 1,
                        content: streamLines[originalIdx],
                        formattedLineIndex: idx
                    });
                }
            }
        }
    } else {
        if (!currentFile || !lineOffsets) {
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
                    const endByte = originalIdx < lineOffsets.length - 1 ? Number(lineOffsets[originalIdx + 1]) : currentFile.size;

                    if (startByte < endByte) {
                        const text = await readSlice(currentFile.slice(startByte, endByte));
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
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, currentRule, respond } = context;

    if (!filteredIndices) {
        respond({ type: 'FIND_RESULT', payload: { foundIndex: -1 }, requestId });
        return;
    }

    let searchIdx = startFilterIndex;
    if (direction === 'next') searchIdx++; else searchIdx--;

    const isCaseSensitive = currentRule?.colorHighlightsCaseSensitive || false;
    const effectiveKeyword = isCaseSensitive ? keyword : keyword.toLowerCase();

    if (isStreamMode) {
        while (searchIdx >= 0 && searchIdx < filteredIndices.length) {
            const originalIdx = filteredIndices[searchIdx];
            if (originalIdx < streamLines.length) {
                const line = streamLines[originalIdx];
                const lineCheck = isCaseSensitive ? line : line.toLowerCase();
                if (lineCheck.includes(effectiveKeyword)) {
                    respond({ type: 'FIND_RESULT', payload: { foundIndex: searchIdx, originalLineNum: originalIdx + 1 }, requestId });
                    return;
                }
            }
            if (direction === 'next') searchIdx++; else searchIdx--;
        }
    } else {
        if (!currentFile || !lineOffsets) return;

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
            const endByte = originalLineNum < lineOffsets.length - 1 ? Number(lineOffsets[originalLineNum + 1]) : currentFile.size;

            if (startByte < endByte) {
                const line = await readSlice(currentFile.slice(startByte, endByte));
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
    const { filteredIndices, isStreamMode, streamLines, currentFile, lineOffsets, respond, postMessage } = context;

    if (!filteredIndices) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }

    if (isStreamMode) {
        const lines: string[] = [];
        for (let i = 0; i < filteredIndices.length; i++) {
            const originalIdx = filteredIndices[i];
            if (originalIdx < streamLines.length) {
                lines.push(streamLines[originalIdx]);
            }
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

    if (!currentFile || !lineOffsets) {
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
                const endByte = endByteLine !== -1 ? Number(lineOffsets[endByteLine]) : currentFile.size;

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
            const blob = currentFile.slice(op.fileStart, op.fileEnd);
            const buf = new Uint8Array(reader.readAsArrayBuffer(blob));

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
