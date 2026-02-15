/* eslint-disable no-restricted-globals */
import { LogRule, LogWorkerMessage, LogWorkerResponse } from '../types';

const ctx: Worker = self as any;

// --- State ---
// WASM Filter Engine & Memory
let wasmEngine: any = null;
let wasmMemory: WebAssembly.Memory | null = null;
const textEncoder = new TextEncoder();

// Initialize WASM Engine (Vite handles the loading)
const initWasm = async () => {
    try {
        const wasm = await import('../src/wasm/happy_filter');
        const instance = await wasm.default(); // Init wasm-bindgen and returns exports
        wasmMemory = (instance as any).memory;
        wasmEngine = new wasm.FilterEngine(false);
        console.log('WASM Filter Engine initialized with Zero-copy & DFA support');
    } catch (e) {
        console.warn('WASM initialization failed, falling back to JS filter:', e);
    }
};

initWasm();

// --- Parallelism: Worker Pool for Heavy Filtering ---
const numSubWorkers = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
const subWorkers: Worker[] = [];
let subWorkerIdleTimer: any = null;
const SUB_WORKER_IDLE_TIMEOUT = 30000; // 30초 후 워커 종료

const terminateSubWorkers = () => {
    if (subWorkers.length === 0) return;
    console.log('[Worker] Idle timeout reached. Terminating sub-workers to save RAM.');
    subWorkers.forEach(sw => sw.terminate());
    subWorkers.length = 0;
};

const resetSubWorkerIdleTimer = () => {
    if (subWorkerIdleTimer) clearTimeout(subWorkerIdleTimer);
    subWorkerIdleTimer = setTimeout(terminateSubWorkers, SUB_WORKER_IDLE_TIMEOUT);
};

const initSubWorkers = () => {
    if (subWorkerIdleTimer) clearTimeout(subWorkerIdleTimer); // 일단 작업 시작하면 타이머 해제
    if (subWorkers.length > 0) return;
    for (let i = 0; i < numSubWorkers; i++) {
        try {
            const sw = new Worker(new URL('./LogFilterSub.worker.ts', import.meta.url), { type: 'module' });
            subWorkers.push(sw);
        } catch (e) {
            console.error('[Worker] Failed to spawn sub-worker', i, e);
        }
    }
};

// File Mode
let currentFile: File | null = null;
let lineOffsets: BigInt64Array | null = null; // Map LineNum -> ByteOffset

// Stream Mode
let isStreamMode = false;
let isLiveStream = false; // Separate flag for "Shell Log Logic" (Live Tizen Stream) vs "Stream Delivery" (Large File Read)
let streamLines: string[] = [];

// Common
let filteredIndices: Int32Array | null = null; // Line numbers (0-based) that match
let filteredIndicesBuffer: Int32Array | null = null; // Backing buffer for dynamic growth
let currentRule: LogRule | null = null;
let currentQuickFilter: 'none' | 'error' | 'exception' = 'none'; // ✅ New State

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

// --- Helper: Get Visual Bookmarks (with caching) ---
// ✅ Performance: Cache bookmark positions to avoid repeated binary searches
let bookmarkCache: number[] = [];
let bookmarkCacheDirty = true;
let lastFilteredIndicesLength = 0;

const invalidateBookmarkCache = () => {
    bookmarkCacheDirty = true;
};

const getVisualBookmarks = (): number[] => {
    if (!filteredIndices) return [];

    // ✅ Check if cache is still valid
    if (!bookmarkCacheDirty && filteredIndices.length === lastFilteredIndicesLength) {
        return bookmarkCache;
    }

    // Rebuild cache
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

    // ✅ Update cache
    bookmarkCache = visualBookmarks;
    bookmarkCacheDirty = false;
    lastFilteredIndicesLength = filteredIndices.length;

    return visualBookmarks;
};


// --- Helper: Match Logic ---
// NOTE: Extracted to utils/logFiltering.ts for testability and reusability
import { checkIsMatch } from '../utils/logFiltering';


// ... (omitted file indexing / stream handlers)

