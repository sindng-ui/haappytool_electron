// Copied logic for reproduction.

function extractTimestampJS(line) {
    if (!line) return null;

    // 2. Raw Monotonic Time (Current)
    const rawMatch = line.match(/^(\s*\[\s*)?(\d+\.\d+)(\s*\])?/);
    if (rawMatch) {
        return parseFloat(rawMatch[2]) * 1000;
    }

    // 3. Prefixed (Current)
    const prefixMatch = line.match(/^[\w\-\.]+(?:\(\d+\))?:\s+(\d+\.\d+)/);
    if (prefixMatch) {
        return parseFloat(prefixMatch[1]) * 1000;
    }

    // 4. Robust (Current) - requires 6 digits
    const robustMatch = line.match(/(?:^|\s)(\d+\.\d{6,})(?:\s|$|:)/);
    if (robustMatch) {
        return parseFloat(robustMatch[1]) * 1000;
    }

    return null;
}

const inputs = [
    "3333.955 I/AAA (P111, T111) : content",       // No space
    " 3333.955 I/AAA (P111, T111) : content",      // Leading space
    "  3333.955 I/AAA (P111, T111) : content",     // Two spaces
    "[3333.955] I/AAA (P111, T111) : content",     // Brackets
    " [ 3333.955 ] I/AAA (P111, T111) : content",  // Brackets with space
    "type2 : 3333.955 I/AAA (P111, T111) : content" // Prefix
];

inputs.forEach(input => {
    console.log(`Input: '${input}' -> Result: ${extractTimestampJS(input)}`);
});

// Proposed Fix for Case 2 (Leading space without brackets)
function extractTimestampFixed(line) {
    if (!line) return null;

    // Allow optional brackets, but importantly ALLOW LEADING WHITESPACE explicitly outside the bracket group logic if needed
    // OR just make the regex handle optional brackets more flexibly.

    // New Regex: Start, optional whitespace, optional open bracket, optional whitespace, TIMESTAMP, optional whitespace, optional close bracket
    const rawMatch = line.match(/^\s*(\[\s*)?(\d+\.\d+)(\s*\])?/);

    if (rawMatch) {
        return parseFloat(rawMatch[2]) * 1000;
    }

    // ... other Logics ...
    return null;
}

console.log("\n--- With Fix ---");
inputs.forEach(input => {
    console.log(`Input: '${input}' -> Result: ${extractTimestampFixed(input)}`);
});
