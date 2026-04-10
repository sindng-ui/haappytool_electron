const { spawn } = require('child_process');

// The exact command user is running
const command = 'sdb shell vh_send 113';

console.log(`[REPRO] Spawning: ${command}`);

// Exact logic from server/index.js
const proc = spawn(command, [], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

proc.stdout.on('data', (data) => {
    console.log(`[STDOUT] ${data.toString().trim()}`);
});

proc.stderr.on('data', (data) => {
    console.log(`[STDERR] ${data.toString().trim()}`);
});

proc.on('close', (code) => {
    console.log(`[CLOSE] Code: ${code}`);
});

proc.on('error', (err) => {
    console.error(`[ERROR] ${err.message}`);
});

// Timeout check
setTimeout(() => {
    console.log('[REPRO] Timeout reached (5s). Process likely hanging.');
    process.exit(1);
}, 5000);
