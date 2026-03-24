/* eslint-disable no-restricted-globals */
console.log('[LogProcessorWorker] Script loaded');
import { LogRule, LogWorkerMessage, LogWorkerResponse } from '../types';
import { BookmarkManager } from './workerBookmarkHandlers';
import * as DataReader from './workerDataReader';
import { checkIsMatch } from '../utils/logFiltering';
import { extractTimestamp } from '../utils/logTime';
import { analyzePerfSegments, extractSourceMetadata } from '../utils/perfAnalysis';
import * as AnalysisHandlers from './workerAnalysisHandlers';
import LogFilterSubWorker from './LogFilterSub.worker.ts?worker';
import { mergeSortedUnique } from './workerUtils';

const ctx: Worker = self as any;
ctx.onerror = (e) => {
    console.error('[Worker] Global Error:', e);
};

// --- WASM Filter Engine ---
import initWasmModule, { FilterEngine } from '../public/wasm/happy_filter.js';
// @ts-ignore: Vite public url resolving
import wasmUrl from '/wasm/happy_filter_bg.wasm?url';

let wasmEngine: any = null;
let wasmMemory: WebAssembly.Memory | null = null;
let wasmModule: any = { FilterEngine }; // Store reference for sub-workers

const initWasm = async () => {
    try {
        console.log('[Worker] Initializing WASM Filter Engine (Bundled)...');
        console.log('[Worker] wasmUrl:', wasmUrl);
        // Vite handles the WASM URL resolution via wasmUrl import
        const instance = await initWasmModule(wasmUrl);
        wasmMemory = (instance as any).memory;
        wasmEngine = new FilterEngine(false);
        console.log('[Worker] WASM Filter Engine initialized successfully');
    } catch (e) {
        console.warn('[Worker] WASM initialization failed. Falling back to JS-based filtering.', e);
    }
};

initWasm();

// --- Parallelism: Worker Pool for Heavy Filtering ---
const numSubWorkers = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
const subWorkers: Worker[] = [];
let isTabActive = true; // ✅ 현재 탭 활성화 여부 추적

// 서브워커는 탭이 비활성화(SET_ACTIVE_STATE)될 때만 종료합니다.

const terminateSubWorkers = () => {
    if (subWorkers.length === 0) return;
    console.log('[Worker] Terminating sub-workers (tab inactive).');
    subWorkers.forEach(sw => sw.terminate());
    subWorkers.length = 0;
};

const initSubWorkers = () => {
    if (!isTabActive) {
        console.log('[Worker] Tab is inactive. Skipping sub-worker spawn.');
        return;
    }
    if (subWorkers.length > 0) {
        console.log(`[Worker] Using existing ${subWorkers.length} sub-workers`);
        return;
    }
    console.log(`[Worker] Spawning ${numSubWorkers} sub-workers...`);
    for (let i = 0; i < numSubWorkers; i++) {
        try {
            const sw = new LogFilterSubWorker();
            sw.onerror = (e) => console.error(`[Worker] SubWorker ${i} error:`, e);
            subWorkers.push(sw);
        } catch (e) {
            console.error('[Worker] Failed to spawn sub-worker', i, e);
        }
    }
};

// File Mode
let currentFile: File | null = null;
let lineOffsets: BigInt64Array | null = null; // Map LineNum -> ByteOffset

// Stream Mode (Binary Optimized with SharedArrayBuffer)
let isStreamMode = false;
let isLiveStream = false;
let isLocalFileMode = false;
let localFilePath: string | null = null;
let localFileSize: number = 0;

// --- Shared Buffer Initialization ---
const LOG_SAB_SIZE = 100 * 1024 * 1024; // 100MB Shared Log Store
const MAX_LINES = 20 * 1024 * 1024; // 20M Lines maximum (for 1GB+ very dense files)

let logSharedBuffer: any;
let logBuffer: Uint8Array;
let offsetSharedBuffer: any;
let lineOffsetsStream: Uint32Array;
let lengthSharedBuffer: any;
let lineLengthsStream: Uint32Array;
let indexSharedBuffer: any;
let filteredIndicesBuffer: Int32Array;

try {
    if (typeof SharedArrayBuffer !== 'undefined') {
        indexSharedBuffer = new SharedArrayBuffer(MAX_LINES * 4);
        filteredIndicesBuffer = new Int32Array(indexSharedBuffer);
        console.log('[Worker] indexSharedBuffer initialized successfully');
    } else {
        throw new Error('SharedArrayBuffer is NOT available');
    }
} catch (e) {
    console.warn('[Worker] SharedArrayBuffer not supported.', e);
    indexSharedBuffer = new ArrayBuffer(MAX_LINES * 4);
    filteredIndicesBuffer = new Int32Array(indexSharedBuffer);
}

