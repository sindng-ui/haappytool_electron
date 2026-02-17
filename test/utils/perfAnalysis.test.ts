
import { describe, it, expect } from 'vitest';
import { analyzePerfSegments } from '../../utils/perfAnalysis';
import { LogRule } from '../../types';

describe('analyzePerfSegments (Performance Analysis)', () => {

    const baseRule: LogRule = {
        id: 'perf-rule',
        name: 'Perf Rule',
        includeGroups: [],
        excludes: [],
        highlights: [],
        happyGroups: [
            { id: 'g1', tags: ['StepA'], enabled: true, alias: 'Step A' },
            { id: 'g2', tags: ['StepB'], enabled: true, alias: 'Step B' }
        ],
        dangerThresholds: [{ ms: 100, color: 'bg-red-500', label: 'Slow' }]
    };

    const targetTime = 50; // 50ms threshold

    it('should return empty segments if no lines match', () => {
        const lines = ['[INFO] nothing here'];
        const indices = [0];
        const segments = analyzePerfSegments(lines, indices, baseRule, targetTime, false);
        expect(segments).toHaveLength(0);
    });

    it('should create Step segments for grouped logs (Single Alias Group)', () => {
        // Step A start ... Step A end
        // Timestamp 1000 ... 1060 (duration 60)
        const lines = [
            '[2024-02-16 10:00:01.000] [INFO] StepA Start',
            '[2024-02-16 10:00:01.060] [INFO] StepA End'
        ];
        const indices = [0, 1];

        const segments = analyzePerfSegments(lines, indices, baseRule, targetTime, false);

        // Should find 1 'step' segment for Step A
        const stepASegment = segments.find(s => s.type === 'step' && s.name === 'Step A (Group)');
        expect(stepASegment).toBeDefined();
        expect(stepASegment?.duration).toBe(60);
        expect(stepASegment?.status).toBe('fail'); // 60 > 50
        expect(stepASegment?.dangerColor).toBeUndefined(); // 60 < 100 (Threshold)
    });

    it('should assign danger color based on threshold', () => {
        const lines = [
            '[2024-02-16 10:00:01.000] [INFO] StepA Start',
            '[2024-02-16 10:00:01.200] [INFO] StepA End'
        ]; // 200ms duration
        const indices = [0, 1];
        const segments = analyzePerfSegments(lines, indices, baseRule, targetTime, false);
        const seg = segments[0];
        expect(seg.duration).toBe(200);
        expect(seg.dangerColor).toBe('bg-red-500'); // 200 >= 100
    });

    it('should create Interval segments between different aliases', () => {
        // Step A (1000) -> Step B (1030)
        // Interval: 30ms
        const lines = [
            '[2024-02-16 10:00:01.000] [INFO] StepA',
            '[2024-02-16 10:00:01.030] [INFO] StepB'
        ];
        const indices = [10, 20]; // Arbitrary original line numbers

        const segments = analyzePerfSegments(lines, indices, baseRule, targetTime, false);

        // Expect 1 interval: Step A -> Step B
        const interval = segments.find(s => s.type === 'combo');
        expect(interval).toBeDefined();
        expect(interval?.name).toBe('Step A → Step B');
        expect(interval?.duration).toBe(30);
        expect(interval?.status).toBe('pass'); // 30 < 50
        expect(interval?.startLine).toBe(10);
        expect(interval?.endLine).toBe(20);
    });

    it('should handle complex flow', () => {
        // A(0) -> B(100) -> A(200)
        // Interval 1: A->B (100ms)
        // Interval 2: B->A (100ms)
        const lines = [
            '[2024-02-16 10:00:00.000] [INFO] StepA',
            '[2024-02-16 10:00:00.100] [INFO] StepB',
            '[2024-02-16 10:00:00.200] [INFO] StepA'
        ];
        const indices = [1, 2, 3];
        const segments = analyzePerfSegments(lines, indices, baseRule, targetTime, false);

        const intervals = segments.filter(s => s.type === 'combo');
        expect(intervals).toHaveLength(2);
        expect(intervals[0].name).toBe('Step A → Step B');
        expect(intervals[1].name).toBe('Step B → Step A');
    });

});
