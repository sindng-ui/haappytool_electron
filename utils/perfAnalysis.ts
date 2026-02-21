import { LogRule, HappyGroup } from '../types';
import { extractTimestamp } from './logTime';
import { extractTransactionIds } from './transactionAnalysis';

export interface AnalysisSegment {
    id: string;
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    startLine: number;
    endLine: number;
    originalStartLine: number;
    originalEndLine: number;
    type: 'combo' | 'manual' | 'step';

    status: 'pass' | 'fail';
    logs: string[]; // Stores [startLineContent, endLineContent] for combos
    lane?: number;
    dangerColor?: string; // Color based on danger thresholds

    // Enhanced Metadata
    tid?: string;
    fileName?: string;
    functionName?: string;
    endFileName?: string;
    endFunctionName?: string;
    intervalIndex?: number;
}

export interface AnalysisResult {
    fileName: string;
    totalDuration: number;
    segments: AnalysisSegment[];
    startTime: number;
    endTime: number;
    logCount: number;
    passCount: number;
    failCount: number;
    bottlenecks: AnalysisSegment[];
    perfThreshold: number;
}

/**
 * Extracts potential PID and TID from a log line.
 * Used for automated PID discovery in PerfTool.
 */
export const extractLogIds = (line: string): { pid: string | null, tid: string | null } => {
    let pid: string | null = null;
    let tid: string | null = null;

    // 1. (P 123, T 456) or (T 456, P 123) or (123, 456)
    const parenMatch = line.match(/\(\s*(?:P\s*)?(\d+)\s*[,:\s-]\s*(?:T\s*)?(\d+)\s*\)/i);
    if (parenMatch) {
        pid = parenMatch[1];
        tid = parenMatch[2];
    } else {
        // 2. [PID:TID] or [PID TID] or [PID-TID]
        const bracketMatch = line.match(/\[\s*(\d+)\s*[:\s-]\s*(\d+)\s*\]/);
        if (bracketMatch) {
            pid = bracketMatch[1];
            tid = bracketMatch[2];
        } else {
            // 3. Android Standard: Date Time PID TID ...
            const androidMatch = line.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(\d+)\s+(\d+)\s+/);
            if (androidMatch) {
                pid = androidMatch[1];
                tid = androidMatch[2];
            }
        }
    }

    // 4. Handle T/P or P/T combined (Common in some Tizen/embedded formats)
    const combinedMatch = line.match(/(?:T\/P|P\/T)[\s:]*(\d+)/i);
    if (combinedMatch) {
        if (!pid) pid = combinedMatch[1];
        if (!tid) tid = combinedMatch[1];
    }

    // Fallback for individual labels if not found in pairs
    if (!pid) {
        const pMatch = line.match(/(?:P\s*|PID[:\s]|ProcessId[:\s])(\d+)/i);
        if (pMatch) pid = pMatch[1];
    }
    if (!tid) {
        const tMatch = line.match(/(?:T\s*|TID[:\s]|ThreadId[:\s])(\d+)/i);
        if (tMatch) tid = tMatch[1];
    }

    // Final fallback for simple brackets [1234] if nothing else found
    if (!pid && !tid) {
        const simpleBracket = line.match(/\[\s*(\d+)\s*\]/);
        if (simpleBracket) pid = simpleBracket[1];
    }

    return { pid, tid };
};

/**
 * Extracts source metadata (filename, function name) from a log line.
 * Standard format: FileName.ext: FunctionName(Line)>
 */
export const extractSourceMetadata = (line: string): { fileName: string | null, functionName: string | null } => {
    // Standard format: FileName.ext: FunctionName(Line)> or FileName.ext: FunctionName:Line>
    const fileMatch = line.match(/([\w\-\.]+\.(?:cs|cpp|h|java|kt|js|ts|tsx|py|c|h|cc|hpp|m|mm))\s*:/i);
    if (!fileMatch) return { fileName: null, functionName: null };

    const fileName = fileMatch[1];
    const afterFile = line.substring(fileMatch.index! + fileMatch[0].length).trim();

    // 2. Match function name: everything up to '>'
    const funcMatch = afterFile.match(/^([^>]+)(?:>)/);
    let functionName = funcMatch ? funcMatch[1].trim() : null;

    return { fileName, functionName };
};

/**
 * Core performance analysis logic extracted from PerfAnalyzer.
 * Can be run in the main thread or worker.
 */
