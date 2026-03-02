/* eslint-disable no-restricted-globals */
import { LogRule, LogWorkerMessage, LogWorkerResponse } from '../types';
import { BookmarkManager } from './workerBookmarkHandlers';
import * as DataReader from './workerDataReader';
import { checkIsMatch } from '../utils/logFiltering';
import { extractTimestamp } from '../utils/logTime';
import { analyzePerfSegments, extractSourceMetadata } from '../utils/perfAnalysis';
import * as AnalysisHandlers from './workerAnalysisHandlers';

const ctx: Worker = self as any;

// --- State ---
// WASM Filter Engine & Memory
let wasmEngine: any = null;
let wasmMemory: WebAssembly.Memory | null = null;
const textEncoder = new TextEncoder();

// Initialize WASM Engine (Vite handles the loading)
// Initialize WASM Engine (Vite handles the loading)
let wasmModule: any = null;
const initWasm = async () => {
    try {
        // Use location.origin to ensure we are loading from the public directory at runtime
        // and to bypass Vite's static analysis which might fail if it tries to resolve /wasm/...
        const wasmPath = `${self.location.origin}/wasm/happy_filter.js`;

        // Use @vite-ignore to prevent Vite from trying to bundle this file.
        // The file is served as a static asset from the public folder.
        // @ts-ignore
        const wasm = await import(/* @vite-ignore */ wasmPath);
        wasmModule = wasm;

        // Initialize the WASM module. 
        // Note: happy_filter.js expects happy_filter_bg.wasm to be in the same directory.
        const instance = await wasm.default();

        wasmMemory = (instance as any).memory;
        wasmEngine = new wasm.FilterEngine(false);
        console.log('WASM Filter Engine initialized from public/wasm');
    } catch (e) {
        console.warn('WASM initialization failed. Falling back to JS-based filtering.', e);
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

// Bookmarks managed by BookmarkManager

// Concurrency Control for filtering
let currentFilterRequestId = 0;

// Performance Heatmap State
let isCalculatingHeatmap = false;

// --- Constants ---
const CHUNK_SIZE = 10 * 1024 * 1024;

// --- Helper: Response ---
const respond = (response: LogWorkerResponse) => {
    ctx.postMessage(response);
};

// --- Helper: Get Visual Bookmarks ---
const invalidateBookmarkCache = () => BookmarkManager.invalidateCache();
const getVisualBookmarks = (): number[] => BookmarkManager.getVisualBookmarks(filteredIndices);

// --- Helper: Match Logic ---
// NOTE: Extracted to utils/logFiltering.ts for testability and reusability
// (imports moved to top)


// ... (omitted file indexing / stream handlers)

// --- Handler: File Indexing ---
const buildFileIndex = async (file: File) => {
    isStreamMode = false;
    isLiveStream = false;
    currentFile = file;
    streamLines = []; // Clear stream data
    BookmarkManager.clearAll(); // Clear bookmarks for new file
    isCalculatingHeatmap = false; // Reset heatmap state for new file
    currentFilterRequestId++; // ✅ Cancel any pending filters from previous file

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

            // ✅ Optimization: Native indexOf is significantly faster than JS loop
            let pos = -1;
            while ((pos = chunk.indexOf(10, pos + 1)) !== -1) {
                if (lineCount >= capacity) {
                    const newCapacity = capacity * 2;
                    const newArr = new BigInt64Array(newCapacity);
                    newArr.set(tempOffsets);
                    tempOffsets = newArr;
                    capacity = newCapacity;
                }
                tempOffsets[lineCount++] = offset + BigInt(pos) + 1n;
            }

            offset += BigInt(chunkLen);
            processedBytes += chunkLen;

            // Throttle progress updates to avoid message spam
            const progress = fileSize === 0 ? 100 : (processedBytes / fileSize) * 100;
            if (processedBytes % (100 * 1024 * 1024) === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress } });
            }
        }
        // Ensure a final 100% progress update is sent after the loop finishes
        respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 100 } });
    } catch (e) {
        console.error('Indexing failed', e);
        respond({ type: 'ERROR', payload: 'Failed to index file' });
        return;
    }

    // ✅ Optimization: Use subarray to avoid memory copy
    lineOffsets = tempOffsets.subarray(0, lineCount);

    // ✅ Order Fix: Initialize filteredIndices BEFORE notifying the UI
    const all = new Int32Array(lineCount);
    for (let i = 0; i < lineCount; i++) all[i] = i;
    filteredIndices = all;

    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 100 } });
    respond({ type: 'INDEX_COMPLETE', payload: { totalLines: lineCount } });
    // ⚠️ FILTER_COMPLETE를 여기서 보내지 않음!
    // INDEX_COMPLETE를 받은 프론트에서 즉시 FILTER_LOGS를 보내고,
    // applyFilter() 완료 시 단 한번만 FILTER_COMPLETE가 전송됨.
};

