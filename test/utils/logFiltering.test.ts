
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

    describe('Bypass Logic', () => {
        it('should always include [TEST_LOG_] if bypass is on', () => {
            const rule: LogRule = { ...baseRule, excludes: ['TEST'] };
            // Even if excluded or not matching includes, it should pass
            expect(checkIsMatch('[TEST_LOG_START]', rule, true)).toBe(true);
        });
    });

});
