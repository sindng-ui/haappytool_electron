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
        const { blob, rule, quickFilter, chunkId } = payload;

        // WASM 엔진 키워드 동기화
        if (wasmEngine && wasmModule) {
            const isCaseSensitive = !!rule.happyCombosCaseSensitive;
            wasmEngine = new wasmModule.FilterEngine(isCaseSensitive);

            // ✅ Optimization: Use already normalized keywords from main worker
            const allKeywords = (rule.includeGroups as string[][]).flat();
            wasmEngine.update_keywords(allKeywords);
        }

        const reader = (blob as Blob).stream().getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let relativeLineIndex = 0;
        const matchesList: number[] = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                buffer += chunkText;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (checkIsMatch(line, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                        matchesList.push(relativeLineIndex);
                    }
                    relativeLineIndex++;
                }
            }
            if (buffer) {
                if (checkIsMatch(buffer, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                    matchesList.push(relativeLineIndex);
                }
                relativeLineIndex++;
            }
        } catch (err) {
            console.error(`[SubWorker ${chunkId}] Error`, err);
        }

        // ✅ Optimization: Use Int32Array for Zero-copy transfer to main worker
        const matches = new Int32Array(matchesList);
        ctx.postMessage({
            type: 'CHUNK_COMPLETE',
            payload: {
                chunkId,
                matches,
                lineCount: relativeLineIndex
            }
        }, [matches.buffer] as any);
    }
};