// --- Handler: Stream Init ---
const initStream = (payload?: { isLive?: boolean }) => {
    isStreamMode = true;
    isLiveStream = payload?.isLive !== false; // Default to true (legacy behavior) unless explicitly false
    currentFile = null;
    lineOffsets = null;
    streamLines = [];
    BookmarkManager.clearAll();
    streamBuffer = '';
    filteredIndices = new Int32Array(0);
    filteredIndicesBuffer = new Int32Array(1024 * 1024); // Start with 1M capacity
    lastFilterNotifyTime = 0; // ✅ Reset throttle timer
    currentFilterRequestId++; // ✅ Cancel any pending filters
    respond({ type: 'STATUS_UPDATE', payload: { status: 'ready', mode: 'stream' } });
};

// --- Handler: Process Chunk (Stream) ---
let streamBuffer = '';
// ✅ Performance: Throttle FILTER_COMPLETE messages to ensure smooth 30+ FPS rendering
let lastFilterNotifyTime = 0;
const MIN_NOTIFY_INTERVAL_MS = 32; // Reduced from 500ms for buttery smooth live streaming

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

    // Clean ANSI codes from lines and remove trailing carriage returns
    // eslint-disable-next-line no-control-regex
    const cleanLines = lines.map(line => line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r$/, ''));

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

    // ✅ isLiveStream이 true인 경우(Tizen 실시간 스트림)에만 중간 FILTER_COMPLETE 전송
    // isLive: false인 파일 읽기 스트림은 STREAM_DONE에서 단 한번만 보냄 → 깜박임 방지
    if (isLiveStream) {
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
    }
};


