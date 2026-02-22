/* eslint-disable no-restricted-globals */
import { AnalysisResult, AnalysisSegment, extractLogIds, extractSourceMetadata } from '../utils/perfAnalysis';
import { extractTimestamp } from '../utils/logTime';

const ctx: Worker = self as any;

// State
let mode: 'scan' | 'analyze' | 'raw_extract' | null = null;
let keywordLower = '';
let currentLineIndex = 0;
let streamBuffer = '';
let totalBytesProcessed = 0;
let lineOffsets = new Map<number, number>(); // lineIndex -> byteOffset

// Raw Extract State
let searchStart = 0;
let searchEnd = 0;
let extractedLines: { index: number; content: string }[] = [];
let startLineNumber = 0; // For partial reading

// Scan State
let pidCounts = new Map<string, number>();

// Analysis State
let matchedLogsByTid = new Map<string, { timestamp: number; lineContent: string; lineIndex: number }[]>();
let detectedPid: string | null = null;
let perfThreshold = 1000;
let dangerLevels: { ms: number; color: string; label: string }[] = [];
let analysisFileName = '';
let targetTags: string[] = [];

const getDangerColor = (duration: number): string | undefined => {
    let color: string | undefined = undefined;
    const sorted = [...dangerLevels].sort((a, b) => a.ms - b.ms);
    for (const lvl of sorted) {
        if (duration >= lvl.ms) {
            color = lvl.color;
        }
    }
    return color;
};

const processLine = (line: string, index: number) => {
    if (line.toLowerCase().includes(keywordLower)) {
        if (mode === 'scan') {
            const { pid } = extractLogIds(line);
            if (pid) {
                pidCounts.set(pid, (pidCounts.get(pid) || 0) + 1);
            }
        } else if (mode === 'analyze') {
            const { pid, tid: extractedTid } = extractLogIds(line);

            // 1. PID match check
            const isPidMatch = line.toLowerCase().includes(keywordLower);
            if (!isPidMatch) return;

            // 2. Tag match check (if tags specified)
            if (targetTags.length > 0) {
                const lineContentLower = line.toLowerCase();
                const isTagMatch = targetTags.some(tag => lineContentLower.includes(tag.toLowerCase()));
                if (!isTagMatch) return;
            }

            const ts = extractTimestamp(line);
            if (ts !== null) {
                const tid = extractedTid || 'Main';
                if (!detectedPid && pid) detectedPid = pid;
                if (!matchedLogsByTid.has(tid)) matchedLogsByTid.set(tid, []);
                matchedLogsByTid.get(tid)!.push({ timestamp: ts, lineContent: line, lineIndex: index });
            }
        }
    }
};