// --- Handler: File Indexing ---
const buildFileIndex = async (file: File) => {
    isStreamMode = false;
    isLiveStream = false;
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
const initStream = (payload?: { isLive?: boolean }) => {
    isStreamMode = true;
    isLiveStream = payload?.isLive !== false; // Default to true (legacy behavior) unless explicitly false
    currentFile = null;
    lineOffsets = null;
    streamLines = [];
    originalBookmarks.clear();
    streamBuffer = '';
    filteredIndices = new Int32Array(0);
    filteredIndicesBuffer = new Int32Array(1024 * 1024); // Start with 1M capacity
    lastFilterNotifyTime = 0; // ✅ Reset throttle timer
    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready', mode: 'stream' } });
};

// --- Handler: Process Chunk (Stream) ---
let streamBuffer = '';
// ✅ Performance: Throttle FILTER_COMPLETE messages
let lastFilterNotifyTime = 0;
const MIN_NOTIFY_INTERVAL_MS = 500; // 500ms throttle

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
        if (checkIsMatch(line, currentRule, isLiveStream, currentQuickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) { // ✅ Pass Zero-copy params
            newMatches.push(startIdx + i);
        }
    });

    // Append to filteredIndices using Buffer Strategy
    const currentLen = filteredIndices ? filteredIndices.length : 0;
    const requiredLen = currentLen + newMatches.length;

    // Ensure buffer exists and has capacity
    if (!filteredIndicesBuffer || filteredIndicesBuffer.length < requiredLen) {
        let newCap = filteredIndicesBuffer ? filteredIndicesBuffer.length * 2 : 1024 * 1024;
        if (newCap < requiredLen) newCap = requiredLen;

        const newBuffer = new Int32Array(newCap);
        if (filteredIndices) {
            newBuffer.set(filteredIndices);
        }
        filteredIndicesBuffer = newBuffer;
    }

    // Append new matches
    filteredIndicesBuffer.set(newMatches, currentLen);

    // Update active view
    filteredIndices = filteredIndicesBuffer.subarray(0, requiredLen);

    // ✅ Performance: Invalidate bookmark cache when filtered indices change
    invalidateBookmarkCache();

    // ✅ Performance: Only send update if enough time has passed (throttle)
    const now = Date.now();
    if (now - lastFilterNotifyTime >= MIN_NOTIFY_INTERVAL_MS) {
        respond({
            type: 'FILTER_COMPLETE',
            payload: {
                matchCount: filteredIndices.length,
                totalLines: streamLines.length,
                visualBookmarks: getVisualBookmarks()
            }
        });
        lastFilterNotifyTime = now;
    }
};


