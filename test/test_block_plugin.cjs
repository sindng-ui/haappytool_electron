const io = require('socket.io-client');
const assert = require('assert');

// Connect to local server
const socket = io('http://127.0.0.1:3003');

console.log('Connecting to server...');

socket.on('connect', () => {
    console.log('Connected!');
    runTests();
});

socket.on('connect_error', (err) => {
    console.error('Connection failed:', err.message);
    process.exit(1);
});

async function runTests() {
    try {
        await testValidCommand();
        await testInvalidCommand(); // The REPRO case
        console.log('ALL TESTS PASSED');
        process.exit(0);
    } catch (e) {
        console.error('TEST FAILED:', e.message);
        process.exit(1);
    }
}

// Client logic mirror
function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        console.log(`[Client] Running command: "${cmd}"`);

        // 5s timeout to catch "hanging" faster than 10s
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Command timed out (5s)"));
        }, 5000);

        const handleResult = (res) => {
            console.log(`[Client DEBUG] Received result:`, res);
            if (res.command === cmd) {
                cleanup();
                resolve(res.output);
            }
        };

        const cleanup = () => {
            clearTimeout(timeout);
            socket.off('host_command_result', handleResult);
        };

        socket.on('host_command_result', handleResult);
        socket.emit('run_host_command', { command: cmd });
    });
}

async function testValidCommand() {
    console.log('[Test] Valid Command (echo)...');
    const output = await runCommand('echo "Hello"');
    if (output.includes('Hello')) {
        console.log('  PASS');
    } else {
        throw new Error(`Output mismatch: ${output}`);
    }
}

async function testInvalidCommand() {
    console.log('[Test] Invalid Command (rgrg)...');
    const startTime = Date.now();
    try {
        const output = await runCommand('rgrg');
        const duration = Date.now() - startTime;
        console.log(`  PASS: Finished in ${duration}ms. Output: ${output}`);

        if (duration > 4000) {
            throw new Error("Test took too long, likely timed out instead of failing fast.");
        }

        // Check if output contains error message
        if (!output.toLowerCase().includes('not recognized') && !output.toLowerCase().includes('not found') && !output.toLowerCase().includes('error')) {
            console.warn("  WARNING: Output didn't look like a standard error, but it finished fast.");
        }

    } catch (e) {
        const duration = Date.now() - startTime;
        console.log(`  FAILED or TIMED OUT in ${duration}ms: ${e.message}`);
        // If it was the timeout error, then REPRODUCED
        if (e.message.includes('timed out')) {
            throw new Error("REPRODUCED: Command timed out instead of failing immediately.");
        }
        throw e;
    }
}
