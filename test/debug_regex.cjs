
function extractTimestampJS(line) {
    if (!line) return null;

    // 1. Standard (existing)
    const stdMatch = line.match(/(\d{4}-)?(\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (stdMatch) {
        return "STANDARD matched";
    }

    // 2. Raw Monotonic Time (Existing)
    // Matches: "[  123.456]" OR "123.456" at start of line
    const rawMatch = line.match(/^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/);
    if (rawMatch) {
        const seconds = parseFloat(rawMatch[2]);
        return seconds * 1000;
    }

    return null;
}

const type1 = "bluetooth: 4000.123456789 I/LOGTAG (P111, T111): contents";
const type2 = "4000.123456789 I/LOGTAG (P111, T111): contents";

console.log("Current Logic Results:");
console.log("Type 1:", extractTimestampJS(type1));
console.log("Type 2:", extractTimestampJS(type2));

// Proposed Logic
function extractTimestampProposed(line) {
    if (!line) return null;

    // 1. Standard
    const stdMatch = line.match(/(\d{4}-)?(\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (stdMatch) {
        return "STANDARD matched";
    }

    // 2. Raw Monotonic Time (Enhanced)
    // Matches: 
    // - "[ 123.456]"
    // - "123.456" at start
    // - "Prefix: 123.456"

    // Attempt 1: Start with timestamp or bracketed timestamp
    let rawMatch = line.match(/^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/);

    // Attempt 2: "Prefix: Timestamp" format
    if (!rawMatch) {
        // Look for "Word: Timestamp" at start of line
        rawMatch = line.match(/^[\w\-\.]+(?:\(\d+\))?:\s+(\d+\.\d+)/);
    }

    // Attempt 3: Just look for a high-precision float (safe?)
    // Maybe too aggressive. Let's stick to structured match.

    if (rawMatch) {
        // The timestamp group index might vary based on regex structure. 
        // For Attempt 1: group 2. For Attempt 2: group 1.
        // Let's refine the regex to be unified or check groups.

        const tsString = rawMatch[2] || rawMatch[1]; // Fallback based on capture groups
        // Re-verify capture group index for Attempt 1:
        // Group 1: prefix '[', Group 2: timestamp, Group 3: suffix ']'
        // Re-verify capture group index for Attempt 2:
        // Group 1: timestamp.

        // Wait, 'rawMatch' from Attempt 2 has timestamp in group 1.
        // 'rawMatch' from Attempt 1 has timestamp in group 2.

        const val = parseFloat(tsString);
        if (!isNaN(val)) return val * 1000;
    }

    return null;
}

console.log("\nProposed Logic Results:");
const prop1 = extractTimestampProposed(type1);
const prop2 = extractTimestampProposed(type2);
console.log("Type 1:", prop1);
console.log("Type 2:", prop2);
