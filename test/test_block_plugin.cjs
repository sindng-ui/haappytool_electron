const io = require('socket.io-client');
const assert = require('assert');

// Connect to local server
const socket = io('http://localhost:3002');

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
        await testCommandExecution();
        await testFilePersistence();
        console.log('ALL TESTS PASSED');
        process.exit(0);
    } catch (e) {
        console.error('TEST FAILED:', e.message);
        process.exit(1);
    }
}

function testCommandExecution() {
    return new Promise((resolve, reject) => {
        console.log('[Test] Command Execution...');
        const cmd = 'echo "Hello Block Test"';

        socket.emit('run_host_command', { command: cmd });

        const handler = (res) => {
            if (res.command === cmd) {
                socket.off('host_command_result', handler);
                if (res.success && res.output.trim() === '"Hello Block Test"') {
                    console.log('  PASS: Command executed successfully');
                    resolve();
                } else {
                    reject(new Error(`Command failed or output mismatch. Success: ${res.success}, Output: ${res.output}`));
                }
            }
        };
        socket.on('host_command_result', handler);

        // Timeout
        setTimeout(() => reject(new Error('Command execution timed out')), 2000);
    });
}

function testFilePersistence() {
    return new Promise((resolve, reject) => {
        console.log('[Test] File Persistence...');
        const filename = 'test_config.json';
        const content = JSON.stringify({ foo: 'bar' });

        // 1. Save
        socket.emit('save_file', { filename, content });

        const saveHandler = (res) => {
            if (res.filename === filename) {
                socket.off('save_file_result', saveHandler);
                if (!res.success) return reject(new Error('Save failed: ' + res.error));

                console.log('  PASS: File saved');

                // 2. Load
                socket.emit('load_file', { filename });
            }
        };
        socket.on('save_file_result', saveHandler);

        const loadHandler = (res) => {
            if (res.filename === filename) {
                socket.off('load_file_result', loadHandler);
                if (res.success && res.content === content) {
                    console.log('  PASS: File loaded and matches');
                    resolve();
                } else {
                    reject(new Error(`Load failed or mismatch. Success: ${res.success}, Content: ${res.content}`));
                }
            }
        };
        socket.on('load_file_result', loadHandler);

        // Timeout
        setTimeout(() => reject(new Error('Persistence test timed out')), 2000);
    });
}
