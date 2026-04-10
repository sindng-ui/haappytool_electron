
const { checkIsMatch } = require('../utils/logFiltering');

// Mock objects for checkIsMatch
const mockWasmEngine = null;
const mockWasmMemory = null;
const mockTextEncoder = new TextEncoder();

const ANSI_RED = '\x1B[31m';
const ANSI_RESET = '\x1B[0m';
const NUM_LINES = 100000;
const KEYWORD = 'CRITICAL';

function generateLogs(withAnsi) {
    const lines = [];
    for (let i = 0; i < NUM_LINES; i++) {
        const msg = i % 100 === 0 ? KEYWORD : 'Some normal log message with some data';
        if (withAnsi) {
            lines.push(`${ANSI_RED}[ERROR]${ANSI_RESET} ${msg} ${ANSI_RED}at line ${i}${ANSI_RESET}`);
        } else {
            lines.push(`[ERROR] ${msg} at line ${i}`);
        }
    }
    return lines;
}

function runBenchmark(lines, label, rule) {
    const start = Date.now();
    let matches = 0;
    for (const line of lines) {
        if (checkIsMatch(line, rule, false, 'none', mockWasmEngine, mockWasmMemory, mockTextEncoder)) {
            matches++;
        }
    }
    const end = Date.now();
    console.log(`[${label}] Total lines: ${lines.length}, Matches: ${matches}, Time: ${end - start}ms`);
    return end - start;
}

const rule = {
    includeGroups: [[KEYWORD]],
    excludes: [],
    happyCombosCaseSensitive: false,
    showRawLogLines: true
};

console.log('--- ANSI Filtering Benchmark ---');
const ansiLines = generateLogs(true);
const cleanLines = generateLogs(false);

// Warmup
runBenchmark(ansiLines, 'Warmup ANSI', rule);
runBenchmark(cleanLines, 'Warmup Clean', rule);

const t1 = runBenchmark(ansiLines, 'Filtering WITH ANSI', rule);
const t2 = runBenchmark(cleanLines, 'Filtering WITHOUT ANSI (Clean)', rule);

console.log(`\nPerformance Improvement: ${((t1 - t2) / t1 * 100).toFixed(2)}%`);
if (t2 < t1) {
    console.log('Clean text is faster as expected! 🚀');
} else {
    console.log('Surprising: No significant difference found.');
}
