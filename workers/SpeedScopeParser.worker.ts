/* eslint-disable no-restricted-globals */
import { AnalysisResult, AnalysisSegment } from '../utils/perfAnalysis';

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
    unit: string;
    startValue: number;
    endValue: number;
    events?: SpeedScopeEvent[];
}

interface SpeedScopeJSON {
    version: string;
    shared: {
        frames: SpeedScopeFrame[];
    };
    profiles: SpeedScopeProfile[];
}

ctx.onmessage = (evt) => {
    const { type, payload, requestId } = evt.data;

    if (type === 'PARSE_SPEED_SCOPE') {
        const { jsonString, fileName, perfThreshold, dangerLevels } = payload;

        try {
            const data: SpeedScopeJSON = JSON.parse(jsonString);

            // 1. Find Main Thread Profile
            // dotnet-trace speedscope files often have "Main Thread" in the name
            let mainProfile = data.profiles.find(p =>
                p.name.toLowerCase().includes('main thread') ||
                p.name.toLowerCase().includes('thread (0)')
            );

            // Fallback to first profile if not found
            if (!mainProfile && data.profiles.length > 0) {
                mainProfile = data.profiles[0];
            }

            if (!mainProfile || mainProfile.type !== 'evented' || !mainProfile.events) {
                ctx.postMessage({
                    type: 'ERROR',
                    payload: { error: 'Could not find a valid evented Main Thread profile in Speed Scope JSON.' },
                    requestId
                });
                return;
            }

            const segments: AnalysisSegment[] = [];
            const stack: { frame: number; at: number; id: string }[] = [];
            const frames = data.shared.frames;

            // 2. Process Events to build Flame Graph segments
            mainProfile.events.forEach((ev, idx) => {
                if (ev.type === 'O') {
                    stack.push({
                        frame: ev.frame,
                        at: ev.at,
                        id: `ss-${idx}-${Math.random().toString(36).substring(7)}`
                    });
                } else if (ev.type === 'C') {
                    const top = stack.pop();
                    if (top && top.frame === ev.frame) {
                        const duration = ev.at - top.at;
                        const frameInfo = frames[top.frame];

                        // Convert to AnalysisSegment
                        const segment: AnalysisSegment = {
                            id: top.id,
                            name: frameInfo.name,
                            startTime: top.at,
                            endTime: ev.at,
                            duration: duration,
                            startLine: -1, // No log line mapping for Speed Scope
                            endLine: -1,
                            originalStartLine: -1,
                            originalEndLine: -1,
                            type: 'step',
                            status: duration >= perfThreshold ? 'fail' : 'pass',
                            logs: [`SpeedScope: ${frameInfo.name}`],
                            lane: stack.length, // Deepness as lane
                            tid: mainProfile!.name,
                            fileName: frameInfo.file || undefined,
                            functionName: frameInfo.name,
                        };

                        // Apply danger colors if provided
                        if (dangerLevels && dangerLevels.length > 0) {
                            const sorted = [...dangerLevels].sort((a, b) => b.ms - a.ms);
                            const matched = sorted.find(d => duration >= d.ms);
                            if (matched) {
                                segment.dangerColor = matched.color;
                            }
                        }

                        segments.push(segment);
                    }
                }
            });

            // 3. Constuct final analysis result
            const startTime = mainProfile.startValue;
            const endTime = mainProfile.endValue;

            const result: AnalysisResult = {
                fileName: fileName || 'SpeedScope.json',
                totalDuration: endTime - startTime,
                segments: segments.sort((a, b) => a.startTime - b.startTime),
                startTime,
                endTime,
                logCount: mainProfile.events.length,
                passCount: segments.filter(s => s.status === 'pass').length,
                failCount: segments.filter(s => s.status === 'fail').length,
                bottlenecks: segments.filter(s => s.status === 'fail'),
                perfThreshold
            };

            ctx.postMessage({ type: 'ANALYSIS_COMPLETE', payload: { result }, requestId });

        } catch (err: any) {
            ctx.postMessage({
                type: 'ERROR',
                payload: { error: `Failed to parse Speed Scope JSON: ${err.message}` },
                requestId
            });
        }
    }
};
