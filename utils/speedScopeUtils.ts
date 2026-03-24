import { AnalysisSegment } from './perfAnalysis';

/**
 * Speedscope Main Thread Detection Keywords
 */
export const mainThreadPatterns = [
    'main thread', 'thread (0)', 'managed thread', 'thread (0x', 'thread 0', 'thread: 0',
    'crrenderermain', 'main', 'root', 'ui', 'mainloop', 'ecore_main', 'app_main', 
    'activitythread', 'winmain', 'messageloop', 'primary', 'application', 'uithread', 
    'process32', 'procoes32', 'proces'
];

/**
 * Heuristically detects the "Main Thread" or the most relevant profile in a Speedscope JSON.
 * 
 * @param profileInfos Metadata about profiles extracted during parsing
 * @param fileName Original filename for matching
 * @param allProfilesSegments All extracted segments for each profile (to check root metadata)
 * @returns The index of the best profile
 */
export function detectMainThread(
    profileInfos: any[], 
    fileName: string | undefined, 
    allProfilesSegments: AnalysisSegment[][]
): number {
    if (profileInfos.length === 0) return 0;

    const baseFileName = fileName ? fileName.split(/[\\/]/).pop()?.replace(/\.(?:json|nettrace|speedscope)$/i, '').toLowerCase() : '';

    let bestIdx = -1;
    let highestSegmentCount = -1;

    // Priority 0: Exact match with filename (if filename is descriptive)
    if (baseFileName && baseFileName.length > 2) {
        const fileMatchIdx = profileInfos.findIndex(p => p.name.toLowerCase() === baseFileName);
        if (fileMatchIdx !== -1) {
            return fileMatchIdx;
        }
    }

    // Priority 1: Process32/Process(PID)(TID) pattern in root segments
    // This is the most reliable source of truth as it's extracted from the trace metadata
    const procRegex = /(?:Process32|Procoes32|Process|Proces)\s+(?:Process|Proces)\((\d+)\)(?:\((\d+)\))?/i;
    for (let i = 0; i < allProfilesSegments.length; i++) {
        const segments = allProfilesSegments[i];
        const procSegment = segments.slice(0, 50).find(s => s.lane === 0 && procRegex.test(s.name));
        if (procSegment) {
            const match = procSegment.name.match(procRegex);
            if (match) {
                const pid = match[1];
                const tid = match[2] || pid;
                
                const pidIdx = profileInfos.findIndex(p => 
                    p.name === pid || 
                    p.name === tid ||
                    p.name.includes(`(${pid})`) || 
                    p.name.includes(`(${tid})`)
                );
                
                if (pidIdx !== -1) return pidIdx;
            }
            return i;
        }
    }

    // Priority 2: Pattern matching with highest activity
    profileInfos.forEach((p, idx) => {
        const pName = p.name.toLowerCase();
        const hasPattern = mainThreadPatterns.some(pattern => pName.includes(pattern));
        if (hasPattern) {
            if (p.segmentCount > highestSegmentCount) {
                highestSegmentCount = p.segmentCount;
                bestIdx = idx;
            }
        }
    });

    if (bestIdx !== -1) return bestIdx;

    // Fallback: Most active (highest segment count)
    return profileInfos.reduce((prev, curr, idx) => curr.segmentCount > profileInfos[prev].segmentCount ? idx : prev, 0);
}
