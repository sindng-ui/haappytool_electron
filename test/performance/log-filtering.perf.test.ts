
import { describe, it, expect } from 'vitest';
import { checkIsMatch } from '../../utils/logFiltering';
import { LogRule } from '../../types';

// Performance Baselines
// Goal: <10ms for 1000 lines (simulating heavy stream)
const PERF_THRESHOLD_MS = 20;

function generateLogLines(count: number): string[] {
    const lines = [];
    const keywords = ['INFO', 'DEBUG', 'ERROR', 'WARNING', 'FATAL'];
    for (let i = 0; i < count; i++) {
        const keyword = keywords[i % keywords.length];
        lines.push(`[2024-02-16 10:${i % 60}:00] [${keyword}] This is a log line number ${i} with some random text to simulate content.`);
    }
    return lines;
}

describe('Logging Performance Benchmarks', () => {

    const lines10k = generateLogLines(10000);
    const lines100k = generateLogLines(100000);

    const simpleRule: LogRule = {
        id: 'simple',
        name: 'Simple',
        includeGroups: [['ERROR']],
        excludes: [],
        highlights: [],
        enabled: true,
        happyCombosCaseSensitive: false,
        blockListCaseSensitive: false
    };

    const complexRule: LogRule = {
        id: 'complex',
        name: 'Complex',
        includeGroups: [['ERROR', 'FATAL'], ['WARNING', 'database'], ['network', 'timeout']],
        excludes: ['ignore', 'debug', 'trace'],
        highlights: [],
        enabled: true,
        happyCombosCaseSensitive: false,
        blockListCaseSensitive: false
    };

    it('should filter 10k lines with simple rule within threshold', () => {
        const start = performance.now();
        let matches = 0;
        for (const line of lines10k) {
            if (checkIsMatch(line, simpleRule, false)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Filter 10k (Simple): ${duration.toFixed(2)}ms`); // Expected ~5-15ms
        expect(duration).toBeLessThan(PERF_THRESHOLD_MS * 10); // < 200ms for 10k
    });

    it('should filter 10k lines with complex rule within threshold', () => {
        const start = performance.now();
        let matches = 0;
        for (const line of lines10k) {
            if (checkIsMatch(line, complexRule, false)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Filter 10k (Complex): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(PERF_THRESHOLD_MS * 20); // Allow more time for complex logic
    });

    it('should filter 100k lines efficiently', () => {
        const start = performance.now();
        let matches = 0;
        for (const line of lines100k) {
            if (checkIsMatch(line, complexRule, false)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Filter 100k (Complex): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(500); // < 500ms for 100k
    });

    it('should handle Bypass Logic efficiently', () => {
        // Bypass logic adds a check for " /" or date formats
        // Ensure it doesn't slow down normal processing too much
        const start = performance.now();
        let matches = 0;
        for (const line of lines100k) {
            // Passing true for bypassShellFilter
            if (checkIsMatch(line, simpleRule, true)) matches++;
        }
        const duration = performance.now() - start;
        console.log(`Filter 100k (Bypass Enabled): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(500);
    });
});
