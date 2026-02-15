import { LogRule } from '../types';

/**
 * Log Filtering Logic
 * 
 * Extracted from workers/LogProcessor.worker.ts for testability and reusability.
 * This module contains the core logic for determining if a log line matches filtering rules.
 */

/**
 * Check if a log line matches the given filtering rule
 * 
 * @param line - The log line to check
 * @param rule - The filtering rule to apply (or null for no filtering)
 * @param bypassShellFilter - Whether to apply shell output bypass logic (Force Include non-standard logs)
 * @returns true if the line should be included, false if it should be filtered out
 */
export const checkIsMatch = (line: string, rule: LogRule | null, bypassShellFilter: boolean, quickFilter?: 'none' | 'error' | 'exception', wasmEngine?: any, wasmMemory?: WebAssembly.Memory, textEncoder?: TextEncoder): boolean => {
    // Lazy Lowercasing
    let lowerLine: string | undefined;
    const getLower = () => lowerLine ?? (lowerLine = line.toLowerCase());

    // Quick Filter: Error (Level E)
    if (quickFilter === 'error') {
        const isErrorLevel = line.includes(' E/') || line.includes('ERROR') || line.includes('Error') || line.includes('Fail') || line.includes('FATAL');
        if (!isErrorLevel) return false;
    }

    // Quick Filter: Exception (Text match)
    if (quickFilter === 'exception') {
        const isException = getLower().includes('exception');
        if (!isException) return false;
    }
    // Force include Simulated Logs (for Tizen Connection Test) regardless of rules
    if (bypassShellFilter && line.includes('[TEST_LOG_')) {
        return true;
    }

    if (!rule) return true;

    // "Show Shell/Raw Text Always" Bypass Logic
    if (bypassShellFilter && rule.showRawLogLines !== false) {
        // Strict Log Detection for Stream Mode
        const isStandardLog = (inputLine: string) => {
            if (/\d{1,2}:\d{2}:\d{2}/.test(inputLine)) return true;
            if (/^\s*\[?\s*\d+\.\d+\s*\]?/.test(inputLine)) return true;
            if (/^[A-Z]\//.test(inputLine.trim())) return true;
            return false;
        };

        if (!isStandardLog(line)) {
            return true;
        }
    }

    // 1. Excludes
    const isBlockCaseSensitive = rule.blockListCaseSensitive;
    const excludes = rule.excludes.map(e => e.trim()).filter(e => e !== '');

    if (excludes.length > 0) {
        const lineForBlock = isBlockCaseSensitive ? line : getLower();
        const effectiveExcludes = isBlockCaseSensitive ? excludes : excludes.map(e => e.toLowerCase());
        if (effectiveExcludes.some(exc => lineForBlock.includes(exc))) return false;
    }

    // 2. Includes
    const isHappyCaseSensitive = rule.happyCombosCaseSensitive;
    const groups = rule.includeGroups.map(g => g.map(t => t.trim()).filter(t => t !== ''));
    const meaningfulGroups = groups.filter(g => g.length > 0);

    if (meaningfulGroups.length === 0) return true; // No include filters -> Show all

    // ✅ WASM Path: Only use if no AND logic (all groups have 1 term) for maximum speed
    const isSimpleOrFilter = meaningfulGroups.every(g => g.length === 1);
    if (wasmEngine && isSimpleOrFilter) {
        // Zero-copy 지원 버전 (WASM 메모리에 직접 쓰기)
        if (wasmMemory && textEncoder) {
            // 한글 등 멀티바이트 고려하여 안전하게 3배 용량 할당
            const requiredSize = line.length * 3;
            wasmEngine.reserve_buffer(requiredSize);

            const ptr = wasmEngine.get_buffer_ptr();
            const view = new Uint8Array(wasmMemory.buffer, ptr, requiredSize);
            const { written } = textEncoder.encodeInto(line, view);

            return wasmEngine.check_match_ptr(written);
        }

        // Fallback: 기존 WASM 방식
        return wasmEngine.check_match(line);
    }

    const lineForHappy = isHappyCaseSensitive ? line : getLower();

    return meaningfulGroups.some(group => group.every(term => {
        const effectiveTerm = isHappyCaseSensitive ? term : term.toLowerCase();
        return lineForHappy.includes(effectiveTerm);
    }));
};
