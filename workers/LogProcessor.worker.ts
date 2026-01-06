/* eslint-disable no-restricted-globals */
import { LogRule, LogWorkerMessage, LogWorkerResponse } from '../types';

const ctx: Worker = self as any;

// --- State ---
// File Mode
let currentFile: File | null = null;
let lineOffsets: BigInt64Array | null = null; // Map LineNum -> ByteOffset

// Stream Mode
let isStreamMode = false;
let streamLines: string[] = [];

// Common
let filteredIndices: Int32Array | null = null; // Line numbers (0-based) that match
let currentRule: LogRule | null = null;

// Bookmarks (0-based Original Index)
let originalBookmarks: Set<number> = new Set();

// --- Constants ---
const CHUNK_SIZE = 10 * 1024 * 1024;

// --- Helper: Response ---
const respond = (response: LogWorkerResponse) => {
    ctx.postMessage(response);
};

// --- Helper: Binary Search ---
function binarySearch(arr: Int32Array, val: number): number {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = arr[mid];

        if (midVal === val) {
            return mid;
        } else if (midVal < val) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}

// --- Helper: Get Visual Bookmarks ---
const getVisualBookmarks = (): number[] => {
    if (!filteredIndices) return [];

    const visualBookmarks: number[] = [];

    // Optimization: filteredIndices is always sorted.
    // Instead of iterating all N visible lines (can be millions),
    // we iterate K bookmarks (usually small) and binary search them in filteredIndices.
    // complexity: O(K * log N) where K << N usually.

    originalBookmarks.forEach(originalIdx => {
        const vIdx = binarySearch(filteredIndices!, originalIdx);
        if (vIdx !== -1) {
            visualBookmarks.push(vIdx);
        }
    });

    return visualBookmarks;
};

// --- Helper: Match Logic ---
const checkIsMatch = (line: string, rule: LogRule | null): boolean => {
    // Force include Simulated Logs (for Tizen Connection Test) regardless of rules
    if (isStreamMode && line.includes('[TEST_LOG_')) {
        return true;
    }

    if (!rule) return true;

    // "Show Shell/Raw Text Always" Bypass Logic
    // ONLY applied in Stream Mode (SDB/SSH) for shell output visibility.
    // In File Mode, we treat everything as content to be filtered strictly.
    if (isStreamMode && rule.showRawLogLines !== false) {

        // Strict Log Detection for Stream Mode
        // We want to detect standard dlogutil formats. Anything else is "Shell Output".
        const isStandardLog = (inputLine: string) => {
            // 1. Timestamp "MM-DD HH:mm:ss" or "HH:mm:ss"
            if (/\d{1,2}:\d{2}:\d{2}/.test(inputLine)) return true;
            // 2. Kernel Float "  123.456"
            if (/^\s*\[?\s*\d+\.\d+\s*\]?/.test(inputLine)) return true;
            // 3. Level/Tag "I/Tag", "W/Tag" (common in some formats)
            if (/^[A-Z]\//.test(inputLine.trim())) return true;

            return false;
        };

        if (!isStandardLog(line)) {
            // It's shell output / raw text -> Force Include
            return true;
        }
        // If it IS a standard log, fall through to normal filtering (Includes/Excludes)
    }

    // 1. Excludes
    const isBlockCaseSensitive = rule.blockListCaseSensitive;
    const excludes = rule.excludes.map(e => e.trim()).filter(e => e !== '');

    if (excludes.length > 0) {
        const lineForBlock = isBlockCaseSensitive ? line : line.toLowerCase();
        const effectiveExcludes = isBlockCaseSensitive ? excludes : excludes.map(e => e.toLowerCase());
        if (effectiveExcludes.some(exc => lineForBlock.includes(exc))) return false;
    }

    // 2. Includes
    const isHappyCaseSensitive = rule.happyCombosCaseSensitive;
    const groups = rule.includeGroups.map(g => g.map(t => t.trim()).filter(t => t !== ''));
    const meaningfulGroups = groups.filter(g => g.length > 0);

    if (meaningfulGroups.length === 0) return true; // No include filters -> Show all

    const lineForHappy = isHappyCaseSensitive ? line : line.toLowerCase();

    return meaningfulGroups.some(group => group.every(term => {
        const effectiveTerm = isHappyCaseSensitive ? term : term.toLowerCase();
        return lineForHappy.includes(effectiveTerm);
    }));
};

// ... (omitted file indexing / stream handlers)

// --- Handler: File Indexing ---
const buildFileIndex = async (file: File) => {
    isStreamMode = false;
    currentFile = file;
    streamLines = []; // Clear stream data
    originalBookmarks.clear(); // Clear bookmarks for new file

    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 0 } });

    const fileSize = file.size;

    // Optimization: Use TypedArray with growth strategy to handle millions of lines efficiently
    let capacity = 2 * 1024 * 1024; // Start with 2M lines
    let tempOffsets = new BigInt64Array(capacity);
    tempOffsets[0] = 0n;
    let lineCount = 1;

    let offset = 0n;
    let processedBytes = 0;

    const stream = file.stream() as any;
    const reader = stream.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk: Uint8Array = value;
            const chunkLen = chunk.length;

            for (let i = 0; i < chunkLen; i++) {
                if (chunk[i] === 10) { // \n
                    if (lineCount >= capacity) {
                        // Grow
                        const newCapacity = capacity * 2;
                        const newArr = new BigInt64Array(newCapacity);
                        newArr.set(tempOffsets);
                        tempOffsets = newArr;
                        capacity = newCapacity;
                    }
                    tempOffsets[lineCount++] = offset + BigInt(i) + 1n;
                }
            }
            offset += BigInt(chunkLen);
            processedBytes += chunkLen;

            if (processedBytes % (50 * 1024 * 1024) === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: (processedBytes / fileSize) * 100 } });
            }
        }
    } catch (e) {
        console.error('Indexing failed', e);
        respond({ type: 'ERROR', payload: 'Failed to index file' });
        return;
    }

    lineOffsets = tempOffsets.slice(0, lineCount);
    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 100 } });
    respond({ type: 'INDEX_COMPLETE', payload: { totalLines: lineCount } });

    // Initial Filter (All Pass)
    const all = new Int32Array(lineCount);
    for (let i = 0; i < lineCount; i++) all[i] = i;
    filteredIndices = all;

    filteredIndices = all;

    respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length, totalLines: lineCount, visualBookmarks: getVisualBookmarks() } });
};