// --- Handler: Apply Filter ---
const applyFilter = async (payload: LogRule & { quickFilter?: 'none' | 'error' | 'exception' }) => {
    // 💡 Unified Happy Combos: If happyGroups exist (even if empty), prioritize them over legacy includeGroups
    const rawIncludeGroups = (payload.happyGroups !== undefined)
        ? payload.happyGroups.filter(g => g.enabled).map(g => g.tags.map(t => t.trim()).filter(t => t !== ''))
        : payload.includeGroups;

    const currentQuickFilterVal = payload.quickFilter || 'none';
    currentQuickFilter = currentQuickFilterVal;

    respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: 0 } });

    // --- Optimization: Pre-normalize Rule Keywords ---
    const isHappyCase = !!payload.happyCombosCaseSensitive;
    const isBlockCase = !!payload.blockListCaseSensitive;

    const normalizedRule: LogRule = {
        ...payload,
        excludes: payload.excludes.map(e => e.trim()).filter(e => e !== '').map(e => isBlockCase ? e : e.toLowerCase()),
        includeGroups: rawIncludeGroups.map(group =>
            group.map(t => isHappyCase ? t : t.toLowerCase())
        ).filter(g => g.length > 0)
    };

    currentRule = normalizedRule;
    const filterRequestId = ++currentFilterRequestId; // ✅ Request ID for this specific filter call
    console.log(`[Worker] Starting applyFilter (RequestID: ${filterRequestId})`);

    // ✅ Sync WASM Engine keywords for the main worker (for getLines etc)
    if (wasmEngine && wasmModule) {
        wasmEngine = new wasmModule.FilterEngine(isHappyCase);
        const allKeywords = normalizedRule.includeGroups.flat();
        wasmEngine.update_keywords(allKeywords);
    }

    // Optimization for empty rule (only in File mode, stream might still need re-refilter status)
    if (!isStreamMode && normalizedRule.excludes.length === 0 && normalizedRule.includeGroups.length === 0 && currentQuickFilter === 'none') {
        const all = new Int32Array(lineOffsets!.length);
        for (let i = 0; i < lineOffsets!.length; i++) all[i] = i;
        filteredIndices = all;
        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length, totalLines: lineOffsets!.length, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    // --- High Performance Parallel Filtering (Common for File and Stream) ---
    initSubWorkers();
    const totalLines = isStreamMode ? streamLines.length : lineOffsets.length;

    // 최소 10,000줄당 1개 청크, 최대 서브워커 수만큼 분할
    const numChunks = Math.min(numSubWorkers, Math.max(1, Math.ceil(totalLines / 10000)));
    const linesPerChunk = Math.ceil(totalLines / numChunks);

    const chunkResults: any[] = new Array(numChunks);
    let completedChunks = 0;

    const onChunkDone = (chunkId: number, matches: Int32Array, receivedRequestId: number) => {
        if (receivedRequestId !== filterRequestId) {
            console.warn(`[Worker] Ignoring stale filter chunk (RequestID: ${receivedRequestId}, Current: ${filterRequestId})`);
            return;
        }

        chunkResults[chunkId] = matches;
        completedChunks++;
        console.log(`[Worker] Chunk Done: ${chunkId + 1}/${numChunks} (RequestID: ${filterRequestId}) matches: ${matches.length}`);

        respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (completedChunks / numChunks) * 100 } });

        if (completedChunks === numChunks) {
            // 결과 취합
            const totalMatches = chunkResults.reduce((sum, res) => sum + res.length, 0);
            const finalMatches = new Int32Array(totalMatches);

            let currentIdx = 0;
            for (let i = 0; i < numChunks; i++) {
                finalMatches.set(chunkResults[i], currentIdx);
                currentIdx += chunkResults[i].length;
            }

            filteredIndices = finalMatches;

            // Re-init buffer with results for future dynamic growth in stream mode
            if (isStreamMode) {
                const initialCap = Math.max(finalMatches.length + 100000, 1024 * 1024);
                filteredIndicesBuffer = new Int32Array(initialCap);
                filteredIndicesBuffer.set(finalMatches);
                filteredIndices = filteredIndicesBuffer.subarray(0, finalMatches.length);
            }

            console.log(`[Worker] Filter Complete (RequestID: ${filterRequestId}) totalMatches: ${filteredIndices.length}`);
            respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
            respond({
                type: 'FILTER_COMPLETE', payload: {
                    matchCount: filteredIndices.length,
                    totalLines: totalLines,
                    visualBookmarks: getVisualBookmarks()
                }
            });

            resetSubWorkerIdleTimer();
        }
    };

    for (let i = 0; i < numChunks; i++) {
        const startLine = i * linesPerChunk;
        const endLine = Math.min(startLine + linesPerChunk, totalLines);
        const sw = subWorkers[i % subWorkers.length];

        if (isStreamMode) {
            const chunkLines = streamLines.slice(startLine, endLine);
            const handler = (e: MessageEvent) => {
                if (e.data.type === 'FILTER_LINES_COMPLETE' && e.data.payload.chunkId === i) {
                    if (e.data.payload.requestId === filterRequestId) {
                        sw.removeEventListener('message', handler);
                        onChunkDone(i, e.data.payload.matches, e.data.payload.requestId);
                    }
                }
            };
            sw.addEventListener('message', handler);
            sw.postMessage({
                type: 'FILTER_LINES',
                payload: {
                    chunkId: i,
                    lines: chunkLines,
                    offset: startLine,
                    rule: currentRule,
                    quickFilter: currentQuickFilter,
                    requestId: filterRequestId
                }
            });
        } else {
            // File Mode
            const startByte = Number(lineOffsets![startLine]);
            const endByte = endLine < totalLines ? Number(lineOffsets![endLine]) : currentFile!.size;
            const blob = currentFile!.slice(startByte, endByte);

            const handler = (e: MessageEvent) => {
                if (e.data.type === 'CHUNK_COMPLETE' && e.data.payload.chunkId === i) {
                    if (e.data.payload.requestId === filterRequestId) {
                        sw.removeEventListener('message', handler);
                        // File mode results now come with absolute offsets from sub-worker
                        onChunkDone(i, e.data.payload.matches as Int32Array, e.data.payload.requestId);
                    }
                }
            };
            sw.addEventListener('message', handler);
            sw.postMessage({
                type: 'FILTER_CHUNK',
                payload: {
                    chunkId: i,
                    blob,
                    offset: startLine, // Pass absolute start line to sub-worker
                    rule: currentRule,
                    quickFilter: currentQuickFilter,
                    requestId: filterRequestId
                }
            });
        }
    }
};