// ✅ Lazy Allocation for Stream mode (Saves 260MB per background tab in LocalFileMode)
let streamBuffersAllocated = false;
const allocateStreamBuffers = () => {
    if (streamBuffersAllocated) return;
    try {
        if (typeof SharedArrayBuffer !== 'undefined') {
            logSharedBuffer = new SharedArrayBuffer(LOG_SAB_SIZE);
            logBuffer = new Uint8Array(logSharedBuffer);
            offsetSharedBuffer = new SharedArrayBuffer(MAX_LINES * 4);
            lineOffsetsStream = new Uint32Array(offsetSharedBuffer);
            lengthSharedBuffer = new SharedArrayBuffer(MAX_LINES * 4);
            lineLengthsStream = new Uint32Array(lengthSharedBuffer);
            console.log('[Worker] Stream SharedArrayBuffers generated lazily (260MB)');
        } else {
            throw new Error('SAB NA');
        }
    } catch (e) {
        logSharedBuffer = new ArrayBuffer(LOG_SAB_SIZE);
        logBuffer = new Uint8Array(logSharedBuffer);
        offsetSharedBuffer = new ArrayBuffer(MAX_LINES * 4);
        lineOffsetsStream = new Uint32Array(offsetSharedBuffer);
        lengthSharedBuffer = new ArrayBuffer(MAX_LINES * 4);
        lineLengthsStream = new Uint32Array(lengthSharedBuffer);
    }
    streamBuffersAllocated = true;
};

let currentRule: LogRule | null = null;
let currentQuickFilter: 'none' | 'error' | 'exception' = 'none'; // ✅ New State

let logBufferPtr = 0;
let streamLineCount = 0;
let filteredIndices: Int32Array | null = null;
const textEncoder = new TextEncoder();

// Helper: UI에게 공유 버퍼 정보 전송
const sendSharedBuffers = () => {
    respond({
        type: 'BUFFER_SHARED',
        payload: {
            logBuffer: logSharedBuffer,
            lineOffsets: offsetSharedBuffer,
            lineLengths: lengthSharedBuffer,
            filteredIndices: indexSharedBuffer,
            isStreamMode
        }
    });
};

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

// --- Helper: Merge Sorted Arrays (Unique) ---
// Imported from ./workerUtils

const getSingleLineContent = async (originalIdx: number): Promise<string> => {
    const decoder = new TextDecoder();
    try {
        if (isStreamMode) {
            if (!logBuffer || !lineOffsetsStream || !lineLengthsStream) return '';
            const start = lineOffsetsStream[originalIdx];
            const len = lineLengthsStream[originalIdx];
            return decoder.decode(logBuffer.subarray(start, start + len).slice()).replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        } else if (isLocalFileMode && localFilePath) {
            const offset = lineOffsets![originalIdx];
            const nextOffset = originalIdx < lineOffsets!.length - 1 ? lineOffsets![originalIdx + 1] : BigInt(localFileSize);
            const uint8View = await rpcCall('readFileSegment', { path: localFilePath, start: Number(offset), end: Number(nextOffset) });
            return decoder.decode(uint8View).replace(/\r?\n$/, '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        } else if (currentFile && lineOffsets) {
            const offset = lineOffsets[originalIdx];
            const nextOffset = originalIdx < lineOffsets.length - 1 ? lineOffsets[originalIdx + 1] : BigInt(currentFile.size);
            const chunkBlob = currentFile.slice(Number(offset), Number(nextOffset));
            const arrayBuf = await chunkBlob.arrayBuffer();
            const uint8View = new Uint8Array(arrayBuf);
            return decoder.decode(uint8View).replace(/\r?\n$/, '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        }
    } catch (e) {
        console.error('[Worker] getSingleLineContent failed', e);
    }
    return '';
};

const removeFromFilteredIndices = (visualIdx: number) => {
    if (!filteredIndices) return;
    const newLen = filteredIndices.length - 1;
    if (visualIdx < newLen) {
        filteredIndicesBuffer.set(filteredIndicesBuffer.subarray(visualIdx + 1, filteredIndices.length), visualIdx);
    }
    filteredIndices = (filteredIndicesBuffer as any).subarray(0, newLen);
    invalidateBookmarkCache();
};

const insertIntoFilteredIndicesSorted = (originalIdx: number) => {
    if (!filteredIndices) return;
    
    // Find insertion point
    let low = 0;
    let high = filteredIndices.length - 1;
    let insertAt = filteredIndices.length;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        if (filteredIndices[mid] === originalIdx) return; // Already exists
        if (filteredIndices[mid] < originalIdx) {
            low = mid + 1;
            insertAt = low;
        } else {
            high = mid - 1;
            insertAt = mid;
        }
    }

    if (filteredIndices.length >= MAX_LINES) return;

    // Shift right
    filteredIndicesBuffer.set(filteredIndicesBuffer.subarray(insertAt, filteredIndices.length), insertAt + 1);
    filteredIndicesBuffer[insertAt] = originalIdx;
    filteredIndices = (filteredIndicesBuffer as any).subarray(0, filteredIndices.length + 1);
    invalidateBookmarkCache();
};

// --- Helper: Match Logic ---
// NOTE: Extracted to utils/logFiltering.ts for testability and reusability
// (imports moved to top)




// --- RPC Helper ---
let _rpcCallIndex = 0;
const rpcWaiters = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
const rpcCall = (method: string, args: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        const requestId = `rpc-${Date.now()}-${_rpcCallIndex++}`;
        rpcWaiters.set(requestId, { resolve, reject });
        console.log(`[Worker] Initiating RPC_REQUEST: ${method}`, args);
        respond({ type: 'RPC_REQUEST', requestId, payload: { method, args } } as any);
    });
};


