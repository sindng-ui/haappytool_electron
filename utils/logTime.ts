
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
        // Default to current year/date if missing, just for relative comparison
        const now = new Date();
        const year = stdMatch[1] ? stdMatch[1].replace('-', '') : now.getFullYear();
        let datePart = stdMatch[2] ? stdMatch[2].trim() : `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const timePart = stdMatch[3];

        // normalize datePart (remove trailing spaces)
        datePart = datePart.replace(/\s+/g, '');

        // Construct ISO string: YYYY-MM-DDTHH:mm:ss.mss
        // Date.parse accepts "YYYY-MM-DDTHH:mm:ss.sss"
        const isoString = `${year}-${datePart}T${timePart}`;
        const timestamp = Date.parse(isoString);
        if (!isNaN(timestamp)) return timestamp;
    }

    // 2. Raw Monotonic Time (Tizen/Linux Kernel style or "Seconds.Microseconds" at start)
    // Matches: "[  123.456]" OR "123.456" at start of line
    const rawMatch = line.match(/^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/);
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

    // 4. Robust High-Precision Fallback
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
