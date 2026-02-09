/**
 * Performance Benchmark Tests for Post Tool
 * 
 * 대용량 API 응답 처리 성능 테스트
 */

import { describe, it, expect } from 'vitest';

// 성능 기준
const PERFORMANCE_THRESHOLDS = {
    PARSE_1MB_RESPONSE: 300,      // 1MB 응답 파싱: 0.3초 이내
    PARSE_10MB_RESPONSE: 3000,    // 10MB 응답 파싱: 3초 이내
    FORMAT_RESPONSE: 500,         // 응답 포맷팅: 0.5초 이내
};

// 대용량 API 응답 생성기
function generateLargeAPIResponse(sizeInMB: number): any {
    const targetSize = sizeInMB * 1024 * 1024;
    const users = [];

    let currentSize = 0;
    let userId = 1;

    while (currentSize < targetSize) {
        const user = {
            id: userId++,
            username: `user${userId}`,
            email: `user${userId}@example.com`,
            profile: {
                firstName: `First${userId}`,
                lastName: `Last${userId}`,
                age: 20 + (userId % 50),
                bio: 'This is a sample bio with some text to increase the response size. '.repeat(10),
                address: {
                    street: `${userId} Main St`,
                    city: 'Sample City',
                    state: 'SC',
                    zipCode: '12345',
                    country: 'USA'
                },
                preferences: {
                    theme: 'dark',
                    notifications: true,
                    language: 'en',
                    timezone: 'UTC'
                }
            },
            posts: Array.from({ length: 5 }, (_, i) => ({
                id: i + 1,
                title: `Post ${i + 1} by user ${userId}`,
                content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5),
                likes: Math.floor(Math.random() * 1000),
                comments: Math.floor(Math.random() * 100)
            })),
            metadata: {
                createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: true,
                roles: ['user', 'reader']
            }
        };

        users.push(user);
        currentSize += JSON.stringify(user).length;
    }

    return {
        status: 'success',
        data: users,
        pagination: {
            total: users.length,
            page: 1,
            perPage: 100,
            totalPages: Math.ceil(users.length / 100)
        },
        metadata: {
            requestId: 'req-12345',
            timestamp: new Date().toISOString(),
            version: '1.0'
        }
    };
}

