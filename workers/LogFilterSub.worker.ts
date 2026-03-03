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
        console.log('[SubWorker] WASM Filter Engine initialized successfully');
    } catch (e) {
        console.warn('[SubWorker] WASM init failed, using JS fallback', e);
    }
};

const textEncoder = new TextEncoder();

initWasm();

ctx.onmessage = async (e) => {
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
                        if (checkIsMatch(line, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
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
                let start = 0;
                let next;
                // ✅ Optimization: uint8View.indexOf(10) is much faster than string split for large chunks
                while ((next = buffer.indexOf(10, start)) !== -1) {
                    const hasCr = next > start && buffer[next - 1] === 13; // 바이트 레벨 체크로 정규식 대체
                    const lineBytes = buffer.subarray(start, hasCr ? next - 1 : next);
                    const line = decoder.decode(lineBytes); // 이제 정규식 replace가 없으므로 더 빠름
                    if (checkIsMatch(line, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                        matchesList.push(offset + relativeLineIndex);
                    }
                    relativeLineIndex++;
                    start = next + 1;
                }
                // Handle the last segment if it doesn't end with a newline
                if (start < buffer.length) {
                    const len = buffer.length;
                    const hasCr = len > start && buffer[len - 1] === 13;
                    const lineBytes = buffer.subarray(start, hasCr ? len - 1 : len);
                    const line = decoder.decode(lineBytes);
                    if (checkIsMatch(line, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
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
