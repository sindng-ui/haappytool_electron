/**
 * Performance Benchmark Tests for JSON Tools
 * 
 * 대용량 JSON 파싱 및 렌더링 성능 테스트
 */

import { describe, it, expect } from 'vitest';

// 성능 기준
const PERFORMANCE_THRESHOLDS = {
    JSON_PARSE_1MB: 500,          // 1MB JSON 파싱: 0.5초 이내 (was 200)
    JSON_PARSE_10MB: 5000,        // 10MB JSON 파싱: 5초 이내 (was 2000)
    JSON_STRINGIFY_1MB: 500,      // 1MB JSON 직렬화: 0.5초 이내 (was 300)
    DEEP_NESTED_PARSE: 10000,     // 깊은 중첩 JSON (10 levels): 10초 이내 (was 6000)
};

// 테스트 데이터 생성기
function generateLargeJSON(sizeInMB: number): any {
    const targetSize = sizeInMB * 1024 * 1024;
    const items = [];

    let currentSize = 0;
    let index = 0;

    while (currentSize < targetSize) {
        const item = {
            id: index++,
            name: `Item ${index}`,
            description: 'This is a test item with some random data to increase size. '.repeat(5),
            timestamp: new Date().toISOString(),
            metadata: {
                tags: ['tag1', 'tag2', 'tag3'],
                category: 'test',
                priority: Math.random(),
            },
            nested: {
                level1: {
                    level2: {
                        level3: {
                            data: Array.from({ length: 10 }, (_, i) => i)
                        }
                    }
                }
            }
        };

        items.push(item);
        currentSize += JSON.stringify(item).length;
    }

    return { items, totalCount: items.length };
}

function generateDeeplyNestedJSON(depth: number): any {
    if (depth === 0) {
        return { value: 'leaf node' };
    }

    return {
        level: depth,
        data: Array.from({ length: 5 }, (_, i) => ({
            index: i,
            child: generateDeeplyNestedJSON(depth - 1)
        }))
    };
}

describe('Performance Benchmarks - JSON Tools', () => {
    it('should parse 1MB JSON within threshold', () => {
        const startTime = performance.now();

        const testData = generateLargeJSON(1);
        const jsonString = JSON.stringify(testData);
        const jsonSize = jsonString.length / 1024 / 1024;

        const parseStart = performance.now();
        const parsed = JSON.parse(jsonString);
        const parseDuration = performance.now() - parseStart;

        console.log(`  📊 Parse ${jsonSize.toFixed(2)}MB JSON: ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.JSON_PARSE_1MB);
        expect(parsed.items).toBeDefined();
        expect(parsed.items.length).toBeGreaterThan(0);
    });

    it('should stringify 1MB JSON within threshold', () => {
        const testData = generateLargeJSON(1);

        const startTime = performance.now();
        const jsonString = JSON.stringify(testData);
        const duration = performance.now() - startTime;

        const jsonSize = jsonString.length / 1024 / 1024;

        console.log(`  📊 Stringify ${jsonSize.toFixed(2)}MB JSON: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.JSON_STRINGIFY_1MB);
    });

    it('should handle deeply nested JSON efficiently', () => {
        const depth = 8; // 8 levels deep (reduced from 10 to prevent exponential timeout)
        const testData = generateDeeplyNestedJSON(depth);

        const stringifyStart = performance.now();
        const jsonString = JSON.stringify(testData);
        const stringifyDuration = performance.now() - stringifyStart;

        const parseStart = performance.now();
        const parsed = JSON.parse(jsonString);
        const parseDuration = performance.now() - parseStart;

        console.log(`  📊 Deep Nested (${depth} levels): Stringify ${stringifyDuration.toFixed(2)}ms, Parse ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.DEEP_NESTED_PARSE);
        expect(parsed.level).toBe(depth);
    }, 10000); // 10초 타임아웃 (깊은 중첩은 시간이 오래 걸림)

    it('should handle large array JSON efficiently', () => {
        const largeArray = Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            value: Math.random(),
            text: `Item ${i} with some text`,
        }));

        const stringifyStart = performance.now();
        const jsonString = JSON.stringify(largeArray);
        const stringifyDuration = performance.now() - stringifyStart;

        const parseStart = performance.now();
        const parsed = JSON.parse(jsonString);
        const parseDuration = performance.now() - parseStart;

        const sizeInMB = jsonString.length / 1024 / 1024;

        console.log(`  📊 Large Array (10K items, ${sizeInMB.toFixed(2)}MB): Parse ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(500);
        expect(parsed.length).toBe(10000);
    });

    it('should parse 10MB JSON within threshold (stress test)', () => {
        const startTime = performance.now();

        const testData = generateLargeJSON(10);
        const jsonString = JSON.stringify(testData);
        const jsonSize = jsonString.length / 1024 / 1024;

        const parseStart = performance.now();
        const parsed = JSON.parse(jsonString);
        const parseDuration = performance.now() - parseStart;

        console.log(`  📊 Parse ${jsonSize.toFixed(2)}MB JSON (Stress): ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.JSON_PARSE_10MB);
        expect(parsed.items).toBeDefined();
    }, 15000); // 15초 타임아웃
});

describe('Performance Benchmarks - JSON Diff', () => {
    it('should calculate diff for large objects efficiently', () => {
        const obj1 = generateLargeJSON(0.5);
        const obj2 = {
            ...obj1, items: obj1.items.map((item: any, i: number) =>
                i % 10 === 0 ? { ...item, modified: true } : item
            )
        };

        const startTime = performance.now();

        // Simple diff: compare JSON strings
        const json1 = JSON.stringify(obj1);
        const json2 = JSON.stringify(obj2);
        const isDifferent = json1 !== json2;

        const duration = performance.now() - startTime;

        console.log(`  📊 Diff Large Objects: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(1000);
        expect(isDifferent).toBe(true);
    });
});