// --- Handler: Apply Filter ---
const applyFilter = async (payload: LogRule & { quickFilter?: 'none' | 'error' | 'exception' }) => {
    currentRule = payload;
    currentQuickFilter = payload.quickFilter || 'none'; // ✅ Update state

    respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0 } });

    if (isStreamMode) {
        // ✅ Sync WASM Engine keywords if available
        if (wasmEngine) {
            const allKeywords = payload.includeGroups.flat().map(t => t.trim()).filter(t => t !== '');
            wasmEngine.update_keywords(allKeywords);
        }

        // Re-filter all stream lines
        const matches: number[] = [];
        streamLines.forEach((line, i) => {
            if (checkIsMatch(line, currentRule, isLiveStream, currentQuickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) matches.push(i); // ✅ Pass Zero-copy params
        });

        // Re-init buffer with results
        const requiredLen = matches.length;
        const initialCap = Math.max(requiredLen, 1024 * 1024);
        filteredIndicesBuffer = new Int32Array(initialCap);
        filteredIndicesBuffer.set(matches);
        filteredIndices = filteredIndicesBuffer.subarray(0, requiredLen);

        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: matches.length, totalLines: streamLines.length, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    // File Mode
    if (!currentFile || !lineOffsets) return;

    // ✅ Sync WASM Engine keywords for the main worker (for getLines etc)
    if (wasmEngine) {
        const allKeywords = payload.includeGroups.flat().map(t => t.trim()).filter(t => t !== '');
        wasmEngine.update_keywords(allKeywords);
    }

    // Optimization for empty rule
    const excludes = currentRule.excludes.filter(e => e.trim());
    const includes = currentRule.includeGroups.flat().filter(t => t.trim());
    if (excludes.length === 0 && includes.length === 0 && currentQuickFilter === 'none') {
        const all = new Int32Array(lineOffsets.length);
        for (let i = 0; i < lineOffsets.length; i++) all[i] = i;
        filteredIndices = all;
        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length, totalLines: lineOffsets.length, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    // --- High Performance Parallel Filtering ---
    initSubWorkers(); // Lazy initialization specifically for heavy filtering
    const totalLines = lineOffsets.length;
    const numChunks = Math.min(numSubWorkers, Math.ceil(totalLines / 10000)); // 최소 10,000줄당 1개 청크
    const linesPerChunk = Math.ceil(totalLines / numChunks);

    const chunkResults: any[] = new Array(numChunks);
    let completedChunks = 0;

    const onChunkDone = (chunkId: number, matches: number[], lineCount: number) => {
        chunkResults[chunkId] = { matches, lineCount };
        completedChunks++;

        respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (completedChunks / numChunks) * 100 } });

        if (completedChunks === numChunks) {
            // Final assembly
            const finalMatches: number[] = [];
            for (let i = 0; i < numChunks; i++) {
                const res = chunkResults[i];
                const startLineOfChunk = i * linesPerChunk;
                for (const relIdx of res.matches) {
                    finalMatches.push(startLineOfChunk + relIdx);
                }
            }

            filteredIndices = new Int32Array(finalMatches);
            respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
            respond({ type: 'FILTER_COMPLETE', payload: { matchCount: finalMatches.length, totalLines: lineOffsets!.length, visualBookmarks: getVisualBookmarks() } });

            // ✅ Start idle timer after finishing work
            resetSubWorkerIdleTimer();
        }
    };

    for (let i = 0; i < numChunks; i++) {
        const startLine = i * linesPerChunk;
        const endLine = Math.min(startLine + linesPerChunk, totalLines);

        const startByte = Number(lineOffsets[startLine]);
        const endByte = endLine < totalLines ? Number(lineOffsets[endLine]) : currentFile.size;

        const blob = currentFile.slice(startByte, endByte);
        const sw = subWorkers[i % subWorkers.length];

        const handler = (e: MessageEvent) => {
            if (e.data.type === 'CHUNK_COMPLETE' && e.data.payload.chunkId === i) {
                sw.removeEventListener('message', handler);
                onChunkDone(i, e.data.payload.matches, e.data.payload.lineCount);
            }
        };
        sw.addEventListener('message', handler);

        sw.postMessage({
            type: 'FILTER_CHUNK',
            payload: {
                chunkId: i,
                blob,
                rule: currentRule,
                quickFilter: currentQuickFilter
            }
        });
    }
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

    // Invalidate cache so getVisualBookmarks rebuilds with updated originalBookmarks
    invalidateBookmarkCache();

    // Return updated visual bookmarks list so frontend can sync
    const vBookmarks = getVisualBookmarks();
    console.log(`[Worker] Sending Updated Visual Bookmarks: count=${vBookmarks.length}`);
    respond({ type: 'BOOKMARKS_UPDATED', payload: { visualBookmarks: vBookmarks }, requestId: '' });
};

// --- Handler: Clear Bookmarks ---
const clearBookmarks = () => {
    originalBookmarks.clear();
    invalidateBookmarkCache();
    respond({ type: 'BOOKMARKS_UPDATED', payload: { visualBookmarks: [] }, requestId: '' });
};

// --- Message Listener ---
ctx.onmessage = (evt: MessageEvent<LogWorkerMessage>) => {
    const { type, payload, requestId } = evt.data;
    switch (type) {
        case 'INIT_FILE':
            buildFileIndex(payload);
            break;
        case 'INIT_STREAM':
            initStream(payload);
            break;
        case 'PROCESS_CHUNK':
            processChunk(payload);
            break;
        case 'FILTER_LOGS':
        case 'FILTER_LOGS':
            applyFilter(payload); // Payload now entails LogRule + quickFilter
            break;
        case 'TOGGLE_BOOKMARK':
            toggleBookmark(payload.visualIndex);
            break;
        case 'CLEAR_BOOKMARKS':
            clearBookmarks();
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