// --- Helper: Get DataReader Context ---
const getDataReaderContext = (): DataReader.DataReaderContext => ({
    filteredIndices,
    isStreamMode,
    streamLines,
    currentFile,
    lineOffsets,
    currentRule,
    respond,
    postMessage: ctx.postMessage.bind(ctx)
});

// --- Handler: Analyze Performance (New) ---
// MOVED TO workerAnalysisHandlers.ts

// --- Helper: Get Performance Heatmap ---
// MOVED TO workerAnalysisHandlers.ts

// --- Helper: Spam Log Analysis ---
// MOVED TO workerAnalysisHandlers.ts

// --- Message Listener ---
ctx.onmessage = (evt: MessageEvent<LogWorkerMessage>) => {
    const { type, payload, requestId } = evt.data;
    if (type !== 'PROCESS_CHUNK') console.log(`[Worker] Received message: ${type}`);
    // Helper to get collective context for handlers
    const getAnalysisContext = (): AnalysisHandlers.WorkerContext => ({
        currentFile,
        lineOffsets,
        filteredIndices,
        isStreamMode,
        streamLines,
        respond,
        currentRule
    });

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
        case 'STREAM_DONE':
            // 파일 읽기 스트림 완료: 마지막 버퍼 처리 후 최종 결과 한번만 전송
            if (streamBuffer.length > 0) {
                processChunk(''); // flush remaining buffer
            }
            respond({
                type: 'FILTER_COMPLETE',
                payload: {
                    matchCount: filteredIndices?.length ?? 0,
                    totalLines: streamLines.length,
                    visualBookmarks: getVisualBookmarks()
                }
            });
            respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
            break;
        case 'FILTER_LOGS':
            applyFilter(payload); // Payload now entails LogRule + quickFilter
            break;
        case 'TOGGLE_BOOKMARK':
            BookmarkManager.toggleBookmark(payload.visualIndex, filteredIndices, respond);
            break;
        case 'CLEAR_BOOKMARKS':
            BookmarkManager.clearBookmarks(respond);
            break;
        case 'GET_LINES':
            DataReader.getLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_RAW_LINES':
            DataReader.getRawLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_LINES_BY_INDICES':
            DataReader.getLinesByIndices(getDataReaderContext(), payload.indices, requestId || '');
            break;
        case 'FIND_HIGHLIGHT':
            DataReader.findHighlight(getDataReaderContext(), payload.keyword, payload.startIndex, payload.direction, requestId || '');
            break;
        case 'GET_FULL_TEXT' as any: // Cast for now until types updated
            DataReader.getFullText(getDataReaderContext(), requestId || '');
            break;
        case 'ANALYZE_TRANSACTION':
            AnalysisHandlers.analyzeTransaction(getAnalysisContext(), payload.identity, requestId || '');
            break;
        case 'GET_PERFORMANCE_HEATMAP':
            AnalysisHandlers.getPerformanceHeatmap(getAnalysisContext(), payload.points || 500, requestId || '', {
                get current() { return isCalculatingHeatmap; },
                set current(val) { isCalculatingHeatmap = val; }
            });
            break;
        case 'PERF_ANALYSIS':
            AnalysisHandlers.analyzePerformance(getAnalysisContext(), payload, requestId || '');
            break;
        case 'ANALYZE_SPAM':
            AnalysisHandlers.analyzeSpamLogs(getAnalysisContext(), requestId || '');
            break;
        case 'FIND_VISUAL_INDEX':
            if (filteredIndices) {
                const visualIndex = filteredIndices.indexOf(payload.absoluteIndex);
                respond({ type: 'FIND_RESULT', payload: { foundIndex: visualIndex }, requestId: requestId || '' });
            } else {
                respond({ type: 'FIND_RESULT', payload: { foundIndex: -1 }, requestId: requestId || '' });
            }
            break;
    }
};