export const analyzePerfSegments = (
    lines: string[],
    lineIndices: number[], // Actual line numbers in the original file
    rule: LogRule,
    targetTime: number,
    isHappyCS: boolean
): AnalysisSegment[] => {
    const segments: AnalysisSegment[] = [];

    // 1. Filter Aliased Groups
    const validGroups = rule.happyGroups?.filter(g => g.enabled && g.alias && g.tags.length > 0) || [];

    if (validGroups.length === 0) return [];

    // 2. Collection Phase
    interface MatchedLog {
        timestamp: number;
        lineIndex: number;
        content: string;
        alias: string;
        tag: string;
        tid: string;
    }

    const matchedLogs: MatchedLog[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const lineLower = isHappyCS ? '' : line.toLowerCase();

        let foundGroup: HappyGroup | null = null;
        for (const g of validGroups) {
            const matched = g.tags.every(tag => isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase()));
            if (matched) {
                foundGroup = g;
                break;
            }
        }

        if (!foundGroup) continue;

        const ts = extractTimestamp(line);
        if (ts === null) continue;

        matchedLogs.push({
            timestamp: ts,
            lineIndex: lineIndices[idx],
            content: line,
            alias: foundGroup.alias!.trim(),
            tag: foundGroup.tags[0],
            tid: extractTransactionIds(line).find(id => id.type === 'tid')?.value || 'Main'
        });
    }

    if (matchedLogs.length === 0) return [];

    // 3. Global Grouping by Alias (User Request: "OnCreate group section")
    const groupsByAlias = new Map<string, MatchedLog[]>();
    matchedLogs.forEach(log => {
        if (!groupsByAlias.has(log.alias)) groupsByAlias.set(log.alias, []);
        groupsByAlias.get(log.alias)!.push(log);
    });

    groupsByAlias.forEach((logs, alias) => {
        if (logs.length < 2) return; // ✅ Skip single-hit aliases as they don't form a duration/range

        const start = logs[0];
        const end = logs[logs.length - 1];
        const duration = end.timestamp - start.timestamp;

        segments.push({
            id: `group-${alias}-${Math.random().toString(36).substring(7)}`,
            name: `${alias} (Group)`,
            startTime: start.timestamp,
            endTime: end.timestamp,
            duration: duration,
            startLine: start.lineIndex,
            endLine: end.lineIndex,
            originalStartLine: start.lineIndex,
            originalEndLine: end.lineIndex,
            type: 'step',
            status: duration > targetTime ? 'fail' : 'pass',
            logs: [start.content, end.content],
            tid: start.tid,
            dangerColor: rule.dangerThresholds?.[0]
                ? [...rule.dangerThresholds].sort((a, b) => b.ms - a.ms).find(d => duration >= d.ms)?.color
                : undefined
        });
    });

    // 4. Interval Segments: Flow between every consecutive match (A -> B, B -> C...)
    // This provides the "Transitions" the user asked for.
    for (let i = 0; i < matchedLogs.length - 1; i++) {
        const current = matchedLogs[i];
        const next = matchedLogs[i + 1];
        const duration = next.timestamp - current.timestamp;

        segments.push({
            id: `interval-${i}-${Math.random().toString(36).substring(7)}`,
            name: `${current.alias} → ${next.alias}`,
            startTime: current.timestamp,
            endTime: next.timestamp,
            duration: duration,
            startLine: current.lineIndex,
            endLine: next.lineIndex,
            originalStartLine: current.lineIndex, // Use visual index as fallback
            originalEndLine: next.lineIndex,     // Use visual index as fallback
            type: 'combo',
            status: duration > targetTime ? 'fail' : 'pass',
            logs: [current.content, next.content],
            tid: current.tid,
            dangerColor: rule.dangerThresholds?.[0] ? [...rule.dangerThresholds].sort((a, b) => b.ms - a.ms).find(d => duration >= d.ms)?.color : undefined
        });
    }

    // 5. Lane Assignment (for Flame Chart)
    // Group segments by TID first, then pack them within Tid-specific bands
    const segmentsByTid = new Map<string, AnalysisSegment[]>();
    segments.forEach(s => {
        const tid = s.tid || 'Main';
        if (!segmentsByTid.has(tid)) segmentsByTid.set(tid, []);
        segmentsByTid.get(tid)!.push(s);
    });

    const sortedTids = Array.from(segmentsByTid.keys()).sort((a, b) => {
        if (a === 'Main') return -1;
        if (b === 'Main') return 1;
        return a.localeCompare(b);
    });

    let currentLaneOffset = 0;
    sortedTids.forEach(tid => {
        const tidSegments = segmentsByTid.get(tid)!;
        tidSegments.sort((a, b) => a.startTime - b.startTime || b.duration - a.duration);

        const localLanes: { endTime: number }[] = [];
        tidSegments.forEach(s => {
            let laneIndex = localLanes.findIndex(l => l.endTime <= s.startTime);
            if (laneIndex === -1) {
                laneIndex = localLanes.length;
                localLanes.push({ endTime: s.endTime });
            } else {
                localLanes[laneIndex].endTime = s.endTime;
            }
            s.lane = currentLaneOffset + laneIndex;
        });

        currentLaneOffset += localLanes.length;
    });

    return segments;
};
