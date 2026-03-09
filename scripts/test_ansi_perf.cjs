
// ANSI Filtering Performance Benchmark (CJS version) 🐧🏁
// Run with: node scripts/test_ansi_perf.cjs

const ANSI_REGEX = /\x1B\[[0-9;]*[a-zA-Z]/g;
const NUM_LINES = 2000000; // 200만 줄 대상으로 테스트
const KEYWORD = 'CRITICAL_ERROR_123';

function generateLogs(withAnsi) {
    const lines = [];
    const ansiStyles = [
        '\x1B[31m', '\x1B[32m', '\x1B[33m', '\x1B[34m', '\x1B[35m', '\x1B[36m',
        '\x1B[1m', '\x1B[4m', '\x1B[42m', '\x1B[41m', '\x1B[100m'
    ];
    const ansiReset = '\x1B[0m';

    for (let i = 0; i < NUM_LINES; i++) {
        const isMatch = (i % 1000 === 0);
        const msg = isMatch ? KEYWORD : 'Normal log entry with various data fields and timestamps';

        if (withAnsi) {
            const s1 = ansiStyles[i % ansiStyles.length];
            const s2 = ansiStyles[(i + 1) % ansiStyles.length];
            lines.push(`${s1}[2026-03-07 01:25:00]${ansiReset} ${s2}[DEB]${ansiReset} Process(${i % 1000}): ${s1}${msg}${ansiReset} ${s2}(module.cpp:${i % 100})${ansiReset}`);
        } else {
            lines.push(`[2026-03-07 01:25:00] [DEB] Process(${i % 1000}): ${msg} (module.cpp:${i % 100})`);
        }
    }
    return lines;
}

function benchA_FilteringWithOnTheFlyStrip(lines) {
    let matches = 0;
    const start = Date.now();
    for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].replace(ANSI_REGEX, '');
        if (cleanLine.includes(KEYWORD)) {
            matches++;
        }
    }
    return Date.now() - start;
}

function benchB_FilteringCleanText(lines) {
    let matches = 0;
    const start = Date.now();
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(KEYWORD)) {
            matches++;
        }
    }
    return Date.now() - start;
}

function benchC_FilteringWithAnsiIncluded(lines) {
    let matches = 0;
    const start = Date.now();
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(KEYWORD)) {
            matches++;
        }
    }
    return Date.now() - start;
}

console.log(`\n--- ANSI Filtering Benchmark (${NUM_LINES.toLocaleString()} lines) ---`);

const ansiLines = generateLogs(true);
const cleanLines = generateLogs(false);

console.log('\n[Phase 1: Warmup]');
benchB_FilteringCleanText(cleanLines);
benchC_FilteringWithAnsiIncluded(ansiLines);

console.log('\n[Phase 2: Actual Benchmark]');

const tBefore = benchC_FilteringWithAnsiIncluded(ansiLines);
console.log(`1. 수정 전 (ANSI 포함 상태로 매칭): ${tBefore}ms`);

const tAfter = benchB_FilteringCleanText(cleanLines);
console.log(`2. 수정 후 (로딩 시 제거된 상태로 매칭): ${tAfter}ms`);

const tEveryTime = benchA_FilteringWithOnTheFlyStrip(ansiLines);
console.log(`3. 매칭 시마다 제거 (참조용): ${tEveryTime}ms`);

console.log('\n--- Result ---');
const diff = tBefore - tAfter;
const improvement = ((diff / tBefore) * 100).toFixed(1);

console.log(`형님, 로딩 시 미리 제거해두면 필터링 시 ${diff}ms 아낄 수 있습니다! (${improvement}% 성능 향상) 🚀`);
console.log(`만약 매칭할 때마다 정규식을 돌리면 무려 ${tEveryTime}ms나 걸리니, 로딩 시 제거가 정답입니다. 🐧💎`);