// --- Handler: Stream Init ---
const initStream = () => {
    isStreamMode = true;
    currentFile = null;
    lineOffsets = null;
    streamLines = [];
    originalBookmarks.clear();
    streamBuffer = '';
    filteredIndices = new Int32Array(0);
    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready', mode: 'stream' } });
};

// --- Handler: Process Chunk (Stream) ---
let streamBuffer = '';

const processChunk = (chunk: string) => {
    if (!isStreamMode) return;

    const fullText = streamBuffer + chunk;
    const lines = fullText.split('\n');

    // Handle incomplete lines
    if (fullText.endsWith('\n')) {
        streamBuffer = '';
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
    } else {
        // The last segment is incomplete, save to buffer
        streamBuffer = lines.pop() || '';
    }

    if (lines.length === 0) return;

    // Clean ANSI codes from lines
    // eslint-disable-next-line no-control-regex
    const cleanLines = lines.map(line => line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''));

    const startIdx = streamLines.length;
    streamLines.push(...cleanLines);

    const newMatches: number[] = [];
    cleanLines.forEach((line, i) => {
        if (checkIsMatch(line, currentRule)) {
            newMatches.push(startIdx + i);
        }
    });

    // Append to filteredIndices
    if (filteredIndices) {
        const newArr = new Int32Array(filteredIndices.length + newMatches.length);
        newArr.set(filteredIndices);
        newArr.set(newMatches, filteredIndices.length);
        filteredIndices = newArr;
    } else {
        filteredIndices = new Int32Array(newMatches);
    }

    respond({ type: 'FILTER_COMPLETE', payload: { matchCount: filteredIndices.length, totalLines: streamLines.length, visualBookmarks: getVisualBookmarks() } });
};


// --- Handler: Apply Filter ---
const applyFilter = async (rule: LogRule) => {
    currentRule = rule;
    respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0 } });

    if (isStreamMode) {
        // Re-filter all stream lines
        const matches: number[] = [];
        streamLines.forEach((line, i) => {
            if (checkIsMatch(line, rule)) matches.push(i);
        });
        filteredIndices = new Int32Array(matches);
        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: matches.length, totalLines: streamLines.length, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    // File Mode
    if (!currentFile || !lineOffsets) return;

    // Optimization for empty rule (only if no case sensitive complications)
    // Actually safe to just use empty check
    const excludes = rule.excludes.filter(e => e.trim());
    const includes = rule.includeGroups.flat().filter(t => t.trim());

    if (excludes.length === 0 && includes.length === 0) {
        const all = new Int32Array(lineOffsets.length);
        for (let i = 0; i < lineOffsets.length; i++) all[i] = i;
        filteredIndices = all;
        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length, totalLines: lineOffsets.length, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    const matches: number[] = [];
    const reader = currentFile.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let globalLineIndex = 0;

    // ... File reading loop ...
    // To safe code size, simplified loop logic roughly same as before but using checkIsMatch

    let processedBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            buffer += chunkText;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (checkIsMatch(line, rule)) {
                    matches.push(globalLineIndex);
                }
                globalLineIndex++;
            }
            processedBytes += value.length;
            if (globalLineIndex % 10000 === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (processedBytes / currentFile!.size) * 100 } });
            }
        }

        if (buffer) {
            if (checkIsMatch(buffer, rule)) matches.push(globalLineIndex);
        }

    } catch (e) { console.error(e); }

    filteredIndices = new Int32Array(matches);
    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
    respond({ type: 'FILTER_COMPLETE', payload: { matchCount: matches.length, totalLines: lineOffsets.length, visualBookmarks: getVisualBookmarks() } });
};