describe('Performance Benchmarks - Post Tool', () => {
    it('should handle 1MB API response efficiently', () => {
        const response = generateLargeAPIResponse(1);

        const stringifyStart = performance.now();
        const responseString = JSON.stringify(response);
        const stringifyDuration = performance.now() - stringifyStart;

        const parseStart = performance.now();
        const parsed = JSON.parse(responseString);
        const parseDuration = performance.now() - parseStart;

        const sizeInMB = responseString.length / 1024 / 1024;

        console.log(`  📊 1MB Response - Size: ${sizeInMB.toFixed(2)}MB, Parse: ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.PARSE_1MB_RESPONSE);
        expect(parsed.data.length).toBeGreaterThan(0);
    });

    it('should format JSON response efficiently', () => {
        const response = generateLargeAPIResponse(0.5);
        const responseString = JSON.stringify(response);

        const startTime = performance.now();

        // Simulate formatting: pretty print with indentation
        const formatted = JSON.stringify(response, null, 2);

        const duration = performance.now() - startTime;

        console.log(`  📊 Format response: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FORMAT_RESPONSE);
        expect(formatted.includes('\n')).toBe(true);
    });

    it('should handle large array response efficiently', () => {
        const largeArray = Array.from({ length: 10000 }, (_, i) => ({
            id: i + 1,
            value: Math.random() * 1000,
            timestamp: new Date().toISOString(),
            metadata: {
                source: 'api',
                index: i
            }
        }));

        const response = {
            status: 'success',
            data: largeArray,
            count: largeArray.length
        };

        const stringifyStart = performance.now();
        const responseString = JSON.stringify(response);
        const stringifyDuration = performance.now() - stringifyStart;

        const parseStart = performance.now();
        const parsed = JSON.parse(responseString);
        const parseDuration = performance.now() - parseStart;

        const sizeInMB = responseString.length / 1024 / 1024;

        console.log(`  📊 Large Array (10K items, ${sizeInMB.toFixed(2)}MB): Parse ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(500);
        expect(parsed.data.length).toBe(10000);
    });

    it('should extract response headers efficiently', () => {
        const headers = {
            'content-type': 'application/json',
            'content-length': '1048576',
            'date': new Date().toUTCString(),
            'server': 'nginx/1.18.0',
            'x-request-id': 'req-12345',
            'x-response-time': '150ms',
            'cache-control': 'no-cache',
            'access-control-allow-origin': '*'
        };

        const startTime = performance.now();

        // Simulate header processing
        const headerEntries = Object.entries(headers);
        const headerCount = headerEntries.length;
        const contentType = headers['content-type'];

        const duration = performance.now() - startTime;

        console.log(`  📊 Process ${headerCount} headers: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(10); // 0.01초 이내
        expect(contentType).toBe('application/json');
    });

    it('should handle 10MB response (stress test)', () => {
        const response = generateLargeAPIResponse(10);

        const stringifyStart = performance.now();
        const responseString = JSON.stringify(response);
        const stringifyDuration = performance.now() - stringifyStart;

        const parseStart = performance.now();
        const parsed = JSON.parse(responseString);
        const parseDuration = performance.now() - parseStart;

        const sizeInMB = responseString.length / 1024 / 1024;

        console.log(`  📊 10MB Response (Stress) - Size: ${sizeInMB.toFixed(2)}MB, Parse: ${parseDuration.toFixed(2)}ms`);

        expect(parseDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.PARSE_10MB_RESPONSE);
        expect(parsed.data).toBeDefined();
    }, 15000);
});

describe('Performance Benchmarks - Response Viewer', () => {
    it('should search through large response efficiently', () => {
        const response = generateLargeAPIResponse(1);
        const responseString = JSON.stringify(response);
        const searchTerm = 'user';

        const startTime = performance.now();

        // Simulate search: count occurrences
        const regex = new RegExp(searchTerm, 'gi');
        const matches = responseString.match(regex);
        const matchCount = matches ? matches.length : 0;

        const duration = performance.now() - startTime;

        console.log(`  📊 Search in 1MB response: ${duration.toFixed(2)}ms, Found: ${matchCount}`);

        expect(duration).toBeLessThan(200);
        expect(matchCount).toBeGreaterThan(0);
    });

    it('should navigate through search results efficiently', () => {
        const response = generateLargeAPIResponse(0.5);
        const responseString = JSON.stringify(response);
        const searchTerm = 'email';

        const startTime = performance.now();

        // Find all match positions
        const matchPositions: number[] = [];
        let pos = responseString.indexOf(searchTerm);
        while (pos !== -1) {
            matchPositions.push(pos);
            pos = responseString.indexOf(searchTerm, pos + 1);
        }

        const duration = performance.now() - startTime;

        console.log(`  📊 Index search results: ${duration.toFixed(2)}ms, Matches: ${matchPositions.length}`);

        expect(duration).toBeLessThan(300);
        expect(matchPositions.length).toBeGreaterThan(0);
    });

    it('should switch between view modes efficiently', () => {
        const response = generateLargeAPIResponse(0.5);
        const responseString = JSON.stringify(response);

        const startTime = performance.now();

        // Raw view: already have string
        const rawView = responseString;

        // Pretty view: format with indentation
        const prettyView = JSON.stringify(response, null, 2);

        // Preview view: parse and validate
        const previewData = JSON.parse(responseString);

        const duration = performance.now() - startTime;

        console.log(`  📊 Switch view modes: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(500);
        expect(rawView.length).toBeGreaterThan(0);
        expect(prettyView.length).toBeGreaterThan(rawView.length);
        expect(previewData).toBeDefined();
    });
});

describe('Performance Benchmarks - Memory Management', () => {
    it('should not leak memory when handling multiple requests', () => {
        const getMemoryUsage = () => {
            if ((performance as any).memory) {
                return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
            }
            return 0;
        };

        const memBefore = getMemoryUsage();

        // Simulate multiple API requests
        for (let i = 0; i < 10; i++) {
            const response = generateLargeAPIResponse(1);
            const jsonString = JSON.stringify(response);
            const parsed = JSON.parse(jsonString);
            // Allow garbage collection
        }

        const memAfter = getMemoryUsage();
        const memIncrease = memAfter - memBefore;

        console.log(`  📊 Memory after 10 requests: +${memIncrease.toFixed(2)}MB`);

        if (memBefore > 0) {
            // Should not accumulate indefinitely
            expect(memIncrease).toBeLessThan(100); // 100MB 이내
        }
    });
});
