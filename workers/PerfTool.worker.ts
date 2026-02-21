/* eslint-disable no-restricted-globals */
import { AnalysisResult, AnalysisSegment, extractLogIds, extractSourceMetadata } from '../utils/perfAnalysis';
import { extractTimestamp } from '../utils/logTime';

const ctx: Worker = self as any;

// State
let mode: 'scan' | 'analyze' | null = null;
let keywordLower = '';
let currentLineIndex = 0;
let streamBuffer = '';

// Scan State
let pidCounts = new Map<string, number>();

// Analysis State
let matchedLogsByTid = new Map<string, { timestamp: number; lineContent: string; lineIndex: number }[]>();
let detectedPid: string | null = null;
let perfThreshold = 1000;
let dangerLevels: { ms: number; color: string; label: string }[] = [];
let analysisFileName = '';

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
            const ts = extractTimestamp(line);
            if (ts !== null) {
                const { pid, tid: extractedTid } = extractLogIds(line);
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
            matchedLogsByTid.clear();
            detectedPid = null;
            currentLineIndex = 0;
            streamBuffer = '';
            break;

        case 'ADD_CHUNK':
            const fullChunk = streamBuffer + payload.chunk;
            const lines = fullChunk.split(/\r?\n/);
            streamBuffer = lines.pop() || '';

            for (const line of lines) {
                currentLineIndex++;
                processLine(line, currentLineIndex);
            }
            break;

        case 'FINALIZE':
            if (streamBuffer) {
                currentLineIndex++;
                processLine(streamBuffer, currentLineIndex);
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
                let passCount = 0;
                let failCount = 0;

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
                        if (isFail) failCount++; else passCount++;

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

                const finishedResult: AnalysisResult = {
                    fileName: analysisFileName,
                    totalDuration,
                    segments,
                    startTime,
                    endTime,
                    logCount: currentLineIndex,
                    passCount,
                    failCount,
                    bottlenecks: segments.filter(s => s.duration >= perfThreshold),
                    perfThreshold
                };

                ctx.postMessage({ type: 'ANALYSIS_COMPLETE', payload: { result: finishedResult }, requestId });
            }
            break;
    }
};
