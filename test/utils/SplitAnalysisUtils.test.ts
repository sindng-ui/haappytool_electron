import { describe, it, expect } from 'vitest';
import {
    extractSingleMetadata,
    computeMetricsFromMetadata,
    AggregateMetrics,
    PointMetrics
} from '../../workers/SplitAnalysisUtils';
import { LogRule, LogMetadata } from '../../types';

describe('SplitAnalysisUtils', () => {
    const mockRule: LogRule = {
        id: 'test-rule',
        name: 'Test Rule',
        includeGroups: [],
        excludes: [],
        highlights: [],
        happyGroups: [
            { id: 'g1', tags: ['MatchingTag'], enabled: true, alias: 'Match' },
            { id: 'g2', tags: ['TagA', 'TagB'], enabled: true, alias: 'MultiMatch' }
        ]
    };

    describe('extractSingleMetadata', () => {
        it('should extract basic metadata from a log line', () => {
            const line = '[2024-03-08 10:00:00.123] (P 100, T 200) Logger.cs: OnStart(10)> Hello World';
            const meta = extractSingleMetadata(line, 0, 0, mockRule);

            expect(meta.fileName).toBe('Logger.cs');
            expect(meta.functionName).toBe('OnStart');
            expect(meta.codeLineNum).toBe('10');
            expect(meta.timestamp).toBeDefined();
            expect(meta.tid).toBe('200');
            expect(meta.isError).toBe(false);
        });

        it('should detect error and warning levels', () => {
            const errorLine = 'E/Tag (P 100, T 200) Something failed critically';
            const warnLine = 'W/Tag (P 100, T 200) Just a warning';

            const errMeta = extractSingleMetadata(errorLine, 0, 0, null);
            const warnMeta = extractSingleMetadata(warnLine, 1, 1, null);

            expect(errMeta.isError).toBe(true);
            expect(warnMeta.isWarn).toBe(true);
        });

        it('should match Happy Combo Alias with AND condition', () => {
            const matchLine = 'Some log with TagA and also TagB';
            const noMatchLine = 'Some log with only TagA';

            const matchMeta = extractSingleMetadata(matchLine, 0, 0, mockRule);
            const noMatchMeta = extractSingleMetadata(noMatchLine, 1, 1, mockRule);

            expect(matchMeta.alias).toBe('MultiMatch');
            expect(noMatchMeta.alias).toBeNull();
        });
    });

    describe('computeMetricsFromMetadata (Split Analysis Engine)', () => {
        const createMeta = (text: string, vidx: number, timestamp: number): LogMetadata => {
            const meta = extractSingleMetadata(text, vidx, vidx, mockRule);
            meta.timestamp = timestamp;
            return meta;
        };

        it('should aggregate metrics correctly for Left side (Consecutive matches)', () => {
            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            const state = {
                prevTimestamp: null,
                prevSignature: 'START',
                prevFileInfo: { fileName: '', functionName: '', preview: '' },
                lookbackWindow: [],
                aliasFirstMatch: {},
                metricsCount: { val: 0 },
                lastSignif: undefined
            };

            const data = [
                createMeta('[10:00:01.000] Line.cs: FuncA(1)> Start', 0, 1000),
                createMeta('[10:00:01.100] Line.cs: FuncB(2)> End', 1, 1100)
            ];

            computeMetricsFromMetadata(data, metrics, pointMetrics, state, 1000, 'left');

            const key = 'Line.cs::FuncA(1) ➔ Line.cs::FuncB(2)';
            expect(metrics[key]).toBeDefined();
            expect(metrics[key].count).toBe(1);
            expect(metrics[key].totalDelta).toBe(100);
            expect(metrics[key].directCount).toBe(1);

            // Point metrics check
            expect(pointMetrics['Line.cs::FuncA(1)']).toBeDefined();
            expect(pointMetrics['Line.cs::FuncB(2)']).toBeDefined();
        });

        it('should handle windowed matching for Right side', () => {
            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            const state = {
                prevTimestamp: null,
                prevSignature: 'START',
                prevFileInfo: { fileName: '', functionName: '', preview: '' },
                lookbackWindow: [],
                aliasFirstMatch: {},
                metricsCount: { val: 0 },
                lastSignif: undefined
            };

            // Scenario: A -> (Noise) -> B
            const data = [
                createMeta('[10:00:01.000] Line.cs: FuncA(1)> Start', 0, 1000),
                createMeta('[10:00:01.050] Noise.js: Ignore(0)> Skip me', 1, 1050),
                createMeta('[10:00:01.100] Line.cs: FuncB(2)> End', 2, 1100)
            ];

            computeMetricsFromMetadata(data, metrics, pointMetrics, state, 1000, 'right');

            const key = 'Line.cs::FuncA(1) ➔ Line.cs::FuncB(2)';
            expect(metrics[key]).toBeDefined();
            expect(metrics[key].count).toBe(0); // Noise skipped, so not direct
            expect(metrics[key].directCount).toBe(0);
            expect(metrics[key].totalDelta).toBe(100);
        });

        it('should enforce Hard Cap for memory protection', () => {
            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            // Emulate cap reached
            const state = {
                prevTimestamp: null,
                prevSignature: 'START',
                prevFileInfo: { fileName: '', functionName: '', preview: '' },
                lookbackWindow: [],
                aliasFirstMatch: {},
                metricsCount: { val: 100001 }
            };

            const data = [
                createMeta('[10:00:02.000] New.cs: Test(0)> One', 0, 2000),
                createMeta('[10:00:02.100] New.cs: Test(1)> Two', 1, 2100)
            ];

            computeMetricsFromMetadata(data, metrics, pointMetrics, state, 1000, 'left');

            expect(Object.keys(metrics)).toHaveLength(0); // Should have stopped immediately
        });

        it('should handle 0ms deltas (Point-in-time logs)', () => {
            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            const state = {
                prevTimestamp: null,
                prevSignature: 'START',
                prevFileInfo: { fileName: '', functionName: '', preview: '' },
                lookbackWindow: [],
                aliasFirstMatch: {},
                metricsCount: { val: 0 },
                lastSignif: undefined
            };

            const data = [
                createMeta('[10:00:05.000] Line.cs: Log(1)> A', 0, 5000),
                createMeta('[10:00:05.000] Line.cs: Log(2)> B', 1, 5000) // Same timestamp
            ];

            computeMetricsFromMetadata(data, metrics, pointMetrics, state, 1000, 'left');

            const key = 'Line.cs::Log(1) ➔ Line.cs::Log(2)';
            expect(metrics[key]).toBeDefined();
            expect(metrics[key].totalDelta).toBe(0);
            expect(metrics[key].deltaSamples).toBe(1); // 0ms is still a sample
        });

        it('should correctly track unique TIDs up to limit', () => {
            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            const state = {
                prevTimestamp: null,
                prevSignature: 'START',
                prevFileInfo: { fileName: '', functionName: '', preview: '' },
                lookbackWindow: [],
                aliasFirstMatch: {},
                metricsCount: { val: 0 },
                lastSignif: undefined
            };

            const data: LogMetadata[] = [];
            for (let i = 0; i < 15; i++) {
                const p = createMeta(`[10:00:00] Line.cs: Prev(0)> S`, i * 2, 1000);
                p.tid = `TID_${i}`;
                const c = createMeta(`[10:00:01] Line.cs: Curr(0)> E`, i * 2 + 1, 2000);
                c.tid = `TID_${i}`;
                data.push(p, c);
            }

            computeMetricsFromMetadata(data, metrics, pointMetrics, state, 5000, 'left');

            const key = 'Line.cs::Prev(0) ➔ Line.cs::Curr(0)';
            expect(metrics[key]).toBeDefined();
            // Limit is 10
            expect(metrics[key].tids.length).toBe(10);
            expect(metrics[key].count).toBe(15);
        });

        it('should aggregate Happy Combo Alias segments correctly', () => {
            const metrics: AggregateMetrics = {};
            const pointMetrics: PointMetrics = {};
            const state = {
                prevTimestamp: null,
                prevSignature: 'START',
                prevFileInfo: { fileName: '', functionName: '', preview: '' },
                lookbackWindow: [],
                aliasFirstMatch: {},
                metricsCount: { val: 0 },
                lastSignif: undefined
            };

            const data = [
                createMeta('[10:00:00] MatchingTag Start', 0, 1000), // Alias: Match
                createMeta('[10:00:01] Normal Log', 1, 1500),
                createMeta('[10:00:02] MatchingTag End', 2, 2000)   // Alias: Match
            ];

            computeMetricsFromMetadata(data, metrics, pointMetrics, state, 1000, 'left');

            const key = '[Alias] Match';
            expect(metrics[key]).toBeDefined();
            expect(metrics[key].totalDelta).toBe(1000); // 2000 - 1000
            expect(metrics[key].count).toBe(1);
        });
    });
});
