/* eslint-disable no-restricted-globals */
import { LogRule } from '../types';
import { checkIsMatch } from '../utils/logFiltering';

const ctx: Worker = self as any;

let wasmEngine: any = null;
let wasmMemory: WebAssembly.Memory | null = null;
const textEncoder = new TextEncoder();

// Initialize WASM Engine (Vite handles the loading)
// Initialize WASM Engine (Vite handles the loading)
let wasmModule: any = null;
const initWasm = async () => {
    try {
        // public/wasm에서 WASM 로드
        const wasmPath = `${self.location.origin}/wasm/happy_filter.js`;
        // @ts-ignore
        const wasm = await import(/* @vite-ignore */ wasmPath);
        wasmModule = wasm;
        const instance = await wasm.default();
        wasmMemory = (instance as any).memory;
        wasmEngine = new wasm.FilterEngine(false);
        console.log('[SubWorker] WASM Filter Engine initialized');
    } catch (e) {
        console.error('[SubWorker] WASM init failed, using JS fallback', e);
    }
};

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
                const text = decoder.decode(buffer).replace(/\r?\n$/, '');
                const lines = text.split('\n');
                for (const line of lines) {
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