// --- Handler: File Indexing ---
const buildFileIndex = async (file: File) => {
    isStreamMode = false;
    isLiveStream = false;
    currentFile = file;
    // streamLines = []; // Clear stream data - REMOVED
    BookmarkManager.clearAll(); // Clear bookmarks for new file
    isCalculatingHeatmap = false; // Reset heatmap state for new file
    currentFilterRequestId++; // ✅ Cancel any pending filters from previous file

    initSubWorkers(); // ✅ 스폰하여 병렬로 WASM 초기화 진행 (WASM Cold Start 최적화)

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
    if (lineCount <= filteredIndicesBuffer.length) {
        for (let i = 0; i < lineCount; i++) filteredIndicesBuffer[i] = i;
        filteredIndices = (filteredIndicesBuffer as any).subarray(0, lineCount);
    } else {
        // Fallback for extremely large files
        const all = new Int32Array(lineCount);
        for (let i = 0; i < lineCount; i++) all[i] = i;
        filteredIndices = all as any;
    }

    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 100 } });
    respond({ type: 'INDEX_COMPLETE', payload: { totalLines: lineCount } });
};

// --- Handler: Local File Indexing (RPC 2GB+ OOM Free) ---
const buildLocalFileIndex = async (path: string, size: number) => {
    isStreamMode = false;
    isLiveStream = false;
    isLocalFileMode = true;
    localFilePath = path;
    localFileSize = size;
    currentFile = null;
    BookmarkManager.clearAll();
    isCalculatingHeatmap = false;
    currentFilterRequestId++;

    initSubWorkers(); // ✅ 스폰하여 병렬로 WASM 초기화 진행 (WASM Cold Start 최적화)

    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 0 } });

    // Memory efficient indexing
    let capacity = 5 * 1024 * 1024; // Start with 5M lines
    let tempOffsets = new BigInt64Array(capacity);
    tempOffsets[0] = 0n;
    let lineCount = 1;

    let offset = 0n;
    let processedBytes = 0;
    // 💡 50MB 청크: IPC 왕복 횟수를 290번 -> 29번으로 줄여 멀티탭 시 경쟁 최소화 🐧🚀
    const chunkSize = 50 * 1024 * 1024;

    try {
        console.log(`[Worker] Starting Local File Indexing: ${path} (${Math.round(size / 1024 / 1024)}MB, chunkSize=50MB)`);
        while (processedBytes < size) {
            const end = Math.min(processedBytes + chunkSize, size);
            const chunk: Uint8Array = await rpcCall('readFileSegment', { path, start: processedBytes, end });

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

            offset += BigInt(chunk.length);
            processedBytes += chunk.length;

            if (processedBytes % (100 * 1024 * 1024) === 0 || processedBytes >= size) {
                const progress = (processedBytes / size) * 100;
                respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress } });
            }
        }
    } catch (e) {
        console.error('Local File Indexing failed', e);
        respond({ type: 'ERROR', payload: 'Failed to index local file via RPC' });
        return;
    }

    lineOffsets = tempOffsets.subarray(0, lineCount);

    if (lineCount <= filteredIndicesBuffer.length) {
        for (let i = 0; i < lineCount; i++) filteredIndicesBuffer[i] = i;
        filteredIndices = (filteredIndicesBuffer as any).subarray(0, lineCount);
    } else {
        const all = new Int32Array(lineCount);
        for (let i = 0; i < lineCount; i++) all[i] = i;
        filteredIndices = all as any;
    }

    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 100 } });
    respond({ type: 'INDEX_COMPLETE', payload: { totalLines: lineCount } });
};