// --- Handler: Get Lines ---
const getLines = async (startFilterIndex: number, count: number, requestId: string) => {
    // console.log(`[Worker] getLines request: start=${startFilterIndex}, count=${count}`);

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
        // File Mode
        if (!currentFile || !lineOffsets) {
            console.warn('[Worker] No currentFile or lineOffsets');
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        const readSlice = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.onerror = (e) => {
                    console.error('[Worker] FileReader error', e);
                    resolve('');
                };
                r.readAsText(blob);
            });
        };

        for (let i = startFilterIndex; i < max; i++) {
            const originalIdx = filteredIndices[i];

            // Safety Check
            if (originalIdx >= lineOffsets.length) {
                console.warn(`[Worker] originalIdx ${originalIdx} out of bounds (offsets: ${lineOffsets.length})`);
                continue;
            }

            const startByte = Number(lineOffsets[originalIdx]);
            // If it's the last line, read to end of file
            const endByte = originalIdx < lineOffsets.length - 1 ? Number(lineOffsets[originalIdx + 1]) : currentFile.size;

            if (startByte >= endByte) {
                resultLines.push({ lineNum: originalIdx + 1, content: '' });
                continue;
            }

            try {
                // Read exact slice for this line
                const text = await readSlice(currentFile.slice(startByte, endByte));
                // Remove trailing newline if present (offsets include it)
                const cleanText = text.replace(/\r?\n$/, '');

                resultLines.push({
                    lineNum: originalIdx + 1,
                    content: cleanText
                });
            } catch (err) {
                console.error(`[Worker] Error reading line ${originalIdx}`, err);
                resultLines.push({ lineNum: originalIdx + 1, content: '[Error reading line]' });
            }
        }
    }

    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};

// --- Handler: Get Raw Lines ---
const getRawLines = async (startLineNum: number, count: number, requestId: string) => {
    // startLineNum is 1-based index (global)
    const startIdx = startLineNum; // 0-based for array logic? No, let's treat startLineNum as 0-based index into ALL lines
    // Wait, caller passes 0-based index? 
    // Standard: requestLeftRawLines passes startLine, count. 
    // LogViewerPane passes `startIndex`.

    // Let's assume input is 0-based index.

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

        const readSlice = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.readAsText(blob);
            });
        };

        for (let i = startIdx; i < max; i++) {
            const startByte = Number(lineOffsets[i]);
            const endByte = i < lineOffsets.length - 1 ? Number(lineOffsets[i + 1]) : currentFile.size;
            if (startByte >= endByte) {
                resultLines.push({ lineNum: i + 1, content: '' });
                continue;
            }
            const text = await readSlice(currentFile.slice(startByte, endByte));
            resultLines.push({ lineNum: i + 1, content: text.replace(/\r?\n$/, '') });
        }
    }

    respond({ type: 'LINES_DATA', payload: { lines: resultLines }, requestId });
};


