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

        const hasTimeColon = line.indexOf(':') > -1;

        // Supported Formats:
        // 1. Tizen/Android: "MM-DD HH:MM:SS" or "Time Only" -> line[2]==':' or line[4]=='-' or line[2]=='-'
        // 2. Linux Syslog: "Feb 20 13:00:00" -> Starts with Mmm (line[3]==' ') AND has time
        // 3. Brackets: "[2024...]" -> line[0]=='['
        // 4. ISO8601: "2024-02..." -> line[4]=='-'

        const isStandard =
            line.includes(' /') || // Tizen Tag/Label separator
            (line.length > 10 && (
                line[2] === ':' ||  // "HH:MM:SS"
                line[2] === '-' ||  // "MM-DD"
                line[4] === '-' ||  // "YYYY-MM-DD"
                line[0] === '[' ||  // "[TIMESTAMP]"
                (line[3] === ' ' && hasTimeColon) // "Mmm DD HH:MM:SS" (Basic check: 3rd char space + contains colon)
            ));

        if (!isStandard) {
            // DEBUG: Only log if it contains target keyword but bypassed
            if (line.includes('ST_APP')) console.log('[FilterTrace] Bypassing ST_APP line (Non-Standard):', line.substring(0, 100));
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
