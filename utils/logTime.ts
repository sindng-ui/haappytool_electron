
/**
 * Utility for parsing timestamps from log lines and formatting durations.
 */

// Regex patterns for common log timestamp formats
const TIME_PATTERNS = [
    // 1. Standard: "MM-DD HH:mm:ss.mss" or "YYYY-MM-DD HH:mm:ss.mss"
    // Matches: 01-01 12:00:00.123, 2024-01-01 12:00:00.123
    /(\d{2}-\d{2}\s+)?\d{2}:\d{2}:\d{2}\.\d{3}/,

    // 2. Simple Time: "HH:mm:ss"
    // Matches: 12:00:00
    /\d{2}:\d{2}:\d{2}/,

    // 3. Kernel Time: "[ 123.456]" (seconds.microseconds)
    // Matches: [ 1234.567890], [  12.345]
    /^\s*\[\s*(\d+\.\d+)\s*\]/
];

/**
 * Extracts a timestamp (in milliseconds) from a log line.
 * Returns null if no valid timestamp is found.
 */
export const extractTimestamp = (line: string): number | null => {
    if (!line) return null;

    // 1. Standard / Tizen Dlog: "MM-DD HH:mm:ss.mss" or "YYYY-MM-DD HH:mm:ss.mss"
    // Matches: 01-01 12:00:00.123, 2024-01-01 12:00:00.123
    const stdMatch = line.match(/(\d{4}-)?(\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (stdMatch) {
        // Optimization: Manual parsing to avoid expensive Date.parse() and string allocation
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth();
        let day = now.getDate();

        if (stdMatch[1]) {
            year = parseInt(stdMatch[1], 10);
        }

        if (stdMatch[2]) {
            const dateStr = stdMatch[2].trim();
            const dashIdx = dateStr.indexOf('-');
            if (dashIdx !== -1) {
                month = parseInt(dateStr.substring(0, dashIdx), 10) - 1; // 0-indexed
                day = parseInt(dateStr.substring(dashIdx + 1), 10);
            }
        }

        const timePart = stdMatch[3];
        const hours = parseInt(timePart.substring(0, 2), 10);
        const minutes = parseInt(timePart.substring(3, 5), 10);
        const seconds = parseInt(timePart.substring(6, 8), 10);
        const milliseconds = parseInt(timePart.substring(9, 12), 10);

        return new Date(year, month, day, hours, minutes, seconds, milliseconds).getTime();
    }

    // 2. Raw Monotonic Time (Tizen/Linux Kernel style or "Seconds.Microseconds" at start)
    // Matches: "[  123.456]", "123.456", "  123.456"
    // Regex Logic:
    // ^\s*          -> Start of line, optional leading space
    // (\[\s*)?      -> Optional open bracket with optional space
    // (\d+\.\d+)    -> Timestamp (Group 2)
    // (\s*\])?      -> Optional close bracket with optional space
    const rawMatch = line.match(/^\s*(\[\s*)?(\d+\.\d+)(\s*\])?/);
    if (rawMatch) {
        // rawMatch[2] is the timestamp part
        const seconds = parseFloat(rawMatch[2]);
        if (!isNaN(seconds)) {
            return seconds * 1000; // Convert to ms
        }
    }

    // 3. Prefixed Monotonic Time (e.g. "bluetooth: 12345.6789")
    // Matches: "Service: 123.456" or "Tag: 123.456"
    // Structure: Start -> Word/Dashes/Dots -> Optional (PID) -> Colon -> Space -> Timestamp
    const prefixMatch = line.match(/^[\w\-\.]+(?:\(\d+\))?:\s+(\d+\.\d+)/);
    if (prefixMatch) {
        const seconds = parseFloat(prefixMatch[1]);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
    }

    // 4. Timestamp followed by colon (common in ftrace/dmesg)
    // Matches: "task-123 [001] 100.123: func", "Tag 123.456:"
    const colonMatch = line.match(/^\s*.*?\s+(\d+\.\d+):/);
    if (colonMatch) {
        const seconds = parseFloat(colonMatch[1]);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
    }

    // 5. Brackets with prefix or Simple Prefix (Non-greedy)
    // Matches: "[Tag] 123.456", "Tag 123.456"
    // Be careful with false positives (e.g. "Version 1.2")
    // We restrict prefix to common tag chars
    const loosePrefixMatch = line.match(/^\s*[\w\-\.\[\]]+\s+(\d+\.\d+)(?:\s|$)/);
    if (loosePrefixMatch) {
        const seconds = parseFloat(loosePrefixMatch[1]);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
    }

    // 6. Robust High-Precision Fallback
    // Check for any floating point number with 6+ decimal places (timestamps usually have 6 or 9)
    // This helps catch cases where formatting is slightly off or in middle of preamble
    // Matches: " 123.456789 ", "Time: 123.456789"
    const robustMatch = line.match(/(?:^|\s)(\d+\.\d{6,})(?:\s|$|:)/);
    if (robustMatch) {
        const seconds = parseFloat(robustMatch[1]);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
    }

    return null;
};

/**
 * Formats a duration in milliseconds into a human-readable string.
 * Format: "1h 2m 3s 45ms"
 */
export const formatDuration = (ms: number): string => {
    if (ms < 0) ms = -ms;
    if (ms === 0) return '0ms';

    const time = Math.abs(ms);

    // Less than 1 second
    if (time < 1000) {
        return `${Math.round(time)}ms`;
    }

    const seconds = Math.floor(time / 1000);
    const milliseconds = Math.round(time % 1000);

    // Less than 1 minute
    if (seconds < 60) {
        return milliseconds > 0
            ? `${seconds}s ${milliseconds}ms`
            : `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    // Less than 1 hour
    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
};