// --- Handler: Get Lines By Indices (for Bookmarks) ---
const getLinesByIndices = async (indices: number[], requestId: string) => {
    if (!filteredIndices) {
        respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
        return;
    }

    const resultLines: any[] = [];

    // Sort indices to optimize disk seeking (if OS optimizes)
    // But we need to map results back to request order?
    // Actually, responding with list is fine. The caller typically wants to show them in order.
    // If we sort, we return in line order. That's usually desired for "Bookmarks List".
    const sortedIndices = [...indices].sort((a, b) => a - b);

    if (isStreamMode) {
        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < filteredIndices.length) {
                const originalIdx = filteredIndices[idx];
                if (originalIdx < streamLines.length) {
                    resultLines.push({
                        lineNum: originalIdx + 1,
                        content: streamLines[originalIdx],
                        formattedLineIndex: idx // Pass back the view index for jumping
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
                r.onerror = (e) => resolve('');
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

// --- Handler: Find Highlight ---
const findHighlight = async (keyword: string, startFilterIndex: number, direction: 'next' | 'prev', requestId: string) => {
    if (!filteredIndices) {
        respond({ type: 'FIND_RESULT', payload: { foundIndex: -1 }, requestId });
        return;
    }

    let searchIdx = startFilterIndex;
    if (direction === 'next') searchIdx++; else searchIdx--;

    // Safety check for cached FileReader logic if needed, but for now we create new one per request or reuse logic
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
        // File Mode
        if (!currentFile || !lineOffsets) return;

        const readSlice = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.readAsText(blob);
            });
        };

        // Limit search depth to prevent freezing?
        // Let's search max 5000 lines for now to keep it responsive, or until end.
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


// --- Handler: Get Full Text (Optimized) ---
const getFullText = async (requestId: string) => {
    if (!filteredIndices) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }

    // Stream Mode: Collect strings (cannot do binary seek easily on stream cache without tracking offsets)
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
            ctx.postMessage({ type: 'FULL_TEXT_DATA', payload: { buffer: raw.buffer }, requestId }, [raw.buffer]);
        } catch (e) {
            console.error('Failed to encode full text', e);
            respond({ type: 'ERROR', payload: { error: 'Failed to encode text buffer' }, requestId });
        }
        return;
    }

    // File Mode: Binary Read Optimization
    if (!currentFile || !lineOffsets) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }

    try {
        // 1. Identify Contiguous Byte Ranges
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

        // 2. Merge Close Chunks (Read Clustering to reduce IOPS)
        // If the gap between chunks is small, read the continuous block to avoid FS overhead
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

                // Merge if gap is small or chunks are irrelevant (negative gap shouldn't happen here)
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

        // 3. Execute Reads & Scatter-Gather Copy
        const merged = new Uint8Array(totalLen);
        const reader = new FileReaderSync();

        for (const op of readOps) {
            const blob = currentFile.slice(op.fileStart, op.fileEnd);
            const buf = new Uint8Array(reader.readAsArrayBuffer(blob));

            for (const copy of op.subCopies) {
                // Safety subset copy
                if (copy.srcOffset < buf.length) {
                    const slice = buf.subarray(copy.srcOffset, Math.min(buf.length, copy.srcOffset + copy.len));
                    merged.set(slice, copy.dstOffset);
                }
            }
        }

        // 4. Send Buffer Directly
        ctx.postMessage({ type: 'FULL_TEXT_DATA', payload: { buffer: merged.buffer }, requestId }, [merged.buffer]);

    } catch (e) {
        console.error('Fast copy failed', e);
        respond({ type: 'ERROR', payload: { error: 'Failed to copy logs' }, requestId });
    }
};

// --- Handler: Toggle Bookmark ---
const toggleBookmark = (visualIndex: number) => {
    if (!filteredIndices) {
        console.warn('[Worker] Toggle Bookmark: No filtered indices available');
        return;
    }
    if (visualIndex < 0 || visualIndex >= filteredIndices.length) {
        console.warn(`[Worker] Toggle Bookmark: Index out of bounds (visual=${visualIndex}, max=${filteredIndices.length})`);
        return;
    }

    const originalIndex = filteredIndices[visualIndex];
    console.log(`[Worker] Toggling Bookmark: Visual=${visualIndex} -> Original=${originalIndex}`);

    if (originalBookmarks.has(originalIndex)) {
        originalBookmarks.delete(originalIndex);
        console.log(`[Worker] Bookmark REMOVED (Total: ${originalBookmarks.size})`);
    } else {
        originalBookmarks.add(originalIndex);
        console.log(`[Worker] Bookmark ADDED (Total: ${originalBookmarks.size})`);
    }

    // Return updated visual bookmarks list so frontend can sync
    const vBookmarks = getVisualBookmarks();
    console.log(`[Worker] Sending Updated Visual Bookmarks: count=${vBookmarks.length}`);
    respond({ type: 'BOOKMARKS_UPDATED', payload: { visualBookmarks: vBookmarks }, requestId: '' });
};

// --- Message Listener ---
ctx.onmessage = (evt: MessageEvent<LogWorkerMessage>) => {
    const { type, payload, requestId } = evt.data;
    switch (type) {
        case 'INIT_FILE':
            buildFileIndex(payload);
            break;
        case 'INIT_STREAM':
            initStream();
            break;
        case 'PROCESS_CHUNK':
            processChunk(payload);
            break;
        case 'FILTER_LOGS':
            applyFilter(payload as LogRule);
            break;
        case 'TOGGLE_BOOKMARK':
            toggleBookmark(payload.visualIndex);
            break;
        case 'GET_LINES':
            getLines(payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_RAW_LINES':
            getRawLines(payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_LINES_BY_INDICES':
            getLinesByIndices(payload.indices, requestId || '');
            break;
        case 'FIND_HIGHLIGHT':
            findHighlight(payload.keyword, payload.startIndex, payload.direction, requestId || '');
            break;
        case 'GET_FULL_TEXT' as any: // Cast for now until types updated
            getFullText(requestId || '');
            break;
    }
};
