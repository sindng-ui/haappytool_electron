
const { extractTimestamp } = require('../utils/logTime.ts'); // This won't work directly with node unless I handle TS.
// I will just copy the logic to test it in JS.

function extractTimestampJS(line) {
    if (!line) return null;

    // 1. Standard
    const stdMatch = line.match(/(\d{4}-)?(\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (stdMatch) {
        // ... simplified logic ...
        return "STANDARD matched";
    }

    // 2. Raw Monotonic Time (Existing)
    const rawMatch = line.match(/^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/);
    if (rawMatch) {
        const seconds = parseFloat(rawMatch[2]);
        return seconds * 1000;
    }

    return null;
}

const type1 = "bluetooth: 4000.123456789 I/LOGTAG (P111, T111): contents";
const type2 = "4000.123456789 I/LOGTAG (P111, T111): contents";

console.log("Type 1:", extractTimestampJS(type1));
console.log("Type 2:", extractTimestampJS(type2));
