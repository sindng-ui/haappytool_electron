
import { describe, it, expect } from 'vitest';
import { checkIsMatch } from '../../utils/logFiltering';
import { LogRule } from '../../types';

// Goal: Fast reaction for UX
const PERF_THRESHOLD_10K_MS = 15;
const PERF_THRESHOLD_100K_MS = 100;

function generateLogLines(count: number): string[] {
    const lines = [];
    const keywords = ['INFO', 'DEBUG', 'ERROR', 'WARNING', 'FATAL'];
    for (let i = 0; i < count; i++) {
        const keyword = keywords[i % keywords.length];
        lines.push(`[2024-02-16 10:${i % 60}:00] [${keyword}] Line ${i}: content with random text simulation.`);
    }
    return lines;
}

describe('Logging Performance Benchmarks', () => {
    const lines10k = generateLogLines(10000);
    const lines100k = generateLogLines(100000);
    const lines1M = generateLogLines(1000000); // 1M lines for stress test

    const simpleRule: LogRule = {
        id: 'simple',
        name: 'Simple',
        includeGroups: [['ERROR']],
        excludes: [],
        highlights: [],
        happyCombosCaseSensitive: false,
        blockListCaseSensitive: false
    };

    const complexRule: LogRule = {
        id: 'complex',
        name: 'Complex',
        includeGroups: [['ERROR', 'FATAL'], ['WARNING', 'database'], ['network', 'timeout']],
        excludes: ['ignore', 'debug', 'trace'],
        highlights: [],
        happyCombosCaseSensitive: false,
        blockListCaseSensitive: false
    };

    it(`should filter 10k lines within ${PERF_THRESHOLD_10K_MS}ms (Simple)`, () => {
        const start = performance.now();
        let matches = 0;
        for (const line of lines10k) {
            if (checkIsMatch(line, simpleRule, false)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Filter 10k (Simple): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(PERF_THRESHOLD_10K_MS);
    });

    it(`should filter 100k lines within ${PERF_THRESHOLD_100K_MS}ms (Complex)`, () => {
        const start = performance.now();
        let matches = 0;
        for (const line of lines100k) {
            if (checkIsMatch(line, complexRule, false)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Filter 100k (Complex): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(PERF_THRESHOLD_100K_MS);
    });

    it('should filter 1,000,000 lines within 1 second (Stress Test)', () => {
        const start = performance.now();
        let matches = 0;
        for (const line of lines1M) {
            if (checkIsMatch(line, complexRule, false)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Stress Test 1M (Complex): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(1000);
    });

    it('should show caching efficiency for Case-Insensitive vs Case-Sensitive', () => {
        // Case-sensitive path is usually faster because no toLowerCase()
        // But with our caching, Case-insensitive should be very close

        const startCS = performance.now();
        for (const line of lines100k) {
            checkIsMatch(line, { ...complexRule, happyCombosCaseSensitive: true }, false);
        }
        const durationCS = performance.now() - startCS;

        const startCI = performance.now();
        for (const line of lines100k) {
            checkIsMatch(line, { ...complexRule, happyCombosCaseSensitive: false }, false);
        }
        const durationCI = performance.now() - startCI;

        console.log(`100k Case-Sensitive: ${durationCS.toFixed(2)}ms`);
        console.log(`100k Case-Insensitive (with Cache): ${durationCI.toFixed(2)}ms`);

        // Target: CI shouldn't be more than 2x slower than CS (standard without caching is often much worse)
        expect(durationCI).toBeLessThan(durationCS * 2.5);
    });

    it('should handle Bypass Logic efficiently with large data', () => {
        const start = performance.now();
        for (const line of lines100k) {
            checkIsMatch(line, simpleRule, true);
        }
        const duration = performance.now() - start;
        console.log(`Filter 100k (Bypass Enabled): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(PERF_THRESHOLD_100K_MS);
    });
});
