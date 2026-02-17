import { LogRule, FamilyCombo, HappyGroup } from '../types';
import { extractTimestamp } from './logTime';

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
    familyId?: string;
    status: 'pass' | 'fail';
    logs: string[]; // Stores [startLineContent, endLineContent] for combos
    lane?: number;
    dangerColor?: string; // Color based on danger thresholds
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
            tag: foundGroup.tags[0]
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
        const start = logs[0];
        const end = logs[logs.length - 1];
        const duration = end.timestamp - start.timestamp;

        segments.push({
            id: `group-${alias}-${Math.random().toString(36).substring(7)}`,
            name: logs.length > 1 ? `${alias} (Group)` : alias,
            startTime: start.timestamp,
            endTime: end.timestamp,
            duration: duration,
            startLine: start.lineIndex,
            endLine: end.lineIndex,
            originalStartLine: start.lineIndex, // Use visual index as fallback
            originalEndLine: end.lineIndex,     // Use visual index as fallback
            type: 'step',
            status: duration > targetTime ? 'fail' : 'pass',
            logs: logs.length > 1 ? [start.content, end.content] : [start.content],
            dangerColor: rule.dangerThresholds?.find(d => duration >= d.ms)?.color
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
            dangerColor: rule.dangerThresholds?.[0] ? [...rule.dangerThresholds].sort((a, b) => b.ms - a.ms).find(d => duration >= d.ms)?.color : undefined
        });
    }

    // 5. Lane Assignment (for Flame Chart)
    const laneList: { endTime: number }[] = [];
    // Sort by startTime, then duration (larger first) to make layout more stable
    segments.sort((a, b) => a.startTime - b.startTime || b.duration - a.duration).forEach(s => {
        let laneIndex = laneList.findIndex(l => l.endTime <= s.startTime);
        if (laneIndex === -1) {
            laneIndex = laneList.length;
            laneList.push({ endTime: s.endTime });
        } else {
            laneList[laneIndex].endTime = s.endTime;
        }
        s.lane = laneIndex;
    });

    return segments;
};
