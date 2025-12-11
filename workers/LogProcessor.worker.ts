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

// --- Constants ---
const CHUNK_SIZE = 10 * 1024 * 1024;

// --- Helper: Response ---
const respond = (response: LogWorkerResponse) => {
    ctx.postMessage(response);
};

// --- Helper: Match Logic ---
const checkIsMatch = (line: string, rule: LogRule | null): boolean => {
    if (!rule) return true;

    const lowerLine = line.toLowerCase();

    // 1. Excludes
    const excludes = rule.excludes.map(e => e.trim().toLowerCase()).filter(e => e !== '');
    if (excludes.some(exc => lowerLine.includes(exc))) return false;

    // 2. Includes
    const groups = rule.includeGroups.map(g => g.map(t => t.trim().toLowerCase()).filter(t => t !== ''));
    const meaningfulGroups = groups.filter(g => g.length > 0);

    if (meaningfulGroups.length === 0) return true; // No include filters -> Show all

    return meaningfulGroups.some(group => group.every(term => lowerLine.includes(term)));
};

// --- Handler: File Indexing ---
const buildFileIndex = async (file: File) => {
    isStreamMode = false;
    currentFile = file;
    streamLines = []; // Clear stream data

    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 0 } });

    const fileSize = file.size;
    const offsets: bigint[] = [0n];
    let offset = 0n;
    let processedBytes = 0;

    const stream = file.stream() as any;
    const reader = stream.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk: Uint8Array = value;
            for (let i = 0; i < chunk.length; i++) {
                if (chunk[i] === 10) { // \n
                    offsets.push(offset + BigInt(i) + 1n);
                }
            }
            offset += BigInt(chunk.length);
            processedBytes += chunk.length;

            if (processedBytes % (50 * 1024 * 1024) === 0) {
                respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: (processedBytes / fileSize) * 100 } });
            }
        }
    } catch (e) {
        respond({ type: 'ERROR', payload: 'Failed to index file' });
        return;
    }

    lineOffsets = new BigInt64Array(offsets);
    respond({ type: 'STATUS_UPDATE', payload: { status: 'indexing', progress: 100 } });
    respond({ type: 'INDEX_COMPLETE', payload: { totalLines: offsets.length } });

    // Initial Filter (All Pass)
    const all = new Int32Array(offsets.length);
    for (let i = 0; i < offsets.length; i++) all[i] = i;
    filteredIndices = all;

    respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length } });
};

// --- Handler: Stream Init ---
const initStream = () => {
    isStreamMode = true;
    currentFile = null;
    lineOffsets = null;
    streamLines = [];
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

    respond({ type: 'FILTER_COMPLETE', payload: { matchCount: filteredIndices.length } });
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
        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: matches.length } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }

    // File Mode
    if (!currentFile || !lineOffsets) return;

    // Optimization for empty rule
    const excludes = rule.excludes.filter(e => e.trim());
    const includes = rule.includeGroups.flat().filter(t => t.trim());

    if (excludes.length === 0 && includes.length === 0) {
        const all = new Int32Array(lineOffsets.length);
        for (let i = 0; i < lineOffsets.length; i++) all[i] = i;
        filteredIndices = all;
        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length } });
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
    respond({ type: 'FILTER_COMPLETE', payload: { matchCount: matches.length } });
};

// --- Handler: Get Lines ---
const getLines = async (startFilterIndex: number, count: number, requestId: string) => {
    if (!filteredIndices) return; // Should return empty

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
        if (!currentFile || !lineOffsets) return;

        const readSlice = (blob: Blob): Promise<string> => {
            return new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target?.result as string);
                r.readAsText(blob);
            });
        };

        for (let i = startFilterIndex; i < max; i++) {
            const originalLineNum = filteredIndices[i];
            const startByte = Number(lineOffsets[originalLineNum]);
            const endByte = originalLineNum < lineOffsets.length - 1 ? Number(lineOffsets[originalLineNum + 1]) : currentFile.size;

            if (startByte >= endByte) {
                resultLines.push({ lineNum: originalLineNum + 1, content: '' });
                continue;
            }
            const text = await readSlice(currentFile.slice(startByte, endByte));
            resultLines.push({ lineNum: originalLineNum + 1, content: text.replace(/\r?\n$/, '') });
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
        if (!currentFile || !lineOffsets) return;
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


// --- Handler: Find Highlight ---
const findHighlight = async (keyword: string, startFilterIndex: number, direction: 'next' | 'prev', requestId: string) => {
    if (!filteredIndices) {
        respond({ type: 'FIND_RESULT', payload: { foundIndex: -1 }, requestId });
        return;
    }

    let searchIdx = startFilterIndex;
    if (direction === 'next') searchIdx++; else searchIdx--;

    // Safety check for cached FileReader logic if needed, but for now we create new one per request or reuse logic

    if (isStreamMode) {
        while (searchIdx >= 0 && searchIdx < filteredIndices.length) {
            const originalIdx = filteredIndices[searchIdx];
            if (originalIdx < streamLines.length) {
                const line = streamLines[originalIdx];
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    respond({ type: 'FIND_RESULT', payload: { foundIndex: searchIdx }, requestId });
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
        const MAX_SEARCH = 20000;
        let checked = 0;

        while (searchIdx >= 0 && searchIdx < filteredIndices.length && checked < MAX_SEARCH) {
            const originalLineNum = filteredIndices[searchIdx];
            const startByte = Number(lineOffsets[originalLineNum]);
            const endByte = originalLineNum < lineOffsets.length - 1 ? Number(lineOffsets[originalLineNum + 1]) : currentFile.size;

            if (startByte < endByte) {
                const line = await readSlice(currentFile.slice(startByte, endByte));
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    respond({ type: 'FIND_RESULT', payload: { foundIndex: searchIdx }, requestId });
                    return;
                }
            }
            if (direction === 'next') searchIdx++; else searchIdx--;
            checked++;
        }
    }

    respond({ type: 'FIND_RESULT', payload: { foundIndex: -1 }, requestId });
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
        case 'GET_LINES':
            getLines(payload.startLine, payload.count, requestId || '');
            break;
        case 'GET_RAW_LINES':
            getRawLines(payload.startLine, payload.count, requestId || '');
            break;
        case 'FIND_HIGHLIGHT':
            findHighlight(payload.keyword, payload.startIndex, payload.direction, requestId || '');
            break;
    }
};
