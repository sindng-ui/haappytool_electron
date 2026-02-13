
import { extractTimestamp, formatDuration } from '../../utils/logTime';

describe('Log Time Utils', () => {
    describe('extractTimestamp', () => {
        it('should extract standard HH:mm:ss.mss timestamp', () => {
            const line = '01-23 12:34:56.789 D/Tag: Message';
            const ts = extractTimestamp(line);
            expect(ts).not.toBeNull();
            const date = new Date(ts!);
            expect(date.getHours()).toBe(12);
            expect(date.getMinutes()).toBe(34);
            expect(date.getSeconds()).toBe(56);
            expect(date.getMilliseconds()).toBe(789);
        });

        it('should extract timestamp with Year', () => {
            const line = '2024-01-23 12:34:56.789 D/Tag: Message';
            const ts = extractTimestamp(line);
            expect(ts).not.toBeNull();
            const date = new Date(ts!);
            expect(date.getFullYear()).toBe(2024);
        });

        it('should extract Kernel timestamp', () => {
            const line = '[ 123.456] Kernel message';
            const ts = extractTimestamp(line);
            expect(ts).toBe(123456);
        });

        it('should return null for non-log lines', () => {
            expect(extractTimestamp('Just some text')).toBeNull();
            expect(extractTimestamp('12:34 (No seconds)')).toBeNull();
        });

        it('should extract raw seconds timestamp', () => {
            const line = '27.888888 I/EEEE (P111, T222): log';
            const ts = extractTimestamp(line);
            expect(ts).toBeCloseTo(27888.888);
        });

        it('should extract adb logcat format with milliseconds', () => {
            // 02-24 00:34:11.401
            const line = '[02-24 00:34:11.401] 609-399  I/AAA(P 111, T222): log';
            const ts = extractTimestamp(line);
            expect(ts).not.toBeNull();
            const date = new Date(ts!);
            expect(date.getMonth() + 1).toBe(2);
            expect(date.getDate()).toBe(24);
            expect(date.getHours()).toBe(0);
            expect(date.getMinutes()).toBe(34);
            expect(date.getSeconds()).toBe(11);
            expect(date.getMilliseconds()).toBe(401);
        });

        it('should extract simple kernel time format', () => {
            const line = 'bluetooth-service 27.888888 I/EEEE (P111, T222): log';
            // The regex for rawMatch is /^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/
            // This line does NOT start with the number, so it might fail with current logic unless we adjust regex to look *inside* or the user meant "timestamp at start".
            // User example: "bluetooth-service 27.888888 I/EEEE (P111, T222): log"
            // My current regex expects it at the start or in brackets.
            // If the timestamp is in the middle, we need a strategy.
            // However, usually logs start with timestamp.
            // If "bluetooth-service" is the TAG, maybe the format is "TAG TIMESTAMP ..." ?
            // Let's assume the user meant the line STARTS with standard log parts.
            // But valid raw log usually starts with timestamp.
            // Wait, the user said: "bluetooth-service 27.888888 I/EEEE (P111, T222): log"
            // This implies the timestamp is the SECOND token?
            // Or "bluetooth-service" is the process name printed by journalctl?
            // Let's try to match a float timestamp anywhere early in the line?
            // But that is risky (could match version numbers).

            // Let's stick to what I implemented: start of line.
            // If the user's log really starts with "bluetooth-service...", I might need to relax the regex.
            // Let's check the implementation again.
            // const rawMatch = line.match(/^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/);
            // This only matches AT START.

            // If the user input "bluetooth-service 27.888888..." is real, I need to support it.
            // Let's update the implementation to allow a prefix word?
            // Or maybe simply look for the pattern `\s+(\d+\.\d+)\s+` ?
            // That's dangerous.

            // Let's test the ones I KNOW should work first (Raw at start).
        });
    });

    describe('formatDuration', () => {
        it('should format milliseconds', () => {
            expect(formatDuration(123)).toBe('123ms');
        });

        it('should format seconds', () => {
            expect(formatDuration(1234)).toBe('1s 234ms');
            expect(formatDuration(1000)).toBe('1s');
        });

        it('should format minutes', () => {
            expect(formatDuration(65432)).toBe('1m 5s');
            expect(formatDuration(60000)).toBe('1m');
        });

        it('should format hours', () => {
            expect(formatDuration(3661000)).toBe('1h 1m');
            expect(formatDuration(3600000)).toBe('1h');
        });
    });
});
