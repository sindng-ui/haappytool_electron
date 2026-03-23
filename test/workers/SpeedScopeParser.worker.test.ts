import { describe, it, expect } from 'vitest';
import { detectMainThread } from '../../utils/speedScopeUtils';
import { AnalysisSegment } from '../../utils/perfAnalysis';

describe('SpeedScope Main Thread Detection', () => {

    it('[CRITICAL] Should detect "Managed Thread" as main in dotnet trace', () => {
        const profiles = [
            { name: "CPU Profile", segmentCount: 100 },
            { name: "Managed Thread (0x1234)", segmentCount: 500 },
            { name: "GC Thread", segmentCount: 50 }
        ];
        const fileName = "app.nettrace.json";
        const allSegments: AnalysisSegment[][] = [[], [], []];

        const result = detectMainThread(profiles, fileName, allSegments);
        expect(result).toBe(1); // Managed Thread (0x1234)
    });

    it('[CRITICAL] Should prefer "Thread (0)" over more active threads', () => {
        const profiles = [
            { name: "Thread (0)", segmentCount: 200 },
            { name: "Thread (123)", segmentCount: 5000 }, // More active but not main
            { name: "Helper", segmentCount: 100 }
        ];
        const fileName = "trace.json";
        const allSegments: AnalysisSegment[][] = [[], [], []];

        const result = detectMainThread(profiles, fileName, allSegments);
        expect(result).toBe(0); // Thread (0) should win due to pattern
    });

    it('[HIGH] Should pick the most active if multiple match the same pattern', () => {
        const profiles = [
            { name: "Managed Thread (0x1)", segmentCount: 100 },
            { name: "Managed Thread (0x2)", segmentCount: 1000 }, // Most active managed thread
            { name: "Managed Thread (0x3)", segmentCount: 50 }
        ];
        const fileName = "trace.json";
        const allSegments: AnalysisSegment[][] = [[], [], [], []];

        const result = detectMainThread(profiles, fileName, allSegments);
        expect(result).toBe(1); 
    });

    it('[HIGH] Should prioritize exact filename match', () => {
        const profiles = [
            { name: "Main", segmentCount: 1000 },
            { name: "MySuperService", segmentCount: 10 } // Matches filename
        ];
        const fileName = "MySuperService.json";
        const allSegments: AnalysisSegment[][] = [[], []];

        const result = detectMainThread(profiles, fileName, allSegments);
        expect(result).toBe(1);
    });

    it('[MEDIUM] Should follow Process32 pattern in root segments (Legacy)', () => {
        const profiles = [
            { name: "1640", segmentCount: 10 },
            { name: "Other", segmentCount: 100 }
        ];
        const fileName = "log.json";
        const allSegments: any[][] = [
            [
                { name: "Process32 Process(1640) (PID: 1640) Args: ...", lane: 0 }
            ],
            []
        ];

        const result = detectMainThread(profiles, fileName, allSegments);
        expect(result).toBe(0); // Profile named "1640" matched via metadata
    });

    it('[LOW] Should fallback to most active if no pattern matches', () => {
        const profiles = [
            { name: "Unknown A", segmentCount: 10 },
            { name: "Unknown B", segmentCount: 500 }, // Most active
            { name: "Unknown C", segmentCount: 50 }
        ];
        const fileName = "unknown.json";
        const allSegments: AnalysisSegment[][] = [[], [], []];

        const result = detectMainThread(profiles, fileName, allSegments);
        expect(result).toBe(1);
    });
});
