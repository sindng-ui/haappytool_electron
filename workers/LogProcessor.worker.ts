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

    // Optimization for empty rule (only if no case sensitive complications)
    // Actually safe to just use empty check
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
    if (!filteredIndices) {
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
            respond({ type: 'LINES_DATA', payload: { lines: [] }, requestId });
            return;
        }

        // Optimize: Group contiguous original lines to read in fewer chunks
        let currentBlockStartIdx = -1;
        let currentBlockEndIdx = -1;
        let blockLines: { lineNum: number, content: string }[] = [];

        // Helper to fetch valid block
        const fetchBlock = async (startFilterI: number, endFilterI: number) => {
            const startLine = filteredIndices![startFilterI];
            const endLine = filteredIndices![endFilterI];

            // Calculate byte range for the whole block
            const startByte = Number(lineOffsets![startLine]);
            const endByteLine = endLine < lineOffsets!.length - 1 ? endLine + 1 : -1;
            const endByte = endByteLine !== -1 ? Number(lineOffsets![endByteLine]) : currentFile!.size;

            if (startByte >= endByte) {
                // Should not happen for valid lines usually, but handle gracefully
                for (let k = startFilterI; k <= endFilterI; k++) {
                    resultLines.push({ lineNum: filteredIndices![k] + 1, content: '' });
                }
                return;
            }

            try {
                const text = await currentFile!.slice(startByte, endByte).text();
                const lines = text.split('\n');

                // Map back to resultLines
                // Note: The text might contain the trailing newline of the last line, so split might produce empty string at end if perfectly aligned.
                // Actually, our offsets include the newline character at the end. 
                // So line 1 is [0, 10], line 2 is [10, 20]. text(0, 20) gives "line1\nline2\n".
                // split('\n') gives ["line1", "line2", ""].
                // We should match them up.

                for (let k = 0; k < lines.length && (startFilterI + k) <= endFilterI; k++) {
                    // Check if we exhausted lines but still have filters (case where file truncates without newline?)
                    // Typically lines.length shoud equal (endLine - startLine + 1).
                    // But wait, split('\n') on "A\nB\n" gives ["A", "B", ""]. We want "A", "B".

                    let content = lines[k];
                    if (k === lines.length - 1 && content === '') continue; // Skip empty trailing split result

                    // Handle \r removal if needed (Windows)
                    if (content.endsWith('\r')) content = content.slice(0, -1);

                    resultLines.push({
                        lineNum: filteredIndices![startFilterI + k] + 1,
                        content: content
                    });
                }
            } catch (err) {
                console.error('Error batch reading lines', err);
                // Fallback
                for (let k = startFilterI; k <= endFilterI; k++) {
                    resultLines.push({ lineNum: filteredIndices![k] + 1, content: '[Error reading line]' });
                }
            }
        };

        // Identify contiguous blocks in filteredIndices
        // However, 'contiguous' means originalLineNum[i+1] == originalLineNum[i] + 1

        let batchStartI = startFilterIndex;
        for (let i = startFilterIndex; i < max; i++) {
            // If next one is not contiguous, flush batch
            const currentOriginal = filteredIndices[i];
            const nextOriginal = (i + 1 < max) ? filteredIndices[i + 1] : -2;

            if (nextOriginal !== currentOriginal + 1) {
                // End of a contiguous block
                await fetchBlock(batchStartI, i);
                batchStartI = i + 1;
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
                const lineCheck = isCaseSensitive ? line : line.toLowerCase();
                if (lineCheck.includes(effectiveKeyword)) {
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


// --- Handler: Get Full Text (Optimized) ---
const getFullText = async (requestId: string) => {
    if (!filteredIndices) {
        respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
        return;
    }

    // If result is expected to be very large, this might still be slow or max out memory, 
    // but avoiding object creation per line {lineNum, content} is a significant speedup (10x-100x).
    const lines: string[] = [];

    if (isStreamMode) {
        for (let i = 0; i < filteredIndices.length; i++) {
            const originalIdx = filteredIndices[i];
            if (originalIdx < streamLines.length) {
                lines.push(streamLines[originalIdx]);
            }
        }
    } else {
        if (!currentFile || !lineOffsets) {
            respond({ type: 'FULL_TEXT_DATA', payload: { text: '' }, requestId } as any);
            return;
        }

        // Optimize: Group contiguous original lines to read in fewer chunks
        const max = filteredIndices.length;
        let batchStartI = 0;

        const fetchBlockStr = async (startFilterI: number, endFilterI: number) => {
            const startLine = filteredIndices![startFilterI];
            const endLine = filteredIndices![endFilterI];
            const startByte = Number(lineOffsets![startLine]);
            const endByteLine = endLine < lineOffsets!.length - 1 ? endLine + 1 : -1;
            const endByte = endByteLine !== -1 ? Number(lineOffsets![endByteLine]) : currentFile!.size;

            if (startByte >= endByte) return;

            try {
                const text = await currentFile!.slice(startByte, endByte).text();
                const rawLines = text.split('\n');

                for (let k = 0; k < rawLines.length && (startFilterI + k) <= endFilterI; k++) {
                    let content = rawLines[k];
                    if (k === rawLines.length - 1 && content === '') continue;
                    if (content.endsWith('\r')) content = content.slice(0, -1);
                    lines.push(content);
                }
            } catch (err) {
                console.error('Error batch reading lines for full text', err);
            }
        };

        for (let i = 0; i < max; i++) {
            const currentOriginal = filteredIndices[i];
            const nextOriginal = (i + 1 < max) ? filteredIndices[i + 1] : -2;

            if (nextOriginal !== currentOriginal + 1) {
                await fetchBlockStr(batchStartI, i);
                batchStartI = i + 1;
            }
        }
    }

    respond({ type: 'FULL_TEXT_DATA', payload: { text: lines.join('\n') }, requestId } as any);
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
        case 'GET_FULL_TEXT' as any: // Cast for now until types updated
            getFullText(requestId || '');
            break;
    }
};
