
// Test the fixed regex logic
const val = "1234";
const regexVal = val.replace(/^(P|T)(\d+)$/i, '$1\\s*$2');
const regex = new RegExp(`(?:^|[^0-9a-zA-Z])${regexVal}(?:$|[^0-9a-zA-Z])`, 'i');

const lines = [
    "02-16 09:46:13.123  1234  5678 I Tag: Message",
    "Time:1234:Action",
    "Process(1234) started",
    "[1234] Error occured",
    "1234 5678 INFO",
    "NotThis123456", // Should NOT match
    "Prefix1234",    // Should NOT match
    "1234Suffix"     // Should NOT match
];

console.log("Regex:", regex);
lines.forEach(line => {
    console.log(`Match [${regex.test(line)}]: "${line}"`);
});
