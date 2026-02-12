
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
