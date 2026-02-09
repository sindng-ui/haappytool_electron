/**
 * Log Archive 대용량 성능 벤치마크
 * 
 * 콘솔에서 다음과 같이 실행:
 * - window.runLargeScaleBenchmark()      // 10,000개 테스트
 * - window.runLargeScaleBenchmark(50000) // 50,000개 테스트
 */

import { db } from './components/LogArchive/db/LogArchiveDB';

interface BenchmarkResult {
    operation: string;
    duration: number;
    memory?: number;
}

async function runLargeScaleBenchmark(itemCount: number = 10000) {
    console.log(`\n=== Log Archive 대용량 벤치마크 (${itemCount.toLocaleString()}개) ===\n`);

    const results: BenchmarkResult[] = [];

    // Memory Helper
    const getMemoryUsage = () => {
        if ((performance as any).memory) {
            return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return undefined;
    };

    // 1. Clear DB
    console.log('1️⃣ DB 초기화...');
    const clearStart = performance.now();
    await db.clearAll();
    const clearDuration = performance.now() - clearStart;
    results.push({ operation: 'Clear DB', duration: clearDuration });
    console.log(`   ✅ ${clearDuration.toFixed(2)}ms\n`);

    // 2. Bulk Insert
    console.log(`2️⃣ ${itemCount.toLocaleString()}개 항목 삽입...`);
    const insertStart = performance.now();
    const memBefore = getMemoryUsage();

    // 청크로 나누어 삽입 (메모리 효율)
    const chunkSize = 1000;
    const chunks = Math.ceil(itemCount / chunkSize);

    for (let chunk = 0; chunk < chunks; chunk++) {
        const items = [];
        const start = chunk * chunkSize;
        const end = Math.min(start + chunkSize, itemCount);

        for (let i = start; i < end; i++) {
            items.push({
                title: `Log Entry ${i}`,
                content: `[${new Date(Date.now() - i * 10000).toISOString()}] This is log content ${i}. ${i % 5 === 0 ? 'ERROR: Network timeout' : i % 3 === 0 ? 'WARNING: Slow response' : 'INFO: Request completed successfully'}`,
                tags: i % 5 === 0 ? ['ERROR', 'NETWORK'] : i % 3 === 0 ? ['WARNING'] : ['INFO', 'SUCCESS'],
                metadata: { folder: i % 10 === 0 ? 'Critical' : i % 5 === 0 ? 'Important' : 'General' },
            });
        }

        await db.archives.bulkAdd(items as any);

        if (chunk % 10 === 0) {
            console.log(`   진행 중... ${((chunk / chunks) * 100).toFixed(1)}%`);
        }
    }

    const insertDuration = performance.now() - insertStart;
    const memAfter = getMemoryUsage();
    results.push({
        operation: `Insert ${itemCount.toLocaleString()} items`,
        duration: insertDuration,
        memory: memAfter && memBefore ? memAfter - memBefore : undefined
    });
    console.log(`   ✅ ${insertDuration.toFixed(2)}ms (${(itemCount / (insertDuration / 1000)).toFixed(0)} items/sec)`);
    if (memAfter && memBefore) {
        console.log(`   📊 메모리 증가: ${(memAfter - memBefore).toFixed(2)}MB\n`);
    }

    // 3. Get All Tags (Optimized)
    console.log('3️⃣ 전체 태그 목록 조회 (최적화)...');
    const tagsStart = performance.now();
    const tags = await db.getAllTags();
    const tagsDuration = performance.now() - tagsStart;
    results.push({ operation: 'Get All Tags', duration: tagsDuration });
    console.log(`   ✅ ${tagsDuration.toFixed(2)}ms (${tags.length}개 태그)\n`);

    // 4. Get All Folders (Optimized)
    console.log('4️⃣ 전체 폴더 목록 조회 (최적화)...');
    const foldersStart = performance.now();
    const folders = await db.getAllFolders();
    const foldersDuration = performance.now() - foldersStart;
    results.push({ operation: 'Get All Folders', duration: foldersDuration });
    console.log(`   ✅ ${foldersDuration.toFixed(2)}ms (${folders.length}개 폴더)\n`);

    // 5. Tag Statistics (Streaming)
    console.log('5️⃣ 태그별 통계 (스트리밍)...');
    const tagStatsStart = performance.now();
    const memBeforeStats = getMemoryUsage();
    const tagStats = await db.getTagStatistics();
    const tagStatsDuration = performance.now() - tagStatsStart;
    const memAfterStats = getMemoryUsage();
    results.push({
        operation: 'Tag Statistics (Streaming)',
        duration: tagStatsDuration,
        memory: memAfterStats && memBeforeStats ? memAfterStats - memBeforeStats : undefined
    });
    console.log(`   ✅ ${tagStatsDuration.toFixed(2)}ms`);
    if (memAfterStats && memBeforeStats) {
        console.log(`   📊 메모리 사용: ${(memAfterStats - memBeforeStats).toFixed(2)}MB (스트리밍)\n`);
    }

    // 6. Folder Statistics (Streaming)
    console.log('6️⃣ 폴더별 통계 (스트리밍)...');
    const folderStatsStart = performance.now();
    const folderStats = await db.getFolderStatistics();
    const folderStatsDuration = performance.now() - folderStatsStart;
    results.push({ operation: 'Folder Statistics (Streaming)', duration: folderStatsDuration });
    console.log(`   ✅ ${folderStatsDuration.toFixed(2)}ms\n`);

    // 7. Simple Search (Text)
    console.log('7️⃣ 텍스트 검색 (\'error\')...');
    const searchStart = performance.now();
    const searchResults = await db.searchArchives({ query: 'error', limit: 50 });
    const searchDuration = performance.now() - searchStart;
    results.push({ operation: 'Text Search (50 results)', duration: searchDuration });
    console.log(`   ✅ ${searchDuration.toFixed(2)}ms (${searchResults.length}개 결과)\n`);

    // 8. Regex Search
    console.log('8️⃣ RegEx 검색 (/error|warning/i)...');
    const regexStart = performance.now();
    const regexResults = await db.searchArchives({ query: 'error|warning', isRegex: true, limit: 50 });
    const regexDuration = performance.now() - regexStart;
    results.push({ operation: 'Regex Search (50 results)', duration: regexDuration });
    console.log(`   ✅ ${regexDuration.toFixed(2)}ms (${regexResults.length}개 결과)\n`);

    // 9. Tag Filter Search
    console.log('9️⃣ 태그 필터 검색 ([ERROR, NETWORK])...');
    const tagFilterStart = performance.now();
    const tagFilterResults = await db.searchArchives({ tags: ['ERROR', 'NETWORK'], limit: 50 });
    const tagFilterDuration = performance.now() - tagFilterStart;
    results.push({ operation: 'Tag Filter Search', duration: tagFilterDuration });
    console.log(`   ✅ ${tagFilterDuration.toFixed(2)}ms (${tagFilterResults.length}개 결과)\n`);

    // 10. Get Archive Count
    console.log('🔟 전체 개수 조회...');
    const countStart = performance.now();
    const totalCount = await db.archives.count();
    const countDuration = performance.now() - countStart;
    results.push({ operation: 'Get Total Count', duration: countDuration });
    console.log(`   ✅ ${countDuration.toFixed(2)}ms (총 ${totalCount.toLocaleString()}개)\n`);

    // Summary
    console.log('\n📊 === 벤치마크 결과 요약 ===\n');
    console.table(results.map(r => ({
        '작업': r.operation,
        '소요 시간 (ms)': r.duration.toFixed(2),
        '메모리 (MB)': r.memory ? r.memory.toFixed(2) : '-'
    })));

    // Performance Verdict
    console.log('\n🎯 === 성능 평가 ===\n');
    const avgSearchTime = (searchDuration + regexDuration + tagFilterDuration) / 3;

    if (avgSearchTime < 100) {
        console.log('✅ 우수: 검색 성능이 매우 빠릅니다. (평균 <100ms)');
    } else if (avgSearchTime < 500) {
        console.log('⚠️  양호: 검색 성능이 적절합니다. (평균 100-500ms)');
    } else {
        console.log('❌ 개선 필요: 검색 성능이 느립니다. (평균 >500ms)');
    }

    if (tagStatsDuration < itemCount / 10) {
        console.log('✅ 우수: 통계 처리가 효율적입니다.');
    } else {
        console.log('⚠️  개선 필요: 통계 처리 성능 향상이 필요합니다.');
    }

    console.log('\n=== 벤치마크 완료 ===\n');
}

// Export to window
if (typeof window !== 'undefined') {
    (window as any).runLargeScaleBenchmark = runLargeScaleBenchmark;
    console.log('✅ 대용량 벤치마크 로드 완료.');
    console.log('   실행: runLargeScaleBenchmark(10000)  // 10,000개');
    console.log('   실행: runLargeScaleBenchmark(50000)  // 50,000개');
}

export { runLargeScaleBenchmark };
