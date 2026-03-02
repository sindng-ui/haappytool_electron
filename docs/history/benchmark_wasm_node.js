import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSync, FilterEngine } from './src/wasm/happy_filter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(__dirname, 'src/wasm/happy_filter_bg.wasm');

async function runBenchmark() {
    console.log('🚀 [Node Benchmark] Starting WASM Filter Benchmark (1,000,000 lines)...');

    // 1. Initialize WASM
    const wasmBuffer = fs.readFileSync(wasmPath);
    initSync(wasmBuffer);

    // 2. Generate Fake Data
    const lineCount = 1000000;
    const fakeLines = [];
    const keywords = ['ERROR', 'Network', 'timeout', 'Success', 'Worker'];
    for (let i = 0; i < lineCount; i++) {
        const kw = keywords[i % keywords.length];
        fakeLines.push(`2026-02-15 12:34:56.789 [Thread-${i % 10}] INFO  com.happytool.Test - Message #${i}: ${kw} occurred in some context.`);
    }

    // 3. Setup Filter
    const engine = new FilterEngine(false);
    engine.update_keywords(['ERROR', 'Network']);

    // 4. Measure Pure Filtering Time (Single Thread)
    // Note: Node environment doesn't have Workers easily set up like Browser in this script,
    // so we measure single-thread performance first as a conservative baseline.
    const startTime = Date.now();
    let matches = 0;

    for (let i = 0; i < lineCount; i++) {
        if (engine.check_match(fakeLines[i])) {
            matches++;
        }
    }

    const duration = Date.now() - startTime;
    console.log('🏁 Benchmark Results:');
    console.log(`  - Lines Processed: ${lineCount.toLocaleString()}`);
    console.log(`  - Matches Found: ${matches.toLocaleString()}`);
    console.log(`  - Total Duration: ${duration}ms`);
    console.log(`  - Throughput: ${(lineCount / (duration / 1000)).toFixed(0)} lines/sec`);
    console.log(`  - Per-line latency: ${(duration / lineCount * 1000).toFixed(3)} μs`);
}

runBenchmark().catch(console.error);
