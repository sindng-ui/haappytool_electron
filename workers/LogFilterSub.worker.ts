/* eslint-disable no-restricted-globals */
import { LogRule } from '../types';
import { checkIsMatch } from '../utils/logFiltering';

const ctx: Worker = self as any;

// --- WASM Filter Engine ---
import initWasmModule, { FilterEngine } from '../public/wasm/happy_filter.js';
import wasmUrl from '../public/wasm/happy_filter_bg.wasm?url';

let wasmEngine: any = null;
let wasmMemory: WebAssembly.Memory | null = null;
let wasmModule: any = { FilterEngine }; // Store reference

const initWasm = async () => {
    try {
        console.log('[SubWorker] Initializing WASM Filter Engine (Bundled)...');
        console.log('[SubWorker] wasmUrl:', wasmUrl);
        const instance = await initWasmModule(wasmUrl);
        wasmMemory = (instance as any).memory;
        wasmEngine = new FilterEngine(false);

        // --- WASM & JIT Warmup (Cold Start Optimization) ---
        // V8 엔진(TurboFan)과 WASM 브릿지를 초기 필터링 전에 최적화 상태로 예열합니다.
        try {
            const dummyRule = { excludes: [], includeGroups: [['___warmup___']], happyCombosCaseSensitive: false, showRawLogLines: true };
            wasmEngine.update_keywords(['___warmup___']);
            const dummyLine = "01-01 12:00:00.000  1000  1000 I WARMUP  : Warmup V8 JIT and WASM Bridge for fast first filter";
            // ✅ 효율적 예열: 무조건 5만 번 도는 대신, 최대 10ms 이내에서만 JIT 최적화를 유도하여 불필요한 CPU 낭비 방지
            const startTime = performance.now();
            let iterations = 0;
            while (performance.now() - startTime < 10 && iterations < 15000) {
                checkIsMatch(dummyLine, dummyRule as any, false, 'none', wasmEngine, wasmMemory, textEncoder);
                iterations++;
            }
            console.log(`[SubWorker] JIT warmed up with ${iterations} iterations in ${(performance.now() - startTime).toFixed(1)}ms`);
        } catch (warmupErr) {
            console.warn('[SubWorker] JIT warmup failed:', warmupErr);
        }

        console.log('[SubWorker] WASM Filter Engine initialized and JIT warmed up successfully');
    } catch (e) {
        console.warn('[SubWorker] WASM init failed, using JS fallback', e);
    }
};

const textEncoder = new TextEncoder();

const wasmInitPromise = initWasm();

ctx.onmessage = async (e) => {
    await wasmInitPromise; // 🚨 WASM 준비 전 처리 시 JS Fallback(5.5s)로 빠지는 문제 핵심 수정!

    const { type, payload } = e.data;

    if (type === 'FILTER_CHUNK') {
        const { blob, buffer, rule, quickFilter, chunkId, offset = 0, requestId } = payload;
        const startTime = Date.now();
        console.log(`[SubWorker ${chunkId}] FILTER_CHUNK Start (RequestID: ${requestId})`);

        // WASM 엔진 키워드 동기화
        if (wasmEngine && wasmModule) {
            const isCaseSensitive = !!rule.happyCombosCaseSensitive;
            wasmEngine = new wasmModule.FilterEngine(isCaseSensitive);

            // ✅ Optimization: Use already normalized keywords from main worker
            const allKeywords = (rule.includeGroups as string[][]).flat();
            wasmEngine.update_keywords(allKeywords);
        }

        let relativeLineIndex = 0;
        const matchesList: number[] = [];

        try {
            if (blob) {
                const reader = (blob as Blob).stream().getReader();
                const decoder = new TextDecoder();
                let textBuf = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkText = decoder.decode(value, { stream: true });
                    textBuf += chunkText;
                    const lines = textBuf.split('\n');
                    textBuf = lines.pop() || '';

                    for (const line of lines) {
                        // Strip ANSI and CR
                        // eslint-disable-next-line no-control-regex
                        const cleanLine = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r$/, '');
                        if (checkIsMatch(cleanLine, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                            matchesList.push(offset + relativeLineIndex);
                        }
                        relativeLineIndex++;
                    }
                }
                if (textBuf) {
                    if (checkIsMatch(textBuf, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                        matchesList.push(offset + relativeLineIndex);
                    }
                    relativeLineIndex++;
                }
            } else if (buffer) {
                const decoder = new TextDecoder();
                const textBuf = decoder.decode(buffer);
                const lines = textBuf.split('\n');

                // If it ends exactly with \n, the last element is an empty string we should ignore.
                if (textBuf.endsWith('\n')) lines.pop();

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // Strip ANSI and CR (Windows log format compat)
                    // eslint-disable-next-line no-control-regex
                    const cleanLine = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r$/, '');

                    if (checkIsMatch(cleanLine, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                        matchesList.push(offset + relativeLineIndex);
                    }
                    relativeLineIndex++;
                }
            }
        } catch (err) {
            console.error(`[SubWorker ${chunkId}] Error`, err);
        }

        console.log(`[SubWorker ${chunkId}] FILTER_CHUNK Done (RequestID: ${requestId}) matches: ${matchesList.length} time: ${Date.now() - startTime}ms`);

        // ✅ Optimization: Use Int32Array for Zero-copy transfer to main worker
        const matches = new Int32Array(matchesList);
        ctx.postMessage({
            type: 'CHUNK_COMPLETE',
            payload: {
                chunkId,
                matches,
                lineCount: relativeLineIndex,
                requestId // ✅ Return requestId
            }
        }, [matches.buffer] as any);
    } else if (type === 'FILTER_LINES') {
        const { lines, rule, quickFilter, chunkId, offset, requestId } = payload;
        const startTime = Date.now();
        console.log(`[SubWorker ${chunkId}] FILTER_LINES Start (RequestID: ${requestId}) lines: ${lines.length}`);

        // WASM 엔진 키워드 동기화
        if (wasmEngine && wasmModule) {
            const isCaseSensitive = !!rule.happyCombosCaseSensitive;
            wasmEngine = new wasmModule.FilterEngine(isCaseSensitive);
            const allKeywords = (rule.includeGroups as string[][]).flat();
            wasmEngine.update_keywords(allKeywords);
        }

        const matchesList: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (checkIsMatch(lines[i], rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                matchesList.push(offset + i);
            }
        }

        console.log(`[SubWorker ${chunkId}] FILTER_LINES Done (RequestID: ${requestId}) matches: ${matchesList.length} time: ${Date.now() - startTime}ms`);

        const matches = new Int32Array(matchesList);
        ctx.postMessage({
            type: 'FILTER_LINES_COMPLETE',
            payload: {
                chunkId,
                matches,
                lineCount: lines.length,
                requestId // ✅ Return requestId
            }
        }, [matches.buffer] as any);
    }
};
