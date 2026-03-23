/* eslint-disable no-restricted-globals */
import { AnalysisResult, AnalysisSegment, getSegmentColor } from '../utils/perfAnalysis';
import { detectMainThread } from '../utils/speedScopeUtils';

const ctx: Worker = self as any;

interface SpeedScopeFrame {
    name: string;
    file?: string;
    line?: number;
    col?: number;
}

interface SpeedScopeEvent {
    type: 'O' | 'C';
    frame: number;
    at: number;
}

interface SpeedScopeProfile {
    type: 'evented' | 'sampled';
    name: string;
    unit: 'nanoseconds' | 'microseconds' | 'milliseconds' | 'seconds' | 'bytes' | 'none';
    startValue: number;
    endValue: number;
    events?: SpeedScopeEvent[];
    samples?: number[];
    weights?: number[];
}

interface SpeedScopeJSON {
    version: string;
    shared: {
        frames: SpeedScopeFrame[];
        stacks?: number[][];
    };
    profiles: SpeedScopeProfile[];
}

ctx.onmessage = (evt) => {
    const { type, payload, requestId } = evt.data;

    if (type === 'PARSE_SPEED_SCOPE') {
        const { jsonString, fileName, perfThreshold, dangerLevels } = payload;

        try {
            const data: SpeedScopeJSON = JSON.parse(jsonString);
            const frames = data.shared.frames;
            const allProfilesSegments: AnalysisSegment[][] = [];
            const profileInfos: any[] = [];

            data.profiles.forEach((profile, pIdx) => {
                const segments: AnalysisSegment[] = [];
                const scale = getUnitScale(profile.unit);

                if (profile.type === 'evented' && profile.events) {
                    const stack: { frame: number; at: number; id: string; childrenTime: number }[] = [];
                    profile.events.forEach((ev, idx) => {
                        const at = ev.at * scale;
                        if (ev.type === 'O') {
                            stack.push({
                                frame: ev.frame,
                                at: at,
                                id: `ss-e-${pIdx}-${idx}-${Math.random().toString(36).substring(7)}`,
                                childrenTime: 0
                            });
                        } else if (ev.type === 'C') {
                            const top = stack.pop();
                            if (top && top.frame === ev.frame) {
                                const duration = at - top.at;
                                const selfTime = Math.max(0, duration - top.childrenTime);
                                const frameInfo = frames[top.frame];
                                const frameName = frameInfo ? frameInfo.name : `Unknown Frame (${top.frame})`;
                                
                                segments.push({
                                    id: top.id,
                                    name: frameName,
                                    startTime: top.at,
                                    endTime: at,
                                    duration: duration,
                                    selfTime: selfTime,
                                    startLine: -1,
                                    endLine: -1,
                                    originalStartLine: -1,
                                    originalEndLine: -1,
                                    type: 'step',
                                    status: duration >= perfThreshold ? 'fail' : 'pass',
                                    logs: [`SpeedScope: ${frameName}`],
                                    lane: stack.length,
                                    tid: profile.name,
                                    fileName: frameInfo?.file || undefined,
                                    functionName: frameName,
                                    color: getSegmentColor(frameName),
                                    dangerColor: getDangerColor(duration, perfThreshold, dangerLevels)
                                });

                                // Update parent's childrenTime
                                if (stack.length > 0) {
                                    stack[stack.length - 1].childrenTime += duration;
                                }
                            }
                        }
                    });
                } else if (profile.type === 'sampled' && profile.samples && profile.weights) {
                    const stacks = data.shared.stacks || [];
                    const openSegs: (any | null)[] = [];
                    let currentTime = profile.startValue * scale;

                    for (let i = 0; i < profile.samples.length; i++) {
                        const sampleValue = profile.samples[i];
                        const weight = profile.weights[i] * scale;
                        const nextTime = currentTime + weight;
                        
                        // Handle both index-based and direct-array-based samples
                        const currentStack = Array.isArray(sampleValue)
                            ? sampleValue
                            : (data.shared.stacks ? (data.shared.stacks[sampleValue] || []) : [sampleValue]);

                        const maxDepth = Math.max(currentStack.length, openSegs.length);
                        for (let d = 0; d < maxDepth; d++) {
                            const frameIdx = d < currentStack.length ? currentStack[d] : -1;
                            const openSeg = openSegs[d];

                            if (openSeg && (frameIdx === -1 || openSeg.frameIdx !== frameIdx)) {
                                const duration = currentTime - openSeg.startTime;
                                if (duration > 0) {
                                    const frameInfo = frames[openSeg.frameIdx];
                                    const frameName = frameInfo ? frameInfo.name : `Unknown Frame (${openSeg.frameIdx})`;

                                    segments.push({
                                        id: openSeg.id,
                                        name: frameName,
                                        startTime: openSeg.startTime,
                                        endTime: currentTime,
                                        duration: duration,
                                        startLine: -1,
                                        endLine: -1,
                                        originalStartLine: -1,
                                        originalEndLine: -1,
                                        type: 'step',
                                        status: duration >= perfThreshold ? 'fail' : 'pass',
                                        logs: [`SpeedScope: ${frameName}`],
                                        lane: d,
                                        tid: profile.name,
                                        fileName: frameInfo?.file || undefined,
                                        functionName: frameName,
                                        color: getSegmentColor(frameName)
                                    });
                                }
                                openSegs[d] = null;
                            }

                            if (frameIdx !== -1 && (!openSeg || openSeg.frameIdx !== frameIdx)) {
                                openSegs[d] = {
                                    id: `ss-s-${pIdx}-${i}-${d}-${Math.random().toString(36).substring(7)}`,
                                    frameIdx: frameIdx,
                                    startTime: currentTime
                                };
                            }
                        }
                        currentTime = nextTime;
                    }

                    // Close remaining
                    openSegs.forEach((seg, d) => {
                        if (seg) {
                            const duration = currentTime - seg.startTime;
                            if (duration > 0) {
                                const frameInfo = frames[seg.frameIdx];
                                const frameName = frameInfo ? frameInfo.name : `Unknown Frame (${seg.frameIdx})`;

                                segments.push({
                                    id: seg.id,
                                    name: frameName,
                                    startTime: seg.startTime,
                                    endTime: currentTime,
                                    duration: duration,
                                    startLine: -1,
                                    endLine: -1,
                                    originalStartLine: -1,
                                    originalEndLine: -1,
                                    type: 'step',
                                    status: duration >= perfThreshold ? 'fail' : 'pass',
                                    logs: [`SpeedScope: ${frameName}`],
                                    lane: d,
                                    tid: profile.name,
                                    fileName: frameInfo?.file || undefined,
                                    functionName: frameName,
                                    color: getSegmentColor(frameName),
                                    dangerColor: getDangerColor(duration, perfThreshold, dangerLevels)
                                });
                            }
                        }
                    });

                    // Post-process segments to calculate selfTime
                    segments.forEach(s => {
                        const children = segments.filter(child => 
                            child.lane === (s.lane! + 1) && 
                            child.startTime >= s.startTime && 
                            child.endTime <= s.endTime
                        );
                        const childTimeSum = children.reduce((sum, c) => sum + c.duration, 0);
                        s.selfTime = Math.max(0, s.duration - childTimeSum);
                    });
                }
                
                // Calculate Function Stats
                const stats: Record<string, { totalTime: number; selfTime: number; count: number }> = {};
                segments.forEach(s => {
                    if (!stats[s.name]) {
                        stats[s.name] = { totalTime: 0, selfTime: 0, count: 0 };
                    }
                    stats[s.name].totalTime += s.duration;
                    stats[s.name].selfTime += (s.selfTime || 0);
                    stats[s.name].count += 1;
                });

                if (segments.length > 0) {
                    allProfilesSegments.push(segments);
                    profileInfos.push({
                        name: profile.name,
                        type: profile.type,
                        segmentCount: segments.length,
                        duration: profile.endValue * scale - profile.startValue * scale,
                        functionStats: stats
                    });
                }
            });

            if (profileInfos.length === 0) {
                ctx.postMessage({ type: 'ERROR', payload: { error: 'No valid profiles found in JSON.' }, requestId });
                return;
            }

            // Heuristic Detection
            const bestIdx = detectMainThread(profileInfos, fileName, allProfilesSegments);

            const selectedProfileData = allProfilesSegments[bestIdx];
            const pInfo = profileInfos[bestIdx];
            
            const result: AnalysisResult & { profiles?: any[], selectedProfileIndex?: number } = {
                fileName: fileName || 'SpeedScope.json',
                totalDuration: pInfo.duration,
                segments: selectedProfileData.sort((a, b) => a.startTime - b.startTime),
                startTime: selectedProfileData.length > 0 ? Math.min(...selectedProfileData.map(s => s.startTime)) : 0,
                endTime: selectedProfileData.length > 0 ? Math.max(...selectedProfileData.map(s => s.endTime)) : 0,
                logCount: pInfo.segmentCount,
                passCount: selectedProfileData.filter(s => s.status === 'pass').length,
                failCount: selectedProfileData.filter(s => s.status === 'fail').length,
                bottlenecks: selectedProfileData.filter(s => s.status === 'fail'),
                perfThreshold,
                profiles: profileInfos,
                selectedProfileIndex: bestIdx,
                functionStats: pInfo.functionStats
            };

            (result as any).allSegments = allProfilesSegments;

            ctx.postMessage({ type: 'ANALYSIS_COMPLETE', payload: { result }, requestId });

        } catch (err: any) {
            ctx.postMessage({ type: 'ERROR', payload: { error: `Failed to parse Speed Scope JSON: ${err.message}` }, requestId });
        }
    }
};

function getUnitScale(unit: string): number {
    switch (unit) {
        case 'nanoseconds': return 1e-6;
        case 'microseconds': return 1e-3;
        case 'seconds': return 1000;
        case 'milliseconds':
        default: return 1;
    }
}

function getDangerColor(duration: number, perfThreshold: number, dangerLevels?: any[]) {
    if (!dangerLevels || dangerLevels.length === 0) return undefined;
    const sorted = [...dangerLevels].sort((a, b) => b.ms - a.ms);
    const matched = sorted.find(d => duration >= d.ms);
    return matched ? matched.color : undefined;
}
