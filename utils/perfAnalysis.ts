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
    type: 'combo' | 'manual' | 'step';
    familyId?: string;
    status: 'pass' | 'fail';
    logs: string[]; // Stores [startLineContent, endLineContent] for combos
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
    const activeCombos: Map<string, { start: number; line: number; content: string; startName: string }> = new Map();

    let lastEventTimestamp = 0;
    let lastEventContent = '';
    let lastEventLine = 0;
    let lastEventName = '';

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const currentLine = lineIndices[idx];
        const lineLower = isHappyCS ? '' : line.toLowerCase();
        const ts = extractTimestamp(line);

        if (ts === null) continue;

        if (lastEventTimestamp === 0) {
            lastEventTimestamp = ts;
            lastEventContent = line;
            lastEventLine = currentLine;
        }

        let eventProcessed = false;

        // 2. Happy Groups Analysis (Types: Step & Unified Combo)
        if (rule.happyGroups) {
            for (const g of rule.happyGroups) {
                if (!g.enabled || g.tags.length === 0) continue;

                // Check Match
                const matched = g.tags.every(tag => isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase()));

                if (matched) {
                    // Logic A: Unified Combo Analysis (Alias Based Sequencing)
                    if (g.alias) {
                        const alias = g.alias.trim();

                        // If there's a previous marker for this alias, create a segment
                        if (activeCombos.has(alias)) {
                            const startData = activeCombos.get(alias)!;
                            const duration = ts - startData.start;

                            segments.push({
                                id: Math.random().toString(36).substring(7),
                                name: `${alias} (${startData.startName} → ${g.tags[0]})`,
                                startTime: startData.start,
                                endTime: ts,
                                duration,
                                startLine: startData.line,
                                endLine: currentLine,
                                type: 'combo',
                                familyId: alias,
                                status: duration > targetTime ? 'fail' : 'pass',
                                logs: [startData.content, line]
                            });
                        }

                        // Set current hit as the new start marker for this alias
                        activeCombos.set(alias, { start: ts, line: currentLine, content: line, startName: g.tags[0] });

                        // Update last event for step continuity
                        lastEventTimestamp = ts;
                        lastEventContent = line;
                        lastEventLine = currentLine;
                        lastEventName = g.tags[0];
                    }

                    // Logic B: Step Analysis (Legacy + Default)
                    // Always record as a step regardless of role, or maybe only if NOT consumed by combo?
                    // For now, let's keep step analysis parallel to allow detailed view
                    const duration = lastEventTimestamp > 0 ? ts - lastEventTimestamp : 0;
                    const hasPrevLog = lastEventTimestamp > 0 && lastEventLine !== currentLine;
                    const currentName = g.tags[0] || 'Event';

                    segments.push({
                        id: Math.random().toString(36).substring(7),
                        name: hasPrevLog && lastEventName ? `${lastEventName} ~ ${currentName}` : currentName,
                        startTime: hasPrevLog ? lastEventTimestamp : ts,
                        endTime: ts,
                        duration: duration,
                        startLine: hasPrevLog ? lastEventLine : currentLine,
                        endLine: currentLine,
                        type: 'step',
                        status: duration > targetTime ? 'fail' : 'pass',
                        logs: hasPrevLog ? [lastEventContent, line] : [line]
                    });

                    lastEventTimestamp = ts;
                    lastEventContent = line;
                    lastEventLine = currentLine;
                    lastEventName = currentName;

                    // Break loop after first match in Happy Groups to avoid double counting same line?
                    // Usually lines match only one group, but if strictly, break might be safer.
                    // But if a line matches multiple groups, maybe we want multiple events? 
                    // Let's stick to existing behavior: break inner loop (this line is processed)
                    break;
                }
            }
        }

        // fallback for legacy includeGroups
        if (!eventProcessed && rule.includeGroups) {
            for (const g of rule.includeGroups) {
                if (eventProcessed) break;
                const tags = g.filter(t => t.trim());
                if (tags.length === 0) continue;

                const matched = tags.every(tag => isHappyCS ? line.includes(tag) : lineLower.includes(tag.toLowerCase()));
                if (matched) {
                    const duration = lastEventTimestamp > 0 ? ts - lastEventTimestamp : 0;
                    const hasPrevLog = lastEventTimestamp > 0 && lastEventLine !== currentLine;
                    const currentName = tags[0];

                    segments.push({
                        id: Math.random().toString(36).substring(7),
                        name: hasPrevLog && lastEventName ? `${lastEventName} ~ ${currentName}` : currentName,
                        startTime: hasPrevLog ? lastEventTimestamp : ts,
                        endTime: ts,
                        duration: duration,
                        startLine: hasPrevLog ? lastEventLine : currentLine,
                        endLine: currentLine,
                        type: 'step',
                        status: duration > targetTime ? 'fail' : 'pass',
                        logs: hasPrevLog ? [lastEventContent, line] : [line]
                    });

                    lastEventTimestamp = ts;
                    lastEventContent = line;
                    lastEventLine = currentLine;
                    lastEventName = currentName;
                    eventProcessed = true;
                }
            }
        }
    }

    return segments;
};