ctx.onmessage = (evt) => {
    const { type, payload, requestId } = evt.data;

    switch (type) {
        case 'INIT_SCAN':
            mode = 'scan';
            keywordLower = payload.keyword.toLowerCase().trim();
            pidCounts.clear();
            currentLineIndex = 0;
            streamBuffer = '';
            break;

        case 'INIT_ANALYSIS':
            mode = 'analyze';
            keywordLower = payload.keyword.toLowerCase().trim();
            perfThreshold = payload.perfThreshold;
            dangerLevels = payload.dangerLevels || [];
            analysisFileName = payload.fileName || 'Log File';
            targetTags = payload.targetTags || [];
            matchedLogsByTid.clear();
            detectedPid = null;
            currentLineIndex = 0;
            streamBuffer = '';
            totalBytesProcessed = 0;
            lineOffsets.clear();
            lineOffsets.set(0, 0);
            break;

        case 'INIT_RAW_EXTRACT':
            mode = 'raw_extract';
            searchStart = payload.searchStart;
            searchEnd = payload.searchEnd;
            startLineNumber = payload.startLineNumber || 0;
            extractedLines = [];
            currentLineIndex = startLineNumber;
            streamBuffer = '';
            break;

        case 'ADD_CHUNK':
            const chunkStr = payload.chunk;
            const fullStr = streamBuffer + chunkStr;
            let lastIdx = 0;
            const regex = /\r?\n/g;
            let match;

            const encoder = new TextEncoder();

            while ((match = regex.exec(fullStr)) !== null) {
                const lineContent = fullStr.substring(lastIdx, match.index);
                const lineWithSeparator = fullStr.substring(lastIdx, regex.lastIndex);

                currentLineIndex++;

                // Track bytes if analyzing
                if (mode === 'analyze') {
                    const lineBytes = encoder.encode(lineWithSeparator).length;
                    totalBytesProcessed += lineBytes;
                    if (currentLineIndex % 1000 === 0) {
                        lineOffsets.set(currentLineIndex, totalBytesProcessed);
                    }
                }

                if (mode === 'raw_extract') {
                    if (currentLineIndex >= searchStart && currentLineIndex <= searchEnd) {
                        if (extractedLines.length < 2000) { // Safety limit to prevent UI freeze
                            // Cap extremely long lines which can freeze browser layout
                            const safeContent = lineContent.length > 2000
                                ? lineContent.substring(0, 2000) + "... [line truncated for performance]"
                                : lineContent;
                            extractedLines.push({ index: currentLineIndex, content: safeContent });
                        }
                    }
                    if (currentLineIndex >= searchEnd) {
                        // We have everything we need, send it now!
                        ctx.postMessage({ type: 'RAW_EXTRACT_COMPLETE', payload: { lines: extractedLines }, requestId });
                        mode = null; // Exit mode to ignore further chunks
                        return; // Stop processing this chunk
                    }
                } else {
                    processLine(lineContent, currentLineIndex);
                }
                lastIdx = regex.lastIndex;
            }
            streamBuffer = fullStr.substring(lastIdx);
            break;

        case 'FINALIZE':
            if (streamBuffer) {
                currentLineIndex++;
                if (mode === 'raw_extract') {
                    if (currentLineIndex >= searchStart && currentLineIndex <= searchEnd) {
                        extractedLines.push({ index: currentLineIndex, content: streamBuffer });
                    }
                    if (currentLineIndex >= searchEnd && mode === 'raw_extract') {
                        ctx.postMessage({ type: 'RAW_EXTRACT_COMPLETE', payload: { lines: extractedLines }, requestId });
                        mode = null;
                        return;
                    }
                } else {
                    processLine(streamBuffer, currentLineIndex);
                }
            }

            if (mode === 'scan') {
                const results = Array.from(pidCounts.entries())
                    .map(([pid, count]) => ({ pid, count }))
                    .sort((a, b) => b.count - a.count);
                ctx.postMessage({ type: 'SCAN_COMPLETE', payload: { results }, requestId });
            } else if (mode === 'analyze') {
                const allLogs = Array.from(matchedLogsByTid.values()).flat().sort((a, b) => a.timestamp - b.timestamp);

                if (allLogs.length < 2) {
                    ctx.postMessage({ type: 'ERROR', payload: { error: "Not enough logs matched the keyword to form intervals." }, requestId });
                    return;
                }



                const segments: AnalysisSegment[] = [];

                const sortedTids = Array.from(matchedLogsByTid.keys()).sort((a, b) => {
                    const isAMain = a === detectedPid || a === keywordLower;
                    const isBMain = b === detectedPid || b === keywordLower;
                    if (isAMain && !isBMain) return -1;
                    if (!isAMain && isBMain) return 1;
                    return a.localeCompare(b);
                });

                const tidToLane = new Map<string, number>();
                sortedTids.forEach((tid, idx) => tidToLane.set(tid, idx));

                matchedLogsByTid.forEach((logs, tid) => {
                    const lane = tidToLane.get(tid) || 0;
                    const sortedLogs = logs.sort((a, b) => a.timestamp - b.timestamp);

                    for (let i = 0; i < sortedLogs.length - 1; i++) {
                        const current = sortedLogs[i];
                        const next = sortedLogs[i + 1];
                        const duration = next.timestamp - current.timestamp;

                        const isFail = duration >= perfThreshold;


                        const { fileName, functionName } = extractSourceMetadata(current.lineContent);
                        const { fileName: endFileName, functionName: endFunctionName } = extractSourceMetadata(next.lineContent);

                        segments.push({
                            id: `interval-${tid}-${i}-${Math.random().toString(36).substring(7)}`,
                            name: `TID ${tid} • Interval ${i + 1}`,
                            startTime: current.timestamp,
                            endTime: next.timestamp,
                            duration,
                            startLine: current.lineIndex,
                            endLine: next.lineIndex,
                            originalStartLine: current.lineIndex,
                            originalEndLine: next.lineIndex,
                            type: 'manual',
                            status: isFail ? 'fail' : 'pass',
                            logs: [current.lineContent, next.lineContent],
                            dangerColor: getDangerColor(duration),
                            lane,
                            tid,
                            fileName: fileName || undefined,
                            functionName: functionName || undefined,
                            endFileName: endFileName || undefined,
                            endFunctionName: endFunctionName || undefined,
                            intervalIndex: i + 1
                        });
                    }
                });

                const startTime = allLogs[0].timestamp;
                const endTime = allLogs[allLogs.length - 1].timestamp;
                const totalDuration = endTime - startTime;

                const finalPassCount = segments.filter(s => s.status === 'pass').length;
                const finalFailCount = segments.filter(s => s.status === 'fail').length;

                const finishedResult: AnalysisResult = {
                    fileName: analysisFileName,
                    totalDuration,
                    segments,
                    startTime,
                    endTime,
                    logCount: currentLineIndex,
                    passCount: finalPassCount,
                    failCount: finalFailCount,
                    bottlenecks: segments.filter(s => s.status === 'fail'),
                    perfThreshold,
                    lineOffsets: Array.from(lineOffsets.entries()) // Convert to array for transfer
                };

                ctx.postMessage({ type: 'ANALYSIS_COMPLETE', payload: { result: finishedResult }, requestId });
            } else if (mode === 'raw_extract') {
                ctx.postMessage({ type: 'RAW_EXTRACT_COMPLETE', payload: { lines: extractedLines }, requestId });
            }
            break;
    }
};
