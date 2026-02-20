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
    // 1. Quick Filters (Highly optimized, minimal overhead)
    if (quickFilter === 'error') {
        const isErrorLevel = line.includes(' E/') || line.includes('ERROR') || line.includes('Error') || line.includes('Fail') || line.includes('FATAL');
        if (!isErrorLevel) return false;
    }

    if (quickFilter === 'exception') {
        if (!line.toLowerCase().includes('exception')) return false;
    }

    // Force include Simulated Logs (for Tizen Connection Test) regardless of rules
    if (bypassShellFilter && line.includes('[TEST_LOG_')) {
        return true;
    }

    if (!rule) return true;

    // 2. Bypass Logic for Stream Mode
    if (bypassShellFilter && rule.showRawLogLines !== false) {
        // Optimized standard log detection (heuristics to distinguish "Logs" from "Shell Output")
        // Goal: If it looks like a log (has timestamp/tag), return FALSE for isStandard so it gets Filtered.
        // If it looks like shell noise (prompt, echo), return TRUE so it Bypasses filters (and is shown).

        const trimmedLine = line.trimStart();

        // Broad heuristic to detect if a line is a genuine System Log vs arbitrary Shell output
        // 1. Time or date structures: 12:34:56.789, 02-20, 2024-02-20, Mmm dd
        const hasTimeOrDate = /(:[0-5]\d)|(\d{2,4}[-/]\d{2}[-/]\d{2})|([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2})/.test(trimmedLine);
        // 2. Log level indicators: I/Tag, D/Tag, [INFO], <5>
        const hasLevel = /\b[VDIWEF]\/|\b(?:INFO|DEBUG|WARN|ERROR|VERBOSE|FATAL)\b|<[0-9]>/i.test(trimmedLine);
        // 3. Brackets at start: common in kernel times [ 1234.56 ] or PIDs [1000:1000]
        const startsWithBracket = trimmedLine.startsWith('[');
        // 4. Typical Tizen/Android PID block: ( 1234) or (1234)
        const hasPid = /\(\s*\d+\s*\)/.test(trimmedLine);
        // 5. Tizen legacy separator feature
        const hasTizenLegacy = trimmedLine.includes(' /');

        const isStandard = hasTimeOrDate || hasLevel || startsWithBracket || hasPid || hasTizenLegacy;

        if (!isStandard) {
            // It does not look like a log. Assume it is a stack trace, shell text, or raw output we want to bypass visually
            return true;
        }
    }

    // 3. Excludes (Block List)
    const excludes = rule.excludes; // Assumed to be normalized by the caller
    if (excludes.length > 0) {
        const isBlockCaseSensitive = rule.blockListCaseSensitive;
        const lineForBlock = isBlockCaseSensitive ? line : line.toLowerCase();
        for (let i = 0; i < excludes.length; i++) {
            if (lineForBlock.includes(excludes[i])) return false;
        }
    }

    // 4. Includes (Happy Combos)
    const groups = rule.includeGroups; // Assumed to be normalized [ [word, word], [word] ]
    if (groups.length === 0) return true;

    // ✅ WASM Path: Only use if no AND logic (all groups have 1 term) for maximum speed
    const isSimpleOrFilter = groups.every(g => g.length === 1);
    if (wasmEngine && isSimpleOrFilter) {
        // Zero-copy 지원 버전 (WASM 메모리에 직접 쓰기)
        if (wasmMemory && textEncoder) {
            const requiredSize = line.length * 3; // Safe UTF-8 upper bound
            wasmEngine.reserve_buffer(requiredSize);

            const ptr = wasmEngine.get_buffer_ptr();
            const view = new Uint8Array(wasmMemory.buffer, ptr, requiredSize);
            const { written } = textEncoder.encodeInto(line, view);

            return wasmEngine.check_match_ptr(written);
        }
        return wasmEngine.check_match(line);
    }

    // JS Fallback: OR of ANDs
    const isHappyCaseSensitive = rule.happyCombosCaseSensitive;
    const lineForHappy = isHappyCaseSensitive ? line : line.toLowerCase();

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        let allTermsInGroupMatch = true;
        for (let j = 0; j < group.length; j++) {
            if (!lineForHappy.includes(group[j])) {
                allTermsInGroupMatch = false;
                break;
            }
        }
        if (allTermsInGroupMatch) return true;
    }

    // DEBUG: Only log if it contains target but failed to match rule groups
    if (line.includes('ST_APP')) {
        console.log('[FilterTrace] ST_APP line REJECTED. Groups:', JSON.stringify(groups));
    }

    return false;
};