// --- Handler: Stream Init ---
const initStream = (payload?: { isLive?: boolean }) => {
    isStreamMode = true;
    isLiveStream = payload?.isLive !== false;
    currentFile = null;
    lineOffsets = null;

    allocateStreamBuffers(); // ✅ Lazily allocate 260MB buffers ONLY when stream starts

    // Reset Binary Store
    logBufferPtr = 0;
    streamLineCount = 0;

    BookmarkManager.clearAll();
    streamBuffer = '';
    filteredIndices = (filteredIndicesBuffer as any).subarray(0, 0);
    lastFilterNotifyTime = 0;
    currentFilterRequestId++;
    respond({ type: 'STATUS_UPDATE', payload: { status: 'loading', mode: 'stream' } });
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

    // ✅ 바이너리 저장소에 기록 루프
    for (const line of lines) {
        // ANSI 제거 및 CR 제거 (기존 로직 유지)
        // eslint-disable-next-line no-control-regex
        const cleanLine = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r$/, '');
        const encoded = textEncoder.encode(cleanLine);
        const len = encoded.length;

        // 버퍼 확장 체크 (SAB인 경우 확장이 불가능하므로 새로운 SAB를 생성하거나 일반 버퍼로 전환해야 함)
        // 여기서는 유연성을 위해 일반 Uint8Array 타입으로 다룹니다.
        if (logBufferPtr + len > logBuffer.length) {
            const newSize = logBuffer.length * 2 + len;
            console.log(`[Worker] Growing logBuffer to ${newSize / (1024 * 1024)} MB`);
            const newBuffer = new Uint8Array(newSize);
            newBuffer.set(logBuffer.subarray(0, logBufferPtr));
            logBuffer = newBuffer as any;
        }
        // 오프셋 배열 확장 체크
        if (streamLineCount >= lineOffsetsStream.length) {
            const newSize = lineOffsetsStream.length * 2;
            const newOffsets = new Uint32Array(newSize);
            newOffsets.set(lineOffsetsStream.subarray(0, streamLineCount));
            lineOffsetsStream = newOffsets as any;
            const newLengths = new Uint32Array(newSize);
            newLengths.set(lineLengthsStream.subarray(0, streamLineCount));
            lineLengthsStream = newLengths as any;
        }

        // 저장
        logBuffer.set(encoded, logBufferPtr);
        lineOffsetsStream[streamLineCount] = logBufferPtr;
        lineLengthsStream[streamLineCount] = len;

        // 필터링 체크 (실시간 매칭을 위해 바이너리 상태에서 바로 체크)
        if (checkIsMatch(cleanLine, currentRule, isLiveStream, currentQuickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
            // Append to filteredIndices (Shared Buffer Strategy)
            const currentLen = filteredIndices ? filteredIndices.length : 0;
            const requiredLen = currentLen + 1;

            if (requiredLen <= filteredIndicesBuffer.length) {
                filteredIndicesBuffer[currentLen] = streamLineCount;
                filteredIndices = (filteredIndicesBuffer as any).subarray(0, requiredLen);
            } else {
                console.warn('[Worker] Filtered indices buffer overflow (MAX_LINES reached)');
            }
        }

        logBufferPtr += len;
        streamLineCount++;
    }

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
                    matchCount: filteredIndices ? filteredIndices.length : 0,
                    totalLines: streamLineCount, // Changed from streamLines.length
                    visualBookmarks: getVisualBookmarks()
                }
            });
            lastFilterNotifyTime = now;
        }
    }
};


