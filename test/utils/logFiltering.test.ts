
import { describe, it, expect } from 'vitest';
import { checkIsMatch } from '../../utils/logFiltering';
import { LogRule } from '../../types';

describe('checkIsMatch (Log Filtering Logic)', () => {

    const baseRule: LogRule = {
        id: 'test-rule',
        name: 'Test Rule',
        includeGroups: [],
        excludes: [],
        highlights: [],
        happyCombosCaseSensitive: false,
        blockListCaseSensitive: false
    };

    it('should allow everything if rule is null', () => {
        expect(checkIsMatch('Some Log', null, false)).toBe(true);
    });

    it('should allow everything if rule is empty', () => {
        expect(checkIsMatch('Some Log', baseRule, false)).toBe(true);
    });

    describe('Quick Filters', () => {
        it('should filter only ERRORs when quickFilter is error', () => {
            console.log('Testing Quick Filter: ERROR');
            expect(checkIsMatch('[INFO] Hello', null, false, 'error')).toBe(false);
            expect(checkIsMatch('[ERROR] Fail', null, false, 'error')).toBe(true);
            expect(checkIsMatch('Fatal Error occurred', null, false, 'error')).toBe(true);
            const res = checkIsMatch(' E/ Some Error', null, false, 'error');
            console.log('Result for " E/ Some Error":', res);
            expect(res).toBe(true);
        });

        it('should filter only EXCEPTIONs when quickFilter is exception', () => {
            console.log('Testing Quick Filter: EXCEPTION');
            // Case insensitive check based on implementation
            expect(checkIsMatch('NullPointerException', null, false, 'exception')).toBe(true);
            expect(checkIsMatch('System error', null, false, 'exception')).toBe(false);
            expect(checkIsMatch('Unhandled Exception', null, false, 'exception')).toBe(true);
        });
    });

    describe('Block List (Excludes)', () => {
        it('should block logs containing excluded keywords', () => {
            const rule: LogRule = { ...baseRule, excludes: ['bad', 'ignore'] };
            expect(checkIsMatch('This is a good log', rule, false)).toBe(true);
            expect(checkIsMatch('This is a bad log', rule, false)).toBe(false);
            expect(checkIsMatch('Please ignore this', rule, false)).toBe(false);
        });

        it('should be case insensitive by default', () => {
            const rule: LogRule = { ...baseRule, excludes: ['bad'] };
            expect(checkIsMatch('This is a BAD log', rule, false)).toBe(false);
        });

        it('should respect case sensitivity setting', () => {
            const rule: LogRule = { ...baseRule, excludes: ['bad'], blockListCaseSensitive: true };
            expect(checkIsMatch('This is a BAD log', rule, false)).toBe(true); // Should pass (case mismatch)
            expect(checkIsMatch('This is a bad log', rule, false)).toBe(false); // Should block (exact match)
        });
    });

    describe('Happy Combos (Include Groups)', () => {
        it('should match if ANY group matches (OR logic)', () => {
            const rule: LogRule = {
                ...baseRule,
                includeGroups: [['apple'], ['banana']]
            };
            expect(checkIsMatch('I like apple', rule, false)).toBe(true);
            expect(checkIsMatch('I like banana', rule, false)).toBe(true);
            expect(checkIsMatch('I like cherry', rule, false)).toBe(false);
        });

        it('should match only if ALL terms in a group match (AND logic)', () => {
            const rule: LogRule = {
                ...baseRule,
                includeGroups: [['apple', 'pie']]
            };
            expect(checkIsMatch('apple pie is good', rule, false)).toBe(true);
            expect(checkIsMatch('apple tart', rule, false)).toBe(false);
            expect(checkIsMatch('cherry pie', rule, false)).toBe(false);
        });

        it('should return true if groups are empty (Allow All)', () => {
            const rule: LogRule = { ...baseRule, includeGroups: [] };
            expect(checkIsMatch('anything', rule, false)).toBe(true);
        });

        it('should be case insensitive by default', () => {
            // checkIsMatch expects NORMALIZED rules (lowercase keywords if case-insensitive)
            const rule: LogRule = { ...baseRule, includeGroups: [['apple']] };
            expect(checkIsMatch('i have an Apple', rule, false)).toBe(true);
        });

        it('should respect case sensitivity setting', () => {
            // For case-sensitive, we pass original case
            const rule: LogRule = { ...baseRule, includeGroups: [['Apple']], happyCombosCaseSensitive: true };
            expect(checkIsMatch('i have an apple', rule, false)).toBe(false);
            expect(checkIsMatch('i have an Apple', rule, false)).toBe(true);
        });
    });

    describe('Mixed Logic', () => {
        it('should block excluded items even if they match happy combos', () => {
            const rule: LogRule = {
                ...baseRule,
                includeGroups: [['apple']],
                excludes: ['worm']
            };
            expect(checkIsMatch('apple', rule, false)).toBe(true);
            expect(checkIsMatch('apple with worm', rule, false)).toBe(false);
        });
    });

    describe('Bypass (Standard Log Heuristics)', () => {
        it('should identify Tizen/Android standard logs and always include if bypass is on', () => {
            const rule: LogRule = { ...baseRule, excludes: ['ERROR'] };

            // Heuristic patterns: Time at start, Level in middle
            const tizenLog = '02-16 10:11:12.123 1234 1234 I/TAG: message';
            const androidLog = '[2024-02-16 10:11:12.123] 1234 1234 E TAG: message';
            const dltStyle = '12:34:56.789 123 4567 INFO message';

            expect(checkIsMatch(tizenLog, rule, true)).toBe(true);
            expect(checkIsMatch(androidLog, rule, true)).toBe(true);
            expect(checkIsMatch(dltStyle, rule, true)).toBe(true);
        });

        it('should bypass (always include) shell-like output or plain text', () => {
            const rule: LogRule = { ...baseRule, includeGroups: [['IMPORTANT']] };

            const shellRes = 'cat /proc/cpuinfo';
            const plainText = 'This text has nothing special in it';

            // Non-standard logs are bypassed (included) so users don't miss command output
            expect(checkIsMatch(shellRes, rule, true)).toBe(true);
            expect(checkIsMatch(plainText, rule, true)).toBe(true);
        });

        it('should NOT bypass standard logs even if bypass is on (must match rules)', () => {
            const rule: LogRule = { ...baseRule, includeGroups: [['IMPORTANT']] };
            const standardLog = '02-16 10:11:12.123 1234 1234 I/TAG: Not important log';

            // Standard logs are NOT bypassed; they must match includeGroups
            expect(checkIsMatch(standardLog, rule, true)).toBe(false);
        });
    });

    describe('Regression & Consistency', () => {
        it('should treat empty includeGroups as "Allow All"', () => {
            expect(checkIsMatch('anything', { ...baseRule, includeGroups: [] }, false)).toBe(true);
        });

        it('should handle special characters in keywords correctly', () => {
            // keywords should be lowercase for Case-Insensitive test
            // keywords are in separate groups to test OR logic
            const rule: LogRule = { ...baseRule, includeGroups: [['(error)'], ['[critical]']], happyCombosCaseSensitive: false };
            expect(checkIsMatch('System (ERROR) happened', rule, false)).toBe(true);
            expect(checkIsMatch('Status: [CRITICAL]', rule, false)).toBe(true);
        });

        it('should maintain consistency between different check paths', () => {
            const rule: LogRule = { ...baseRule, includeGroups: [['error']], happyCombosCaseSensitive: false };
            const line = '[ERROR] System failure';

            // Whether bypass is on or off, fundamental match should work
            expect(checkIsMatch(line, rule, false)).toBe(true);
            expect(checkIsMatch(line, rule, true)).toBe(true);
        });
    });
});
