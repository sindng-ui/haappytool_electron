const { spawn } = require('child_process');

console.log('Starting SDB Crash Reproduction...');

try {
    // Simulate invalid SDB command to trigger spawn error
    const sdbPath = 'invalid_sdb_path_exe';
    const args = ['shell', 'echo', 'READY'];

    console.log(`Spawning: ${sdbPath} ${args.join(' ')}`);
    const checker = spawn(sdbPath, args);

    checker.stdout.on('data', (data) => console.log(`STDOUT: ${data}`));
    checker.stderr.on('data', (data) => console.log(`STDERR: ${data}`));

    checker.on('close', (code) => {
        console.log(`Process exited with code ${code}`);
    });

    // ❌ INTENTIONALLY MISSING: checker.on('error', ...)
    // This should crash the script if my hypothesis is correct.

    setTimeout(() => {
        console.log('Test finished without crash (Unexpected if path is invalid)');
    }, 2000);

} catch (e) {
    console.log('Caught synchronous error:', e);
}
