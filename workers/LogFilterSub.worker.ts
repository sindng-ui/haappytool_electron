/* eslint-disable no-restricted-globals */
import { LogRule } from '../types';
import { checkIsMatch } from '../utils/logFiltering';

const ctx: Worker = self as any;

let wasmEngine: any = null;
let wasmMemory: WebAssembly.Memory | null = null;
const textEncoder = new TextEncoder();

const initWasm = async () => {
    try {
        const wasm = await import('../src/wasm/happy_filter');
        const instance = await wasm.default();
        wasmMemory = (instance as any).memory;
        wasmEngine = new wasm.FilterEngine(false);
    } catch (e) {
        console.error('[SubWorker] WASM init failed', e);
    }
};

initWasm();

ctx.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'FILTER_CHUNK') {
        const { blob, rule, quickFilter, chunkId } = payload;

        // WASM 엔진 키워드 동기화
        if (wasmEngine) {
            const allKeywords = (rule.includeGroups as string[][]).flat().map(t => t.trim()).filter(t => t !== '');
            wasmEngine.update_keywords(allKeywords);
        }

        const reader = (blob as Blob).stream().getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let relativeLineIndex = 0;
        const matches: number[] = [];

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
                        matches.push(relativeLineIndex);
                    }
                    relativeLineIndex++;
                }
            }
            if (buffer) {
                if (checkIsMatch(buffer, rule, false, quickFilter, wasmEngine, wasmMemory || undefined, textEncoder)) {
                    matches.push(relativeLineIndex);
                }
                relativeLineIndex++;
            }
        } catch (err) {
            console.error(`[SubWorker ${chunkId}] Error`, err);
        }

        ctx.postMessage({
            type: 'CHUNK_COMPLETE',
            payload: {
                chunkId,
                matches,
                lineCount: relativeLineIndex
            }
        });
    }
};