// --- Handler: Apply Filter ---
const applyFilter = async (payload: LogRule & { quickFilter?: 'none' | 'error' | 'exception' }) => {
    // 💡 Unified Happy Combos: includeGroups in payload has already been refined by assembleIncludeGroups in the main thread.
    const rawIncludeGroups = payload.includeGroups;

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
            group.map(t => isHappyCase ? t.trim() : t.trim().toLowerCase()).filter(t => t !== '')
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
    const totalLines = isStreamMode ? streamLineCount : (lineOffsets ? lineOffsets.length : 0);
    console.log(`[Worker] Preparing filter for ${totalLines} lines (isStream: ${isStreamMode})`);

    // ✅ 동적 스케일링 (파일 크기 비례): 라인 수에 따라 청크 크기 및 동시성을 가변적으로 적용하여 처리 속도 극대화.
    let MAX_LINES_PER_CHUNK = 20000;
    let dynamicConcurrency = Math.max(2, numSubWorkers);

    if (totalLines > 5000000) {
        // 초거대 용량 (5M 라인 이상) -> 청크 크기 극대화로 IPC/스트림 오버헤드 최소화 (최대 250k)
        MAX_LINES_PER_CHUNK = 250000;
        dynamicConcurrency = Math.max(6, numSubWorkers + 2); // 가용 코어 초과 허용 (강력한 멀티태스킹 유도)
    } else if (totalLines > 1000000) {
        // 대용량 (1M ~ 5M 라인) -> 100k 청크
        MAX_LINES_PER_CHUNK = 100000;
        dynamicConcurrency = Math.max(4, numSubWorkers);
    } else {
        // 일반 용량 (1M 미만) -> UI 반응성에 유리하게 잘게 쪼갬
        MAX_LINES_PER_CHUNK = 20000;
        dynamicConcurrency = numSubWorkers;
    }

    const numChunks = Math.ceil(totalLines / MAX_LINES_PER_CHUNK);
    const linesPerChunk = MAX_LINES_PER_CHUNK;
    console.log(`[Worker] Dynamic Strategy: ${numChunks} chunks (${linesPerChunk} lines each), Concurrency: ${dynamicConcurrency}`);

    const chunkResults: (Int32Array | null)[] = new Array(numChunks).fill(null);
    let completedChunks = 0;

    const onChunkDone = (chunkId: number, matches: Int32Array | null, receivedRequestId: number) => {
        if (receivedRequestId !== filterRequestId || filterRequestId !== currentFilterRequestId) return;

        chunkResults[chunkId] = matches;
        completedChunks++;

        if (numChunks > 10 && completedChunks % Math.ceil(numChunks / 10) === 0) {
            console.log(`[Worker] Filtering Progress: ${((completedChunks / numChunks) * 100).toFixed(1)}%`);
        }

        respond({ type: 'STATUS_UPDATE', payload: { status: 'filtering', progress: (completedChunks / numChunks) * 100 } });

        if (completedChunks === numChunks) {
            console.log(`[Worker] Filtering complete. Aggregating results for ${numChunks} chunks...`);

            // ✅ 실패한 청크가 있을 수 있으므로 방어적 취합
            const totalMatches = chunkResults.reduce((sum, res) => sum + (res ? res.length : 0), 0);
            console.log(`[Worker] Total matches found: ${totalMatches}`);

            const finalMatches = new Int32Array(totalMatches);
            let currentIdx = 0;
            for (let i = 0; i < numChunks; i++) {
                const res = chunkResults[i];
                if (res && res.length > 0) {
                    finalMatches.set(res, currentIdx);
                    currentIdx += res.length;
                }
            }

            // --- Merge Bookmarks (Persistent Visualization) ---
            const bookmarks = BookmarkManager.getOriginalBookmarksSorted();
            const mergedMatches = mergeSortedUnique(finalMatches, bookmarks);

            // ✅ Shared Buffer 크기 초과 방지
            const safeMatchCount = Math.min(mergedMatches.length, MAX_LINES);
            filteredIndicesBuffer.set(mergedMatches.subarray(0, safeMatchCount));
            filteredIndices = (filteredIndicesBuffer as any).subarray(0, safeMatchCount);

            if (finalMatches.length > MAX_LINES) {
                console.warn(`[Worker] Match count (${finalMatches.length}) exceeds SharedBuffer capacity (${MAX_LINES}). Truncating results.`);
            }

            // ✅ Order Fix: Send shared buffers BEFORE completing filtering notification
            sendSharedBuffers();

            respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
            respond({
                type: 'FILTER_COMPLETE', payload: {
                    matchCount: filteredIndices!.length,
                    totalLines: totalLines,
                    visualBookmarks: getVisualBookmarks()
                }
            });

        }
    };


    const decoder = new TextDecoder();
    let nextChunkIdx = 0;
    const MAX_CONCURRENT_CHUNKS = dynamicConcurrency; // ✅ 계산된 동적 동시성 적용

    const processNextChunk = async () => {
        if (nextChunkIdx >= numChunks || filterRequestId !== currentFilterRequestId) return;

        const i = nextChunkIdx++;
        const startLine = i * linesPerChunk;
        const endLine = Math.min(startLine + linesPerChunk, totalLines);
        const sw = subWorkers.length > 0 ? subWorkers[i % subWorkers.length] : null;

        if (!sw) {
            // Fallback: Main Worker
            try {
                if (isStreamMode) {
                    const chunkLines: string[] = [];
                    for (let j = startLine; j < endLine; j++) {
                        const s = lineOffsetsStream[j];
                        const l = lineLengthsStream[j];
                        chunkLines.push(decoder.decode(logBuffer.subarray(s, s + l).slice()));
                    }
                    const mList: number[] = [];
                    for (let j = 0; j < chunkLines.length; j++) {
                        if (checkIsMatch(chunkLines[j], normalizedRule, false, currentQuickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                            mList.push(startLine + j);
                        }
                    }
                    onChunkDone(i, new Int32Array(mList), filterRequestId);
                } else if (isLocalFileMode) {
                    const startByte = Number(lineOffsets![startLine]);
                    const endByte = Number(endLine < lineOffsets!.length ? lineOffsets![endLine] : localFileSize);
                    const chunkBuffer = await rpcCall('readFileSegment', { path: localFilePath, start: startByte, end: endByte });
                    const text = decoder.decode(chunkBuffer);
                    const lines = text.split('\n');
                    if (text.endsWith('\n')) lines.pop();
                    const mList: number[] = [];
                    for (let j = 0; j < lines.length; j++) {
                        const line = lines[j];
                        const cleanLine = line.endsWith('\r') ? line.slice(0, -1) : line;
                        if (checkIsMatch(cleanLine, normalizedRule, false, currentQuickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                            mList.push(startLine + j);
                        }
                    }
                    onChunkDone(i, new Int32Array(mList), filterRequestId);
                }
            } catch (err) {
                console.error(`[Worker] Main worker chunk processing failed: ${i}`, err);
                onChunkDone(i, null, filterRequestId);
            }
            processNextChunk();
            return;
        }

        // Parallel: SubWorker
        if (isStreamMode) {
            const chunkLines: string[] = [];
            for (let j = startLine; j < endLine; j++) {
                const s = lineOffsetsStream[j];
                const l = lineLengthsStream[j];
                chunkLines.push(decoder.decode(logBuffer.subarray(s, s + l).slice()));
            }

            const messageHandler = (e: MessageEvent) => {
                if (e.data.type === 'FILTER_LINES_COMPLETE' && e.data.payload.chunkId === i) {
                    if (e.data.payload.requestId === filterRequestId) {
                        sw.removeEventListener('message', messageHandler);
                        onChunkDone(i, e.data.payload.matches, e.data.payload.requestId);
                        processNextChunk();
                    }
                }
            };
            sw.addEventListener('message', messageHandler);
            sw.postMessage({
                type: 'FILTER_LINES',
                payload: { chunkId: i, lines: chunkLines, offset: startLine, rule: currentRule, quickFilter: currentQuickFilter, requestId: filterRequestId }
            });
        } else if (isLocalFileMode) {
            const startByte = Number(lineOffsets![startLine]);
            const endByte = Number(endLine < lineOffsets!.length ? lineOffsets![endLine] : localFileSize);

            rpcCall('readFileSegment', { path: localFilePath, start: startByte, end: endByte }).then((chunkBuffer: Uint8Array) => {
                const messageHandler = (e: MessageEvent) => {
                    if (e.data.type === 'CHUNK_COMPLETE' && e.data.payload.chunkId === i) {
                        if (e.data.payload.requestId === filterRequestId) {
                            sw.removeEventListener('message', messageHandler);
                            onChunkDone(i, e.data.payload.matches, e.data.payload.requestId);
                            processNextChunk();
                        }
                    }
                };
                sw.addEventListener('message', messageHandler);
                sw.postMessage({
                    type: 'FILTER_CHUNK',
                    payload: { chunkId: i, buffer: chunkBuffer, offset: startLine, rule: currentRule, quickFilter: currentQuickFilter, requestId: filterRequestId }
                }, [chunkBuffer.buffer]);
            }).catch(err => {
                console.error(`[Worker] RPC failed for chunk ${i}`, err);
                onChunkDone(i, null, filterRequestId);
                processNextChunk();
            });
        } else if (currentFile) {
            const chunkBlob = currentFile.slice(Number(lineOffsets![startLine]), Number(endLine < lineOffsets!.length ? lineOffsets![endLine] : currentFile.size));
            const messageHandler = (e: MessageEvent) => {
                if (e.data.type === 'CHUNK_COMPLETE' && e.data.payload.chunkId === i) {
                    if (e.data.payload.requestId === filterRequestId) {
                        sw.removeEventListener('message', messageHandler);
                        onChunkDone(i, e.data.payload.matches, e.data.payload.requestId);
                        processNextChunk();
                    }
                }
            };
            sw.addEventListener('message', messageHandler);
            sw.postMessage({
                type: 'FILTER_CHUNK',
                payload: { chunkId: i, blob: chunkBlob, offset: startLine, rule: currentRule, quickFilter: currentQuickFilter, requestId: filterRequestId }
            });
        }
    };

    // 초기 실행
    for (let k = 0; k < Math.min(MAX_CONCURRENT_CHUNKS, numChunks); k++) {
        processNextChunk();
    }
};


// --- Helper: Get DataReader Context ---
const getDataReaderContext = (): DataReader.DataReaderContext => ({
    filteredIndices,
    isStreamMode,
    isLocalFileMode,
    localFilePath,
    localFileSize,
    rpcCall,
    logBuffer,
    lineOffsetsStream,
    lineLengthsStream,
    currentFile,
    lineOffsets,
    currentRule,
    respond,
    postMessage: ctx.postMessage.bind(ctx)
});

// --- Helper: Get Analysis Context ---
const getAnalysisContext = (): AnalysisHandlers.WorkerContext => ({
    currentFile,
    lineOffsets,
    filteredIndices,
    isStreamMode,
    isLocalFileMode,
    localFilePath,
    localFileSize,
    rpcCall,
    logBuffer,
    lineOffsetsStream,
    lineLengthsStream,
    respond,
    currentRule
});

// --- Message Listener ---
ctx.onmessage = async (evt: MessageEvent<LogWorkerMessage>) => {
    const { type, payload, requestId } = evt.data;
    if (type !== 'PROCESS_CHUNK' && type !== 'SET_ACTIVE_STATE') console.log(`[Worker] Received message: ${type}`);

    switch (type) {
        case 'SET_ACTIVE_STATE':
            isTabActive = payload !== false;
            if (!isTabActive) {
                console.log('[Worker] Tab became inactive, terminating idle sub-workers to save CPU/RAM');
                terminateSubWorkers();
            } else {
                console.log('[Worker] Tab activated → SubWorkers will be respawned on next filter or index');
                if (currentFile || isLocalFileMode || isStreamMode) {
                    initSubWorkers(); // 활성화 시 즉시 스폰하여 예열
                }
            }
            break;
        case 'RPC_RESPONSE':
            if (requestId && rpcWaiters.has(requestId)) {
                rpcWaiters.get(requestId)!.resolve(payload);
                rpcWaiters.delete(requestId);
            }
            break;
        case 'RPC_ERROR':
            if (requestId && rpcWaiters.has(requestId)) {
                rpcWaiters.get(requestId)!.reject(payload);
                rpcWaiters.delete(requestId);
            }
            break;
        case 'INIT_FILE':
            // 핫픽스: payload 자체가 File 객체이므로 바로 전달합니다.
            await buildFileIndex(payload);
            break;
        case 'INIT_LOCAL_FILE_STREAM':
            await buildLocalFileIndex(payload.path, payload.size);
            break;
        case 'INIT_STREAM':
            initStream(payload);
            break;
        case 'PROCESS_CHUNK':
            processChunk(payload);
            break;
        case 'STREAM_DONE':
            if (streamBuffer.length > 0) {
                processChunk('');
            }
            respond({
                type: 'FILTER_COMPLETE',
                payload: {
                    matchCount: filteredIndices ? filteredIndices.length : 0,
                    totalLines: streamLineCount,
                    visualBookmarks: getVisualBookmarks()
                }
            });
            respond({ type: 'STREAM_DONE' });
            respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
            break;
        case 'FILTER_LOGS':
            await applyFilter(payload);
            break;
        case 'TOGGLE_BOOKMARK':
            const toggleResult = BookmarkManager.toggleBookmark(payload.visualIndex, filteredIndices);
            if (toggleResult) {
                const { originalIndex, isAdded } = toggleResult;
                if (!isAdded) {
                    // Removed: check if it still matches filter
                    const content = await getSingleLineContent(originalIndex);
                    const isMatch = checkIsMatch(content, currentRule, false, currentQuickFilter, wasmEngine, wasmMemory || undefined, textEncoder);
                    if (!isMatch) {
                        // Remove from view as it's no longer bookmarked and doesn't match filter
                        removeFromFilteredIndices(payload.visualIndex);
                    }
                } else {
                    // Added: it's already in view since user clicked it
                }
                
                // Always notify UI of updated bookmarks and match count (in case it changed)
                respond({
                    type: 'FILTER_COMPLETE',
                    payload: {
                        matchCount: filteredIndices ? filteredIndices.length : 0,
                        totalLines: isStreamMode ? streamLineCount : (lineOffsets ? lineOffsets.length : 0),
                        visualBookmarks: getVisualBookmarks()
                    }
                });
            }
            break;
        case 'CLEAR_BOOKMARKS':
            BookmarkManager.clearBookmarks(respond);
            if (currentRule && (currentRule.excludes.length > 0 || currentRule.includeGroups.length > 0 || currentQuickFilter !== 'none')) {
                // Re-apply filter to remove lines that were only visible because of bookmarks
                await applyFilter(currentRule as any);
            }
            break;
        case 'GET_LINES':
            if (payload.startLine === undefined && payload.startFilterIndex !== undefined) {
                payload.startLine = payload.startFilterIndex; // Fallback for transition
            }
            console.log(`[Worker] GET_LINES: start=${payload.startLine}, count=${payload.count}, filteredLen=${filteredIndices?.length}`);
            await DataReader.getLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_SURROUNDING_LINES':
            await DataReader.getSurroundingLines(getDataReaderContext(), payload.absoluteIndex, payload.count, requestId || '');
            break;
        case 'GET_RAW_LINES':
            if (payload.startLine === undefined && payload.startLineNum !== undefined) {
                payload.startLine = payload.startLineNum;
            }
            await DataReader.getRawLines(getDataReaderContext(), payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_LINES_BY_INDICES':
            await DataReader.getLinesByIndices(getDataReaderContext(), payload.indices, requestId || '', !!payload.isAbsolute);
            break;
        case 'FIND_HIGHLIGHT':
            if (payload.startIndex === undefined && payload.startFilterIndex !== undefined) {
                payload.startIndex = payload.startFilterIndex;
            }
            await DataReader.findHighlight(getDataReaderContext(), payload.keyword, payload.startIndex, payload.direction, requestId || '');
            break;
        case 'GET_FULL_TEXT':
            await DataReader.getFullText(getDataReaderContext(), requestId || '');
            break;
        case 'ANALYZE_TRANSACTION':
            try {
                await AnalysisHandlers.analyzeTransaction(getAnalysisContext(), payload.identity, requestId || '');
            } catch (e) {
                console.error('[Worker] ANALYZE_TRANSACTION failed', e);
                respond({ type: 'ERROR', payload: { error: 'Transaction analysis failed' }, requestId });
            }
            break;
        case 'GET_PERFORMANCE_HEATMAP':
            AnalysisHandlers.getPerformanceHeatmap(getAnalysisContext(), payload.points || 500, requestId || '', {
                get current() { return isCalculatingHeatmap; },
                set current(val) { isCalculatingHeatmap = val; }
            });
            break;
        case 'PERF_ANALYSIS':
            try {
                await AnalysisHandlers.analyzePerformance(getAnalysisContext(), payload, requestId || '');
            } catch (e) {
                console.error('[Worker] PERF_ANALYSIS failed', e);
                respond({ type: 'PERF_ANALYSIS_RESULT', payload: null, requestId });
            }
            break;
        case 'ANALYZE_SPAM':
            try {
                await AnalysisHandlers.analyzeSpamLogs(getAnalysisContext(), requestId || '');
            } catch (e) {
                console.error('[Worker] ANALYZE_SPAM failed', e);
                respond({ type: 'SPAM_ANALYSIS_RESULT', payload: { results: [] }, requestId } as any);
            }
            break;
        case 'GET_ALL_METADATA':
            try {
                await AnalysisHandlers.extractAllMetadata(getAnalysisContext(), requestId || '');
            } catch (e) {
                console.error('[Worker] GET_ALL_METADATA failed', e);
                respond({ type: 'ALL_METADATA_RESULT', payload: { metadata: [] }, requestId } as any);
            }
            break;
        case 'GET_ANALYSIS_METRICS':
            try {
                console.log(`[LogProcessorWorker] GET_ANALYSIS_METRICS message caught in switch.`);
                await AnalysisHandlers.extractAnalysisMetrics(getAnalysisContext(), payload, requestId || '', respond);
            } catch (e) {
                console.error('[Worker] GET_ANALYSIS_METRICS failed', e);
                respond({ type: 'ANALYSIS_METRICS_RESULT', payload: { metrics: {} }, requestId } as any);
            }
            break;
        case 'GET_ALIAS_EVENTS':
            try {
                await AnalysisHandlers.extractAliasEvents(getAnalysisContext(), requestId || '');
            } catch (e) {
                console.error('[Worker] GET_ALIAS_EVENTS failed', e);
                respond({ type: 'ALIAS_EVENTS_RESULT', payload: { events: [] }, requestId } as any);
            }
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
