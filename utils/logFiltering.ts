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
export const checkIsMatch = (line: string, rule: LogRule | null, bypassShellFilter: boolean): boolean => {
    // Force include Simulated Logs (for Tizen Connection Test) regardless of rules
    if (bypassShellFilter && line.includes('[TEST_LOG_')) {
        return true;
    }

    if (!rule) return true;

    // "Show Shell/Raw Text Always" Bypass Logic
    // ONLY applied in Stream Mode (SDB/SSH) for shell output visibility.
    // In File Mode, we treat everything as content to be filtered strictly.
    if (bypassShellFilter && rule.showRawLogLines !== false) {

        // Strict Log Detection for Stream Mode
        // We want to detect standard dlogutil formats. Anything else is "Shell Output".
        const isStandardLog = (inputLine: string) => {
            // 1. Timestamp "MM-DD HH:mm:ss" or "HH:mm:ss"
            if (/\d{1,2}:\d{2}:\d{2}/.test(inputLine)) return true;
            // 2. Kernel Float "  123.456"
            if (/^\s*\[?\s*\d+\.\d+\s*\]?/.test(inputLine)) return true;
            // 3. Level/Tag "I/Tag", "W/Tag" (common in some formats)
            if (/^[A-Z]\//.test(inputLine.trim())) return true;

            return false;
        };

        if (!isStandardLog(line)) {
            // It's shell output / raw text -> Force Include
            return true;
        }
        // If it IS a standard log, fall through to normal filtering (Includes/Excludes)
    }

    // 1. Excludes
    const isBlockCaseSensitive = rule.blockListCaseSensitive;
    const excludes = rule.excludes.map(e => e.trim()).filter(e => e !== '');

    if (excludes.length > 0) {
        const lineForBlock = isBlockCaseSensitive ? line : line.toLowerCase();
        const effectiveExcludes = isBlockCaseSensitive ? excludes : excludes.map(e => e.toLowerCase());
        if (effectiveExcludes.some(exc => lineForBlock.includes(exc))) return false;
    }

    // 2. Includes
    const isHappyCaseSensitive = rule.happyCombosCaseSensitive;
    const groups = rule.includeGroups.map(g => g.map(t => t.trim()).filter(t => t !== ''));
    const meaningfulGroups = groups.filter(g => g.length > 0);

    if (meaningfulGroups.length === 0) return true; // No include filters -> Show all

    const lineForHappy = isHappyCaseSensitive ? line : line.toLowerCase();

    return meaningfulGroups.some(group => group.every(term => {
        const effectiveTerm = isHappyCaseSensitive ? term : term.toLowerCase();
        return lineForHappy.includes(effectiveTerm);
    }));
};
