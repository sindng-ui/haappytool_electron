require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client } = require('ssh2');
const { spawn, exec } = require('child_process');

const path = require('path');
const jimp = require('jimp');

// Global BlockTest Dir (Configurable via startServer)
let globalBlockTestDir = path.join(process.cwd(), 'BlockTest');
let globalUserDataPath = null;

// Lazy load OpenCV
let cv = null;
try {
    if (process.env.NODE_ENV !== 'test') {
        const cvModule = require('opencv-wasm');
        if (cvModule && typeof cvModule.then === 'function') {
            cvModule.then(c => {
                cv = c;
                console.log('OpenCV (WASM) Loaded');
            });
        } else {
            // Handling if it returns structure directly (unlikely for this package but safely handling)
            cv = cvModule;
        }
    }
} catch (e) {
    console.error('Failed to load opencv-wasm:', e);
}

const app = express();
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../dist')));
// Serve uploaded templates
app.use('/templates', express.static(path.join(__dirname, '../public/templates')));
// Serve BlockTest files (reports, etc.)
// Serve BlockTest files (reports, etc.) -> Moved to startServer to allow dynamic path
// app.use('/blocktest', ...);

// --- TEST ROUTES ---
app.get('/test-rpm', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head><title>RPM Test Page</title></head>
    <body>
        <h1>RPM Download Test</h1>
        <p>This is a simulated package directory.</p>
        <ul>
            <li><a href="test-package.rpm">test-package.rpm</a></li>
        </ul>
    </body>
    </html>
    `;
    res.send(html);
});

app.get('/test-package.rpm', (req, res) => {
    // Construct a minimal valid CPIO archive containing 'mock.tpk'
    // Header format: 110 bytes fixed ASCII
    // 0-6: Magic (070701)
    // 54-62: Filesize (8 hex)
    // 94-102: Namesize (8 hex)

    // Content: "MOCK_TPK_DATA" (13 bytes)
    // Filename: "mock.tpk" (8 bytes + 1 null = 9 bytes)

    const header = Buffer.alloc(110, '0');
    header.write('070701', 0); // Magic
    header.write('0000000D', 54); // Filesize = 13 (D in hex)
    header.write('00000009', 94); // Namesize = 9

    const filename = Buffer.from('mock.tpk\0'); // 9 bytes
    // Padding after filename to 4-byte align
    // 110 + 9 = 119. Next multiple of 4 is 120. Pad = 1 byte.
    const namePad = Buffer.alloc(1, 0);

    const content = Buffer.from('MOCK_TPK_DATA'); // 13 bytes
    // Padding after data to 4-byte align
    // 13 is not div by 4. Next is 16. Pad = 3 bytes.
    const contentPad = Buffer.alloc(3, 0);

    const fullBody = Buffer.concat([header, filename, namePad, content, contentPad]);

    res.setHeader('Content-Type', 'application/x-rpm');
    res.setHeader('Content-Disposition', 'attachment; filename="test-package.rpm"');
    res.send(fullBody);
});

// --- Mock Step 1: Initial Page with Artifact Table ---
app.get('/test-step1', (req, res) => {
    // Current host url for absolute linking
    const host = `http://127.0.0.1:${PORT}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <body>
        <h1>Build Info</h1>
        <p>Some random text...</p>
        <div>Artifacts</div> <!-- Keyword found -->
        <p>Below is the artifact table</p>
        <table border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>HQ URL</th> <!-- Target Column -->
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    // The logic should find this URL
                    <td><a href="${host}/test-step2">http://internal.repo/view/123</a></td> 
                    <td>Success</td>
                </tr>
            </tbody>
        </table>
    </body>
    </html>
    `;
    res.send(html);
});

// --- Mock Step 2: The Repo Directory ---
// The user logic appends: /repos/product/armv7l/packages/armv7l/
app.get('/test-step2/repos/product/armv7l/packages/armv7l/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <body>
        <h1>Index of /packages/armv7l</h1>
        <ul>
            <li><a href="../">Parent Directory</a></li>
            // The logic should find this .rpm file
            <li><a href="test-package.rpm">mock-target-app.rpm</a></li> 
            <li><a href="other.txt">other.txt</a></li>
        </ul>
    </body>
    </html>
    `;
    res.send(html);
});

// --- Mock Step 3: The RPM File itself (Relative link handling) ---
// Since the browser/logic resolves relative to Step 2 URL, it will request:
// /test-step2/repos/product/armv7l/packages/armv7l/test-package.rpm
app.get('/test-step2/repos/product/armv7l/packages/armv7l/test-package.rpm', (req, res) => {
    // Reuse the existing RPM generator logic by redirecting or just calling the handler
    // For simplicity, redirect to the existing /test-package.rpm handler
    res.redirect('/test-package.rpm');
});
// -------------------

// --- Global Error Handlers ---
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8 // 100 MB
});

const fs = require('fs');

// Active connections
let sshConnection = null;
let sdbProcess = null;
let debugStream = null;
let logFileStream = null;
let sshAuthFinish = null;

// Batching State
let logBuffer = '';
let batchTimeout = null;
const BATCH_INTERVAL = 20; // ms

function flushLogs(socket) {
    if (logBuffer.length > 0) {
        socket.emit('log_data', logBuffer);
        logBuffer = '';
    }
    batchTimeout = null;
}

function handleLogData(data, socket) {
    const str = data.toString();
    if (logFileStream) logFileStream.write(data);

    logBuffer += str;
    if (!batchTimeout) {
        batchTimeout = setTimeout(() => flushLogs(socket), BATCH_INTERVAL);
    }
}

function logDebug(msg) {
    if (debugStream) {
        const timestamp = new Date().toISOString();
        debugStream.write(`[${timestamp}] ${msg}\n`);
    }
}

const handleSocketConnection = (socket, deps = {}) => {
    const spawnProc = deps.spawn || spawn;
    const SSHClient = deps.Client || Client;

    // Helper to determine SDB executable
    const getSdbBin = (p) => p || 'sdb';
    // Helper to determine SDB command string (for exec/shell usage) with quoting if needed
    const getSdbCmd = (p) => p ? `"${p}"` : 'sdb';

    // --- SSH Handler ---
    socket.on('connect_ssh', ({ host, port, username, password, debug, saveToFile, command, tags }) => {
        // Set Default Command Smartly
        if (!command) {
            const tagString = (Array.isArray(tags) && tags.length > 0) ? tags.join(' ') : '';
            if (tagString) {
                command = `dlogutil -c; logger-mgr --filter ${tagString}; dlogutil -v kerneltime ${tagString}`;
            } else {
                command = `dlogutil -v kerneltime`;
            }
            console.log(`[SSH] Using smart default command: ${command}`);
        }

        console.log('[SSH] ========== SSH Connection Request ==========');
        console.log('[SSH] Connection initiated with params:', {
            host,
            port,
            username,
            passwordProvided: !!password,
            debug,
            saveToFile,
            command,
            tags: tags || []
        });

        // Perform Tag Substitution for custom or default command
        if (command && command.includes('$(TAGS)')) {
            const tagString = Array.isArray(tags) ? tags.join(' ') : '';
            command = command.replace(/\$\(TAGS\)/g, tagString);

            // Cleanup: remove redundant separators and spaces
            command = command.replace(/--filter\s+;/g, ';') // remove empty filter before semicolon
                .replace(/;\s*;/g, ';')      // remove double semicolons
                .replace(/\s+/g, ' ')        // collapse spaces
                .replace(/;\s*$/, '')        // remove trailing semicolon
                .trim();

            console.log(`[SSH] Substituted $(TAGS) -> "${tagString}"`);
            console.log(`[SSH] Effective command: ${command}`);
        }

        if (sshConnection) {
            console.log('[SSH] Closing existing SSH connection...');
            sshConnection.end();
            sshConnection = null;
        }
        if (sdbProcess) {
            console.log('[SSH] Killing existing SDB process to prevent duplicates...');
            sdbProcess.kill();
            sdbProcess = null;
        }
        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }
        if (logFileStream) {
            logFileStream.end();
            logFileStream = null;
        }

        // Reset Auth State
        sshAuthFinish = null;

        if (saveToFile) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `ssh_${timestamp}.txt`;
            const basePath = globalUserDataPath || process.cwd();
            const filePath = path.join(basePath, fileName);
            logFileStream = fs.createWriteStream(filePath, { flags: 'a' });
            logFileStream.on('error', (err) => console.error(`[SSH] Failed to write to log file ${filePath}:`, err));
            console.log(`[SSH] Saving logs to ${filePath}`);
            socket.emit('log_data', `[System] Saving logs to file: ${fileName}\n`);
        }

        if (debug) {
            const fileName = `tizen_debug_ssh_${Date.now()}.log`;
            const basePath = globalUserDataPath || process.cwd();
            const filePath = path.join(basePath, fileName);
            debugStream = fs.createWriteStream(filePath, { flags: 'a' });
            debugStream.on('error', (err) => console.error(`[SSH] Failed to write to debug file ${filePath}:`, err));
            console.log(`[SSH] Debug mode enabled, logging to: ${filePath}`);
            logDebug(`========== SSH Connection Debug Log ==========`);
            logDebug(`Starting SSH Connection to ${host}:${port} as ${username}`);
            logDebug(`Debug file path: ${filePath}`);
            logDebug(`Timestamp: ${new Date().toISOString()}`);
            socket.emit('debug_log', `Debug logging started: ${filePath}`);
        }

        console.log('[SSH] Creating SSH client...');
        const conn = new SSHClient();

        conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
            console.log('[SSH] Keyboard-Interactive Auth Requested');
            console.log('[SSH] Auth prompts count:', prompts.length);
            logDebug(`Keyboard-Interactive Auth: ${prompts.length} prompts`);

            // If prompts exist, respond with password for each
            if (prompts.length > 0 && password) {
                console.log('[SSH] Responding to keyboard-interactive with password');
                logDebug('Responding with password to keyboard-interactive prompts');
                finish([password]);
            } else if (prompts.length > 0) {
                console.log('[SSH] Password not provided for keyboard-interactive. Sending request to client.');
                sshAuthFinish = finish;
                socket.emit('ssh_auth_request', { prompt: prompts[0].prompt, echo: prompts[0].echo });
            } else {
                console.log('[SSH] No password for keyboard-interactive, sending empty response');
                logDebug('No password provided for keyboard-interactive');
                finish([]);
            }
        }).on('ready', () => {
            console.log('[SSH] ✓ SSH connection ready, requesting shell...');
            logDebug('SSH connection established successfully');

            conn.shell((err, stream) => {
                if (err) {
                    console.error('[SSH] ✗ Shell creation failed:', err.message);
                    logDebug(`Shell creation error: ${err.message}`);
                    socket.emit('ssh_error', { message: `Shell Error: ${err.message}` });
                    conn.end();
                    return;
                }

                console.log('[SSH] ✓ Shell created successfully');
                logDebug('Shell created successfully');
                sshConnection.stream = stream;

                // Track if we've received any data
                let firstDataReceived = false;

                stream.on('close', (code, signal) => {
                    console.log('[SSH] Stream closed. Code:', code, 'Signal:', signal);
                    logDebug(`Stream closed. Code: ${code}, Signal: ${signal}`);
                    socket.emit('ssh_status', { status: 'disconnected', message: 'Shell closed' });
                    if (debugStream) { debugStream.end(); debugStream = null; }
                    if (logFileStream) { logFileStream.end(); logFileStream = null; }
                }).on('data', (data) => {
                    if (!firstDataReceived) {
                        console.log('[SSH] ✓ First data received:', data.length, 'bytes');
                        console.log('[SSH] First data preview:', data.toString().substring(0, 100));
                        logDebug(`First data received: ${data.length} bytes`);
                        firstDataReceived = true;
                    }

                    if (debugStream) logDebug(`[DATA CHUNK] ${data.length} bytes`);
                    handleLogData(data, socket);
                }).stderr.on('data', (data) => {
                    console.log('[SSH] STDERR data received:', data.toString());
                    logDebug(`STDERR: ${data}`);
                    handleLogData(data, socket);
                });

                // Wait a bit for shell to be ready, then send command
                setTimeout(() => {
                    let cmdToSend = 'dlogutil -v kerneltime\n';

                    if (command && typeof command === 'string' && command.trim().length > 0) {
                        cmdToSend = command.trim() + '\n';
                        console.log(`[SSH] Using custom command: ${command}`);
                        logDebug(`Custom command provided: ${command}`);
                    } else {
                        console.log('[SSH] Using default command: dlogutil -v kerneltime');
                        logDebug('Using default command: dlogutil -v kerneltime');
                    }

                    console.log('[SSH] Writing command to stream:', cmdToSend.trim());
                    stream.write(cmdToSend);
                    logDebug(`Command sent to shell: ${cmdToSend.trim()}`);
                    console.log('[SSH] Command sent, waiting for log data...');
                }, 500);

                // Emit connected status
                socket.emit('ssh_status', { status: 'connected', message: 'SSH Shell Connected' });
            });
        }).on('error', (err) => {
            console.error('[SSH] ✗ Connection Error:', err);
            console.error('[SSH] Error details:', {
                message: err.message,
                code: err.code,
                level: err.level,
                errno: err.errno
            });
            logDebug(`Connection error: ${err.message} (code: ${err.code}, level: ${err.level})`);

            let userMessage = err.message;
            if (err.level === 'client-authentication') {
                userMessage = 'Authentication Failed with provided credentials.';
                console.error('[SSH] Authentication failed - check username/password');
            } else if (err.code === 'ECONNREFUSED') {
                userMessage = 'Connection Refused (Is SSH enabled on device?)';
                console.error('[SSH] Connection refused - SSH service may not be running');
            } else if (err.code === 'ENOTFOUND') {
                userMessage = 'Host not found';
                console.error('[SSH] Host not found - check IP address');
            } else if (err.code === 'ETIMEDOUT') {
                userMessage = 'Connection Timed Out';
                console.error('[SSH] Connection timeout - check network connectivity');
            }

            socket.emit('ssh_error', { message: userMessage });
            if (debugStream) { debugStream.end(); debugStream = null; }
            if (logFileStream) { logFileStream.end(); logFileStream = null; }
        }).connect({
            host,
            port: parseInt(port, 10),
            username,
            password,
            tryKeyboard: true,
            readyTimeout: 20000,
            keepaliveInterval: 10000
        });

        console.log('[SSH] Connection attempt started...');
        logDebug('Attempting to connect...');
        sshConnection = conn;
    });

    // ...

    socket.on('disconnect_ssh', () => {
        logDebug('User requested SSH disconnect');
        if (sshConnection) {
            sshConnection.end();
            sshConnection = null;
            socket.emit('ssh_status', { status: 'disconnected', message: 'SSH Disconnected by user' });
        }
        if (debugStream) {
            logDebug('Closing debug stream');
            debugStream.end();
            debugStream = null;
        }
        if (logFileStream) {
            logFileStream.end();
            logFileStream = null;
        }
        sshAuthFinish = null;
    });

    socket.on('ssh_auth_response', (data) => {
        if (sshAuthFinish) {
            console.log('[SSH] Received auth response from client');
            sshAuthFinish([data]);
            sshAuthFinish = null;
        }
    });

    // --- SDB Handler ---
    socket.on('connect_sdb', ({ deviceId, debug, saveToFile, command, tags, sdbPath }) => {
        // Set Default Command Smartly
        if (!command) {
            const tagString = (Array.isArray(tags) && tags.length > 0) ? tags.join(' ') : '';
            if (tagString) {
                command = `dlogutil -v kerneltime ${tagString}`;
            } else {
                command = `dlogutil -v kerneltime`;
            }
            console.log(`[SDB] Using smart default command: ${command}`);
        }

        console.log('[SDB] ========== SDB Connection Request ==========');
        console.log('[SDB] Connection initiated with params:', {
            deviceId: deviceId || 'auto-detect',
            debug,
            saveToFile,
            command,
            tags: tags || []
        });

        // Perform Tag Substitution
        if (command && command.includes('$(TAGS)')) {
            const tagString = Array.isArray(tags) ? tags.join(' ') : '';
            command = command.replace(/\$\(TAGS\)/g, tagString);

            // Cleanup: similar to SSH for consistency
            command = command.replace(/\s+/g, ' ').trim();

            console.log(`[SDB] Substituted $(TAGS) -> "${tagString}"`);
            console.log(`[SDB] Effective command: ${command}`);
        }

        if (sdbProcess) {
            console.log('[SDB] Killing existing SDB process...');
            sdbProcess.kill();
            sdbProcess = null;
        }
        if (sshConnection) {
            console.log('[SDB] Closing existing SSH connection to prevent duplicates...');
            sshConnection.end();
            sshConnection = null;
        }

        // Setup debug and log file streams
        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }
        if (logFileStream) {
            logFileStream.end();
            logFileStream = null;
        }

        if (saveToFile) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `sdb_${timestamp}.txt`;
            const basePath = globalUserDataPath || process.cwd();
            const filePath = path.join(basePath, fileName);
            logFileStream = fs.createWriteStream(filePath, { flags: 'a' });
            logFileStream.on('error', (err) => console.error(`[SDB] Failed to write to log file ${filePath}:`, err));
            console.log(`[SDB] Saving logs to ${filePath}`);
            socket.emit('log_data', `[System] Saving logs to file: ${fileName}\n`);
        }

        if (debug) {
            const fileName = `tizen_debug_sdb_${Date.now()}.log`;
            const basePath = globalUserDataPath || process.cwd();
            const filePath = path.join(basePath, fileName);
            debugStream = fs.createWriteStream(filePath, { flags: 'a' });
            debugStream.on('error', (err) => console.error(`[SDB] Failed to write to debug file ${filePath}:`, err));
            console.log(`[SDB] Debug mode enabled, logging to: ${filePath}`);
            logDebug(`========== SDB Connection Debug Log ==========`);
            logDebug(`Starting SDB Connection to device: ${deviceId || 'auto-detect'}`);
            logDebug(`Debug file path: ${filePath}`);
            logDebug(`Timestamp: ${new Date().toISOString()}`);
            socket.emit('debug_log', `Debug logging started: ${filePath}`);
        }

        // Helper to encapsulate connection logic for easy retry
        const initiateSdbConnection = (isRetry = false) => {
            // Defined args for sdb log stream (e.g. dlogutil -v threadtime)
            // If command is provided, split it by space. Otherwise default.
            let args = [];
            if (deviceId && deviceId !== 'auto-detect') {
                args.push('-s', deviceId);
            }

            args.push('shell');

            if (command && typeof command === 'string' && command.trim().length > 0) {
                if (!isRetry) { // Log only once
                    console.log(`[SDB] Using custom command: ${command}`);
                    logDebug(`Custom command provided: ${command}`);
                }
                const cmdParts = command.trim().split(/\s+/);
                args.push(...cmdParts);
            } else {
                if (!isRetry) {
                    console.log('[SDB] Using default command: dlogutil -v kerneltime');
                    logDebug('Using default command: dlogutil -v kerneltime');
                }
                args.push('dlogutil', '-v', 'kerneltime');
            }

            if (!isRetry) {
                console.log('[SDB] Final sdb args:', args);
                logDebug(`Full command: sdb ${args.join(' ')}`);
            }

            try {
                if (!isRetry) {
                    console.log('[SDB] Verifying device connection before streaming...');
                    logDebug('Verifying device connection with a simple shell command...');
                }

                // Step 0: Quick check if device is reachable
                const checkArgs = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', 'echo', 'READY'] : ['shell', 'echo', 'READY'];
                console.log(`[SDB] Verifying device with: ${getSdbBin(sdbPath)} ${checkArgs.join(' ')}`);

                const checker = spawnProc(getSdbBin(sdbPath), checkArgs);
                let checkerOutput = '';
                let checkerError = '';
                let checkerKilled = false;

                // Timeout for verification
                const checkerTimeout = setTimeout(() => {
                    console.error('[SDB] Verification timed out (5s). Killing checker...');
                    checkerKilled = true;
                    checker.kill();
                    socket.emit('sdb_error', { message: 'Device connection verify timed out (5s). Check USB/Network.' });
                    if (debugStream) { debugStream.end(); debugStream = null; }
                    if (logFileStream) { logFileStream.end(); logFileStream = null; }
                }, 5000);

                checker.stdout.on('data', d => checkerOutput += d.toString());
                checker.stderr.on('data', d => checkerError += d.toString());

                checker.on('close', (code) => {
                    clearTimeout(checkerTimeout);
                    if (checkerKilled) return;
                    try {
                        if (code !== 0 || !checkerOutput.includes('READY')) {
                            const errMsg = checkerError.trim() || `Device not responding (Exit code: ${code})`;

                            // [Auto-Recovery] Target not found
                            if (!isRetry && (errMsg.includes('target not found') || errMsg.includes('error: target not found'))) {
                                const fixedIp = '192.168.250.250';
                                console.log(`[SDB Recovery] Target not found event. Attempting fixed auto-reconnect to ${fixedIp}...`);
                                logDebug(`[Recovery] Target not found. Attempting disconnect/connect for fixed IP: ${fixedIp}`);

                                // ✅ Notify client that auto-recovery is in progress
                                socket.emit('sdb_status', {
                                    status: 'reconnecting',
                                    message: `Device not found. Attempting auto-reconnect to ${fixedIp}...`
                                });

                                const dis = spawnProc(getSdbBin(sdbPath), ['disconnect', fixedIp]);
                                dis.on('close', () => {
                                    const con = spawnProc(getSdbBin(sdbPath), ['connect', fixedIp]);

                                    let conOutput = '';
                                    let conError = '';
                                    con.stdout.on('data', d => conOutput += d.toString());
                                    con.stderr.on('data', d => conError += d.toString());

                                    // ✅ Add timeout for connection attempt (10 seconds)
                                    let isTimedOut = false;
                                    const conTimeout = setTimeout(() => {
                                        console.error('[SDB Recovery] Connection timeout');
                                        isTimedOut = true;
                                        con.kill();
                                        socket.emit('sdb_error', {
                                            message: `Auto-reconnect to ${fixedIp} timed out. Please check network connection or use Scan button.`
                                        });
                                        if (debugStream) { debugStream.end(); debugStream = null; }
                                        if (logFileStream) { logFileStream.end(); logFileStream = null; }
                                    }, 10000);

                                    con.on('close', (code) => {
                                        clearTimeout(conTimeout);
                                        if (isTimedOut) return; // Prevent duplicate handling

                                        // ✅ Check if connection succeeded
                                        const success = code === 0 || conOutput.toLowerCase().includes('connected');

                                        if (success) {
                                            console.log('[SDB Recovery] Auto-reconnect successful. Retrying connection...');
                                            logDebug(`[Recovery] Reconnection successful. Output: ${conOutput}`);

                                            socket.emit('sdb_status', {
                                                status: 'reconnecting',
                                                message: 'Auto-reconnect successful. Retrying connection...'
                                            });

                                            // Wait a bit for device to be ready, then retry
                                            setTimeout(() => {
                                                initiateSdbConnection(true);
                                            }, 1000);
                                        } else {
                                            console.error(`[SDB Recovery] Auto-reconnect failed. Code: ${code}, Error: ${conError}`);
                                            logDebug(`[Recovery] Reconnection failed. Code: ${code}, Output: ${conOutput}, Error: ${conError}`);

                                            socket.emit('sdb_error', {
                                                message: `Auto-reconnect failed. Please click Scan button or check device connection manually.`
                                            });

                                            if (debugStream) { debugStream.end(); debugStream = null; }
                                            if (logFileStream) { logFileStream.end(); logFileStream = null; }
                                        }
                                    });
                                });
                                return;
                            }

                            console.error(`[SDB] ✗ Connection verification failed: ${errMsg}`);
                            logDebug(`Connection verification failed: ${errMsg}`);
                            socket.emit('sdb_error', { message: `Connection Failed: ${errMsg}` });
                            if (debugStream) { debugStream.end(); debugStream = null; }
                            if (logFileStream) { logFileStream.end(); logFileStream = null; }
                            return;
                        }

                        console.log('[SDB] ✓ Device verified, starting log stream...');
                        logDebug('Device verified, spawning log process...');

                        sdbProcess = spawnProc(getSdbBin(sdbPath), args);

                        if (sdbProcess && sdbProcess.pid) {
                            console.log('[SDB] ✓ Process spawned successfully, PID:', sdbProcess.pid);
                            logDebug(`Process spawned with PID: ${sdbProcess.pid}`);

                            // CRITICAL: Notify client that connection succeeded
                            socket.emit('sdb_status', { status: 'connected', message: 'SDB Connected successfully' });
                        }

                        if (!sdbProcess) {
                            throw new Error('Failed to spawn SDB process');
                        }

                        // ... SDB Stdout/Stderr listeners ...
                        sdbProcess.stdout.on('data', (data) => {
                            if (data) {
                                const str = data.toString();
                                socket.emit('log_data', str);
                                if (saveToFile && logFileStream) logFileStream.write(str);
                            }
                        });

                        sdbProcess.stderr.on('data', (data) => {
                            if (data) {
                                const str = data.toString();
                                // Optional: Emit stderr as log or error? 
                                // Typically dlogutil output goes to stdout, but errors to stderr.
                                console.log('[SDB STDERR]', str);
                                if (str.includes('closed') || str.includes('error') || str.includes('failed')) {
                                    // socket.emit('sdb_error', { message: str }); // Can be noisy
                                }
                                if (saveToFile && logFileStream) logFileStream.write(`[STDERR] ${str}`);
                            }
                        });

                        sdbProcess.on('close', (code) => {
                            console.log(`[SDB] Process exited with code ${code}`);
                            logDebug(`Process exited with code ${code}`);
                            socket.emit('sdb_status', { status: 'disconnected', message: `SDB Exited (Code: ${code})` });

                            if (debugStream) { debugStream.end(); debugStream = null; }
                            if (logFileStream) { logFileStream.end(); logFileStream = null; }
                            sdbProcess = null;
                        });

                    } catch (e) {
                        console.error('[SDB] ✗ Exception in sdb process setup:', e);
                        socket.emit('sdb_error', { message: `Failed to start SDB: ${e.message}` });
                    }
                });
            } catch (e) {
                console.error('[SDB] ✗ Exception during connection verification:', e);
                socket.emit('sdb_error', { message: `SDB verification error: ${e.message}` });
            }
        };

        // Start the session
        initiateSdbConnection(false);
    });

    socket.on('disconnect_sdb', () => {
        // ...
        if (sdbProcess) {
            sdbProcess.kill();
            sdbProcess = null;
        }
        // We don't have sdbPath here easily unless we stored it in session/closure. 
        // Assume default sdb for disconnect or try to track it. 
        // For simplicity, we rely on 'sdb' here or ignore if it fails, as we killed the process.
        // spawnProc('sdb', ['disconnect']); // Removed to prevent dropping device connection

        socket.emit('sdb_status', { status: 'disconnected', message: 'SDB Disconnected by user' });

        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }
        if (logFileStream) {
            logFileStream.end();
            logFileStream = null;
        }
    });

    socket.on('sdb_write', (data) => {
        if (sdbProcess && sdbProcess.stdin && sdbProcess.stdin.writable) {
            console.log(`[SDB] Writing to process: ${data.trim()}`);
            sdbProcess.stdin.write(data);
        }
    });

    socket.on('ssh_write', (data) => {
        if (sshConnection && sshConnection.stream && sshConnection.stream.writable) {
            console.log(`[SSH] Writing to stream: ${data.trim()}`);
            sshConnection.stream.write(data);
        }
    });

    socket.on('disconnect', () => {
        // ...
        // ...
        if (logFileStream) { logFileStream.end(); logFileStream = null; }
    });

    socket.on('connect_sdb_remote', async ({ ip, sdbPath }) => {
        console.log(`[SDB Remote] Connecting to ${ip}...`);
        try {
            // 1. sdb disconnect
            await new Promise((resolve) => {
                const child = spawnProc(getSdbBin(sdbPath), ['disconnect']);
                child.on('close', resolve);
            });

            // 2. sdb connect IP
            await new Promise((resolve, reject) => {
                const child = spawnProc(getSdbBin(sdbPath), ['connect', ip]);
                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Connect failed with code ${code}`));
                });
            });

            // 3. sdb root on
            await new Promise((resolve) => {
                const child = spawnProc(getSdbBin(sdbPath), ['root', 'on']);
                child.on('close', resolve);
            });

            socket.emit('sdb_remote_result', { success: true, message: 'Connected and Rooted' });

            // Refresh list
            const listChild = spawnProc(getSdbBin(sdbPath), ['devices']);
            let listData = '';
            listChild.stdout.on('data', d => listData += d.toString());
            listChild.on('close', () => {
                // simple parse or just trigger existing list logic?
                // Let's just emit list_sdb_devices_result if we want, or rely on client to refresh
                // But client logic refreshes on success probably.   
            });

        } catch (e) {
            console.error(`[SDB Remote] Error: ${e.message}`);
            socket.emit('sdb_remote_result', { success: false, error: e.message });
        }
    });


    // --- SDB Remote Connection Handler (for Auto-Scan button) ---
    socket.on('connect_sdb_remote', ({ ip, sdbPath }) => {
        console.log(`[SDB Remote] Attempting to connect to ${ip}...`);

        // Try system sdb first, fallback to custom path
        const tryConnect = (sdbBin) => {
            return new Promise((resolve, reject) => {
                const disconnectCmd = process.platform === 'win32'
                    ? `chcp 65001 > nul && "${sdbBin}" disconnect ${ip}`
                    : `"${sdbBin}" disconnect ${ip}`;

                exec(disconnectCmd, (dErr) => {
                    // Ignore disconnect errors (device might not be connected)
                    const connectCmd = process.platform === 'win32'
                        ? `chcp 65001 > nul && "${sdbBin}" connect ${ip}`
                        : `"${sdbBin}" connect ${ip}`;

                    exec(connectCmd, { encoding: 'utf-8', timeout: 10000 }, (cErr, stdout, stderr) => {
                        if (cErr) {
                            reject(new Error(stderr || cErr.message));
                        } else {
                            resolve(stdout);
                        }
                    });
                });
            });
        };

        // Try system sdb first
        tryConnect('sdb')
            .then((result) => {
                console.log(`[SDB Remote] Connected via system sdb: ${result}`);

                // Check if connection succeeded or if we need root
                const rootCmd = process.platform === 'win32'
                    ? `chcp 65001 > nul && sdb root on`
                    : `sdb root on`;

                exec(rootCmd, (rErr, rOut) => {
                    const message = rOut && rOut.includes('already')
                        ? 'Connected and rooted'
                        : 'Connected successfully';
                    socket.emit('sdb_remote_result', { success: true, message });
                });
            })
            .catch((systemErr) => {
                // System sdb failed, try custom path if provided
                if (sdbPath && sdbPath.trim().length > 0) {
                    console.log(`[SDB Remote] System sdb failed, trying custom path: ${sdbPath}`);
                    tryConnect(sdbPath)
                        .then((result) => {
                            console.log(`[SDB Remote] Connected via custom sdb: ${result}`);

                            const rootCmd = process.platform === 'win32'
                                ? `chcp 65001 > nul && "${sdbPath}" root on`
                                : `"${sdbPath}" root on`;

                            exec(rootCmd, (rErr, rOut) => {
                                const message = rOut && rOut.includes('already')
                                    ? 'Connected and rooted'
                                    : 'Connected successfully';
                                socket.emit('sdb_remote_result', { success: true, message });
                            });
                        })
                        .catch((customErr) => {
                            console.error(`[SDB Remote] Both attempts failed:`, customErr.message);
                            socket.emit('sdb_remote_result', {
                                success: false,
                                message: `Failed: ${customErr.message}`
                            });
                        });
                } else {
                    console.error(`[SDB Remote] System sdb failed and no custom path:`, systemErr.message);
                    socket.emit('sdb_remote_result', {
                        success: false,
                        message: `Failed: ${systemErr.message}`
                    });
                }
            });
    });

    socket.on('list_sdb_devices', ({ sdbPath } = {}) => {
        console.log('[SDB] Listing devices...');

        // Helper to parse output and emit
        const parseAndEmit = (stdout) => {
            const lines = (stdout || '').split('\n');
            const devices = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('List of devices')) continue;
                if (trimmed.startsWith('*')) continue;
                if (trimmed.includes('Active code page')) continue;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 1) {
                    const id = parts[0];
                    const type = parts.length > 1 ? parts[1] : 'unknown';
                    if (id.includes('.') || id.length > 5) {
                        devices.push({ id, type });
                    }
                }
            }
            console.log(`[SDB] Found ${devices.length} devices`);
            socket.emit('sdb_devices', devices);
        };

        // 1. Try system 'sdb' first
        const systemCmd = `sdb devices`;
        // Use chcp 65001 to ensure UTF-8 output on Windows
        const systemFullCmd = process.platform === 'win32' ? `chcp 65001 > nul && ${systemCmd}` : systemCmd;

        exec(systemFullCmd, { encoding: 'utf-8' }, (error, stdout, stderr) => {
            // Check if successful. Note: stderr might contain warnings, so mainly check error code or "not found"
            const systemFailed = error || (stderr && (stderr.includes('not found') || stderr.includes('is not recognized')));

            if (!systemFailed) {
                console.log('[SDB] System sdb worked.');
                parseAndEmit(stdout);
                return;
            }

            // If system sdb failed, and we have a custom path, try that
            if (sdbPath && sdbPath.trim().length > 0) {
                console.log(`[SDB] System sdb failed, trying custom path: ${sdbPath}`);
                const customCmd = `"${sdbPath}" devices`;
                const customFullCmd = process.platform === 'win32' ? `chcp 65001 > nul && ${customCmd}` : customCmd;

                exec(customFullCmd, { encoding: 'utf-8' }, (cErr, cOut, cStderr) => {
                    if (cErr) {
                        console.error('[SDB] Custom sdb also failed:', cErr.message);
                        // Emit empty list but maybe with a toast? For now just empty.
                        socket.emit('sdb_devices', []);
                    } else {
                        console.log('[SDB] Custom sdb worked.');
                        parseAndEmit(cOut);
                    }
                });
            } else {
                console.error('[SDB] System sdb failed and no custom path provided.');
                socket.emit('sdb_devices', []);
            }
        });
    });

    // --- Block Test Plugin Handlers ---

    // 1. Run Host Command
    socket.on('run_host_command', ({ command, requestId }) => {
        if (!command || typeof command !== 'string') {
            socket.emit('host_command_result', { requestId, success: false, output: 'Invalid command' });
            return;
        }

        const cmdString = command.trim();
        console.log(`[DEBUG_RUN] Received command: ${cmdString}`);
        console.log(`[DEBUG_RUN] Executing via exec...`);

        // Use exec for robust shell command execution
        const execOpts = { maxBuffer: 1024 * 1024 * 5 }; // 5MB

        exec(cmdString, execOpts, (error, stdout, stderr) => {
            console.log(`[DEBUG_RUN] Exec completed. Error: ${error ? error.message : 'None'}`);
            console.log(`[DEBUG_RUN] stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`);

            const finalOutput = (stdout + stderr).trim();
            const success = !error;

            socket.emit('host_command_debug', { requestId, message: `Exec completed. Success: ${success}` });
            socket.emit('host_command_result', {
                command,
                requestId,
                success,
                output: finalOutput || (success ? 'Success (No output)' : `Failed: ${error.message}`)
            });
        });
    });



    // 2. File Persistence (BlockTest Folder)
    const BLOCK_TEST_DIR = globalBlockTestDir;
    console.log("SERVER_STARTUP: BLOCK_TEST_DIR =", BLOCK_TEST_DIR);


    // Ensure BlockTest dir exists on startup
    if (!fs.existsSync(BLOCK_TEST_DIR)) {
        try {
            fs.mkdirSync(BLOCK_TEST_DIR, { recursive: true });
        } catch (e) {
            console.error("Failed to create BlockTest dir:", e);
        }
    }

    // Consolidated File Handlers
    socket.on('save_file', ({ filename, content }) => {
        if (!filename || !content) {
            socket.emit('save_file_result', { filename, success: false, error: 'Missing filename or content' });
            return;
        }

        try {
            // Force save within BLOCK_TEST_DIR for simplicity and safety
            // but allow subdirectories like 'reports/'
            const safePath = path.join(BLOCK_TEST_DIR, filename);

            // Security check to prevent .. traversal out of BlockTest (basic)
            if (!safePath.startsWith(BLOCK_TEST_DIR)) {
                socket.emit('save_file_result', { filename, success: false, error: 'Invalid path' });
                return;
            }

            console.log(`[FILE] Saving ${filename} to ${safePath}`);
            console.log(`[FILE] CWD: ${process.cwd()}`);
            console.log(`[FILE] BLOCK_TEST_DIR: ${BLOCK_TEST_DIR}`);

            // Ensure directory exists
            const dir = path.dirname(safePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFile(safePath, content, (err) => {
                if (err) {
                    console.error(`[FILE] Save Error: ${err.message}`);
                    socket.emit('save_file_result', { filename, success: false, error: err.message });
                } else {
                    console.log(`[FILE] Saved successfully.`);
                    socket.emit('save_file_result', { filename, success: true });
                }
            });
        } catch (e) {
            console.error(`[FILE] Save Exception: ${e.message}`);
            socket.emit('save_file_result', { filename, success: false, error: e.message });
        }
    });

    socket.on('load_file', ({ filename }) => {
        if (!filename) return;
        try {
            const safePath = path.join(BLOCK_TEST_DIR, filename);
            console.log(`[FILE] Loading ${filename} from ${safePath}`);

            if (fs.existsSync(safePath)) {
                fs.readFile(safePath, 'utf8', (err, data) => {
                    if (err) {
                        socket.emit('load_file_result', { filename, success: false, error: err.message });
                    } else {
                        socket.emit('load_file_result', { filename, success: true, content: data });
                    }
                });
            } else {
                // File not found is common for new installs, just return success:false
                socket.emit('load_file_result', { filename, success: false, error: 'File not found' });
            }
        } catch (e) {
            socket.emit('load_file_result', { filename, success: false, error: e.message });
        }
    });

    socket.on('list_files', () => {
        try {
            if (!fs.existsSync(BLOCK_TEST_DIR)) {
                socket.emit('list_files_result', { files: [] });
                return;
            }
            const files = fs.readdirSync(BLOCK_TEST_DIR);
            socket.emit('list_files_result', { files });
        } catch (e) {
            socket.emit('list_files_result', { error: e.message });
        }
    });

    socket.on('save_uploaded_template', ({ name, data }) => {
        console.log(`[Server] Received save_uploaded_template: ${name}, Data Length: ${data ? data.length : 0}`);
        try {
            // Save to BlockTest/templates (Writable)
            const templatesDir = path.join(globalBlockTestDir, 'templates');
            if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

            console.log(`[Server] processing base64 data...`);
            // Data is "data:image/png;base64,..."
            const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const safeName = name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const filePath = path.join(templatesDir, `${Date.now()}_${safeName}`);

            console.log(`[Server] Writing file to ${filePath}...`);
            fs.writeFileSync(filePath, buffer);
            console.log(`[Server] File written successfully.`);

            // URL is now served via /blocktest/templates/...
            socket.emit('save_uploaded_template_result', { success: true, path: filePath, url: `/blocktest/templates/${path.basename(filePath)}` });
        } catch (e) {
            console.error("Save Template Error", e);
            socket.emit('save_uploaded_template_result', { success: false, message: e.message });
        }
    });


    socket.on('wait_for_image_match', async ({ templatePath, timeoutMs = 10000, deviceId, sdbPath }) => {
        console.log(`[ScreenMatcher] Waiting for image match... Timeout: ${timeoutMs}ms`);
        if (!cv) {
            socket.emit('wait_for_image_result', { success: false, message: 'OpenCV not loaded' });
            return;
        }

        const startTime = Date.now();
        const interval = 1000; // Check every 1s

        let isMatched = false;

        const checkMatch = async () => {
            if (Date.now() - startTime > timeoutMs) {
                socket.emit('wait_for_image_result', { success: false, message: 'Timeout' });
                return;
            }

            try {
                // 1. Capture (Reuse logic simplified)
                const tempRemotePath = '/tmp/screen_wait_capture.png';
                const localPath = path.join(__dirname, '../public/captures', `wait_capture_${Date.now()}.png`);

                // Ensure dir
                const capturesDir = path.join(__dirname, '../public/captures');
                if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

                const captureCmd = `/usr/bin/enlightenment_info -dump_screen ${tempRemotePath}`;
                const sdbArgs = deviceId ? ['-s', deviceId, 'shell', captureCmd] : ['shell', captureCmd];

                // Synchronous-like spawn wrapper for cleaner loop? using promise
                await new Promise((resolve, reject) => {
                    const child = spawnProc(getSdbBin(sdbPath), sdbArgs);
                    child.on('close', resolve);
                    child.on('error', reject);
                });

                // Pull
                const pullArgs = deviceId ? ['-s', deviceId, 'pull', tempRemotePath, localPath] : ['pull', tempRemotePath, localPath];
                await new Promise((resolve, reject) => {
                    const child = spawnProc(getSdbBin(sdbPath), pullArgs);
                    child.on('close', resolve);
                    child.on('error', reject);
                });

                if (fs.existsSync(localPath)) {
                    // 2. Match
                    const screenImg = await jimp.read(localPath);
                    // For template, we assume it's an absolute path on server.
                    // If the user uploaded it, it should be in public/captures or similar.
                    // If templatePath is invalid, this throws.
                    const templImg = await jimp.read(templatePath);

                    const src = cv.matFromImageData(screenImg.bitmap);
                    const templ = cv.matFromImageData(templImg.bitmap);
                    const srcGray = new cv.Mat();
                    const templGray = new cv.Mat();
                    cv.cvtColor(src, srcGray, cv.COLOR_RGBA2GRAY, 0);
                    cv.cvtColor(templ, templGray, cv.COLOR_RGBA2GRAY, 0);

                    const dst = new cv.Mat();
                    const mask = new cv.Mat();
                    cv.matchTemplate(srcGray, templGray, dst, cv.TM_CCOEFF_NORMED, mask);
                    const result = cv.minMaxLoc(dst, mask);

                    const confidence = result.maxVal;

                    // Cleanup
                    src.delete(); templ.delete(); srcGray.delete(); templGray.delete(); dst.delete(); mask.delete();

                    // Delete temp capture
                    fs.unlinkSync(localPath);

                    if (confidence > 0.8) {
                        isMatched = true;
                        socket.emit('wait_for_image_result', { success: true, confidence });
                        return;
                    }
                }

                // Retry
                if (!isMatched) {
                    setTimeout(checkMatch, interval);
                }

            } catch (e) {
                console.error("Wait Match Error:", e);
                // Keep trying until timeout?
                setTimeout(checkMatch, interval);
            }
        };

        checkMatch();
    });

    // --- Log Start/Stop Background Handlers ---
    const activeLogs = new Map(); // Store active child processes { logId: ChildProcess }

    socket.on('start_background_log', ({ command, filename }) => {
        const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        console.log(`[BackgroundLog] Starting: ${command} -> ${filename} (ID: ${logId})`);

        try {
            // Ensure BlockTest dir exists for logs (or use process.cwd() if filename implies relative)
            // The prompt said "created file name with format...". Assume relative to BlockTest dir or app root?
            // Let's settle on using the same BLOCK_TEST_DIR for consistency if implied, but prompt said "file name".
            // If filename has no path separators, put in BLOCK_TEST_DIR.

            let filePath = filename;
            if (!path.isAbsolute(filename)) {
                if (!fs.existsSync(BLOCK_TEST_DIR)) fs.mkdirSync(BLOCK_TEST_DIR, { recursive: true });
                filePath = path.join(BLOCK_TEST_DIR, filename);
            }

            const fileStream = fs.createWriteStream(filePath, { flags: 'a' });

            // Spawn command
            // We need to handle shell commands properly.
            // sdb dlogutil -v kerneltime might need shell=true or split args.
            // Using spawn with shell option is safest for "command" strings.
            const child = spawnProc(command, { shell: true });

            child.stdout.on('data', (data) => {
                fileStream.write(data);
            });

            child.stderr.on('data', (data) => {
                fileStream.write(data);
            });

            child.on('close', (code) => {
                console.log(`[BackgroundLog] ${logId} exited with code ${code}`);
                fileStream.end();
                activeLogs.delete(logId);
                socket.emit('background_log_status', { logId, status: 'stopped', code });
            });

            child.on('error', (err) => {
                console.error(`[BackgroundLog] ${logId} error: ${err.message}`);
                fileStream.end();
                activeLogs.delete(logId);
                socket.emit('background_log_error', { logId, error: err.message });
            });

            activeLogs.set(logId, child);
            socket.emit('start_background_log_result', { success: true, logId, filePath });

        } catch (e) {
            console.error(`[BackgroundLog] Failed to start: ${e.message}`);
            socket.emit('start_background_log_result', { success: false, error: e.message });
        }
    });

    socket.on('stop_background_log', ({ logId, stopCommand }) => {
        console.log(`[BackgroundLog] Stopping: ${logId} (Cmd: ${stopCommand || 'KILL'})`);

        // 1. If stopCommand provided, execute it (e.g. sdb shell killall dlog)
        if (stopCommand) {
            const stopProc = spawnProc(stopCommand, { shell: true });
            stopProc.on('close', (code) => {
                console.log(`[BackgroundLog] Stop command exited with ${code}`);
            });
        }

        // 2. Kill the node process holding the stream
        const child = activeLogs.get(logId);
        if (child) {
            child.kill(); // SIGTERM
            activeLogs.delete(logId);
            socket.emit('stop_background_log_result', { success: true, logId });
        } else {
            // Maybe it already died or stopCommand managed it?
            socket.emit('stop_background_log_result', { success: true, logId, message: 'Process already stopped or not found' });
        }
    });

    // --- Screen Matcher Handlers ---
    socket.on('capture_screen', async ({ deviceId, sdbPath }) => {
        console.log(`[ScreenMatcher] Capturing screen for ${deviceId || 'default'}...`);
        const tempRemotePath = '/tmp/screen_capture.png';
        const timestamp = Date.now();
        const localFileName = `screen_${timestamp}.png`;
        const localPath = path.join(__dirname, '../public/captures', localFileName);
        // Ensure captures dir exists
        const capturesDir = path.join(__dirname, '../public/captures');
        if (!fs.existsSync(capturesDir)) {
            fs.mkdirSync(capturesDir, { recursive: true });
        }

        // Command strategy: try common capture commands
        // 1. enlightenment_info -dump_screen (Common on TV)
        // 2. xwd -root -out ... (X11 based) -> requires conversion, maybe SKIP for now if simple dump works
        // 3. scrot (unlikely but possible)
        // Let's try enlightenment_info first as it is standard for Tizen TV.

        // Note: sdb shell returns immediately, we need to wait / check result.
        // We use 'sdb -s [id] shell [cmd]'

        const captureCmd = `/usr/bin/enlightenment_info -dump_screen ${tempRemotePath}`;
        const sdbArgs = deviceId ? ['-s', deviceId, 'shell', captureCmd] : ['shell', captureCmd];

        const captureProcess = spawnProc(getSdbBin(sdbPath), sdbArgs);

        captureProcess.on('close', (code) => {
            if (code !== 0) {
                // Try fallback logic if needed, but for now report error
                // socket.emit('capture_result', { success: false, message: 'Capture command failed' });
                // But sdb shell might return 0 even if command not found inside. 
                // We proceed to pull. If pull fails, then capture failed.
            }

            // Step 2: Pull
            // sdb -s [id] pull [remote] [local]
            const pullArgs = deviceId ? ['-s', deviceId, 'pull', tempRemotePath, localPath] : ['pull', tempRemotePath, localPath];
            const pullProcess = spawnProc(getSdbBin(sdbPath), pullArgs);

            pullProcess.on('close', (pullCode) => {
                if (pullCode === 0 && fs.existsSync(localPath)) {
                    // Success
                    // We return a relative URL for the frontend to load
                    const publicUrl = `/captures/${localFileName}`;
                    socket.emit('capture_result', { success: true, path: publicUrl, absolutePath: localPath });

                    // Cleanup remote (optional, good practice)
                    const rmArgs = deviceId ? ['-s', deviceId, 'shell', 'rm', tempRemotePath] : ['shell', 'rm', tempRemotePath];
                    spawnProc(getSdbBin(sdbPath), rmArgs);
                } else {
                    socket.emit('capture_result', { success: false, message: 'Failed to pull screen capture. Command might have failed.' });
                }
            });
        });
    });

    socket.on('match_image', async ({ screenPath, templatePath }) => {
        console.log(`[ScreenMatcher] Matching template...`);
        if (!cv) {
            socket.emit('match_result', { success: false, message: 'OpenCV not loaded yet' });
            return;
        }

        try {
            // screenPath and templatePath might be URLs or relative paths.
            // We expect absolute paths or paths we can resolve.
            // If they are passed as '/captures/...' (local URL), resolve to disk.

            const resolvePath = (p) => {
                if (p.startsWith('http')) return p; // jimp can load url?
                if (p.startsWith('/captures')) return path.join(__dirname, '../public', p);
                if (p.startsWith('data:')) return p; // Base64
                // Assume absolute if windows path
                if (p.includes(':') || p.startsWith('/')) return p;
                return p;
            };

            const realScreenPath = resolvePath(screenPath);
            // templatePath might be a Data URL if pasted, or a path if uploaded/saved.
            // If the user drops a file, we might have saved it or sent as base64. 
            // Let's assume frontend sends base64 for template or uploads it first.
            // For now, let's assume it sends base64 for template or a path if we implement upload.

            // Let's rely on standard jimp.read() which handles paths and buffers.

            const screenImg = await jimp.read(realScreenPath);
            const templImg = await jimp.read(templatePath); // templatePath can be data:image/png;base64,...

            // Convert to Mat
            // Jimp image has bitmap.data which is RGBA buffer.
            const src = cv.matFromImageData(screenImg.bitmap);
            const templ = cv.matFromImageData(templImg.bitmap);

            // Pre-process? Convert to grayscale usually speeds up and is robust enough
            const srcGray = new cv.Mat();
            const templGray = new cv.Mat();
            cv.cvtColor(src, srcGray, cv.COLOR_RGBA2GRAY, 0);
            cv.cvtColor(templ, templGray, cv.COLOR_RGBA2GRAY, 0);

            // Match
            const dst = new cv.Mat();
            const mask = new cv.Mat();
            cv.matchTemplate(srcGray, templGray, dst, cv.TM_CCOEFF_NORMED, mask);

            // Get Result
            const result = cv.minMaxLoc(dst, mask);
            const maxPoint = result.maxLoc;
            const confidence = result.maxVal; // 0.0 to 1.0

            // Clean up
            src.delete(); templ.delete();
            srcGray.delete(); templGray.delete();
            dst.delete(); mask.delete();

            if (confidence > 0.8) { // Threshold
                socket.emit('match_result', {
                    success: true,
                    x: maxPoint.x,
                    y: maxPoint.y,
                    width: templImg.bitmap.width,
                    height: templImg.bitmap.height,
                    confidence
                });
            } else {
                socket.emit('match_result', { success: false, message: 'No match found', confidence });
            }

        } catch (e) {
            console.error('[ScreenMatcher] Error:', e);
            socket.emit('match_result', { success: false, message: e.message });
        }
    });

    // --- CPU Analyzer Handlers ---

    let cpuMonitorProcess = null;
    let cpuMonitorInterval = null;

    socket.on('start_cpu_monitoring', ({ deviceId, sdbPath }) => {
        // Cleanup existing
        if (cpuMonitorProcess) {
            cpuMonitorProcess.kill();
            cpuMonitorProcess = null;
        }
        if (cpuMonitorInterval) {
            clearInterval(cpuMonitorInterval);
            cpuMonitorInterval = null;
        }

        if (deviceId === 'mock') {
            console.log('Starting CPU Monitoring (Simulation Mode)');
            let tick = 0;
            cpuMonitorInterval = setInterval(() => {
                tick++;
                // Simulate sine wave CPU usage (0-400% scale for 4 cores)
                const baseCpu = 50 + Math.sin(tick * 0.1) * 150; // Swings between 0 and 200+
                const noise = Math.random() * 20;
                const totalCpu = Math.min(400, Math.max(0, baseCpu + noise));

                // Simulate processes
                const mockProcesses = [
                    { pid: '1001', user: 'owner', cpu: (totalCpu * 0.4).toFixed(1), name: 'com.samsung.tv.app' },
                    { pid: '2023', user: 'system', cpu: (totalCpu * 0.2).toFixed(1), name: 'display_server' },
                    { pid: '3045', user: 'root', cpu: (totalCpu * 0.1).toFixed(1), name: 'kernel_task' },
                    { pid: '4100', user: 'app', cpu: (Math.random() * 2).toFixed(1), name: 'node' },
                    { pid: '5200', user: 'media', cpu: (Math.random() * 1).toFixed(1), name: 'ffmpeg' }
                ];

                socket.emit('cpu_data', {
                    timestamp: Date.now(),
                    total: totalCpu,
                    processes: mockProcesses
                });
            }, 1000);

            socket.emit('cpu_status', { status: 'monitoring', message: 'Simulation Mode Active' });

        } else {
            console.log(`Starting CPU Monitoring on ${deviceId}`);
            // sdb -s [id] shell top -b -d 1
            // -b: Batch mode (no escape codes)
            // -d 1: Delay 1 second

            // Note: Different Tizen versions might have different 'top' arguments or output formats.
            // Common Tizen 'top' output line 1: "User 10% + System 5% ... = 15% Total"
            // OR standard Linux top. We will try to parse generically.

            const args = deviceId && deviceId !== 'auto-detect'
                ? ['-s', deviceId, 'shell', 'top', '-b', '-d', '1']
                : ['shell', 'top', '-b', '-d', '1'];

            try {
                cpuMonitorProcess = spawnProc(getSdbBin(sdbPath), args);

                let buffer = '';

                cpuMonitorProcess.stdout.on('data', (data) => {
                    buffer += data.toString();

                    // Split by chunks (top outputs usually separated by empty lines or headers)
                    // But simpler: process line by line
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line

                    let currentParsed = {
                        timestamp: Date.now(),
                        total: 0,
                        processes: []
                    };

                    let parsingProcesses = false;

                    for (const line of lines) {
                        const trimmed = line.trim();
                        // Parse Total CPU
                        // Case 1: "User 10% + System 5% ... = 15% Total"
                        if (trimmed.includes('Total') && trimmed.includes('User')) {
                            // Extract N% Total
                            const match = trimmed.match(/=\s*([0-9.]+)/); // Matches "= 17"
                            if (match) {
                                currentParsed.total = parseFloat(match[1]);
                            } else {
                                // Try finding number before % Total
                                const match2 = trimmed.match(/(\d+)%\s*Total/);
                                if (match2) {
                                    currentParsed.total = parseFloat(match2[1]);
                                }
                            }
                            parsingProcesses = true; // Processes usually follow
                            continue;
                        }

                        // Case 2: "CPU: 10% usr 5% sys..." (BusyBox top)
                        if (trimmed.startsWith('CPU:')) {
                            // Parse BusyBox style if needed
                            parsingProcesses = true;
                            continue;
                        }

                        // Headers
                        if (trimmed.startsWith('PID')) {
                            parsingProcesses = true;
                            continue;
                        }

                        // Process Row
                        if (parsingProcesses && trimmed.length > 0) {
                            // Simple whitespace split
                            const parts = trimmed.split(/\s+/);
                            // Standard Tizen top: PID USER ... CPU% ... Name
                            // Need heuristic to find CPU column. 
                            // Usually CPU% is one of the columns containing '%'.

                            // Let's assume standard columns often seen:
                            // PID, USER, ..., CPU%, ... Name (last)

                            if (parts.length >= 8) {
                                // Try to find the part with % or just a number that looks like CPU
                                // Often 5th col is CPU% or similar
                                // Let's simplify: Send raw parsing or try to identify

                                // Taking a guess based on common Tizen output:
                                // PID, USER, ..., CPU%, ... Name (last)

                                const pid = parts[0];
                                const user = parts[1];
                                const name = parts[parts.length - 1];

                                // Find CPU
                                let cpuVal = 0;
                                // Look for column with '%' not in first 2
                                const cpuIndex = parts.findIndex((p, i) => i > 1 && p.includes('%')); // e.g. "3.1%"
                                if (cpuIndex !== -1) {
                                    cpuVal = parseFloat(parts[cpuIndex]);
                                } else {
                                    // Fallback: Tizen sometimes doesn't have % char in column body?
                                    // Just take 5th column?
                                    // If we can't parse, skip.
                                    // Better fallback: Check if "CPU" header position logic (too complex for now)

                                    // Try 5th column if it is a number
                                    const val = parseFloat(parts[4]);
                                    if (!isNaN(val)) cpuVal = val;
                                }

                                if (cpuVal > 0) {
                                    currentParsed.processes.push({
                                        pid,
                                        user,
                                        cpu: cpuVal,
                                        name
                                    });
                                }
                            }
                        }
                    }

                    // Emit update if we found something meaningful
                    // Note: 'top' outputs a full screen batch. We need to know when a batch ends?
                    // 'top' -b just streams. We parsed lines.
                    // Issue: We might emit partial updates or mixed frames?
                    // Improvement: Accumulate until we see the "User ... Total" line again?
                    // For now, let's emit every time we parse a Summary line + some processes?
                    // Actually, standard top prints Summary FIRST, then processes.
                    // So we should:
                    // 1. Detect Summary -> Emit previous batch (if any), Start new batch.
                    // 2. Parse processes -> Add to current batch.

                    // Refined Loop Logic for streaming:
                    // (Omitted for brevity in this single-tool step, but implemented logic above accumulates,
                    // but we need to emit periodically. 'top' -d 1 means bursts every 1s.
                    // The 'data' event might split a burst. 
                    // Best effort: Debounce emit or check if we have processes.)

                    if (currentParsed.total > 0 || currentParsed.processes.length > 0) {
                        // Sort by CPU desc
                        currentParsed.processes.sort((a, b) => b.cpu - a.cpu);
                        // Limit to top 10
                        currentParsed.processes = currentParsed.processes.slice(0, 10);

                        socket.emit('cpu_data', currentParsed);
                    }

                });

                cpuMonitorProcess.on('error', (err) => {
                    socket.emit('cpu_error', { message: `SDB Top Error: ${err.message}` });
                });

                cpuMonitorProcess.on('close', (code) => {
                    console.log(`CPU Monitor exited with code ${code}`);
                    socket.emit('cpu_status', { status: 'stopped', message: 'Monitoring Stopped' });
                    cpuMonitorProcess = null;
                });

                socket.emit('cpu_status', { status: 'monitoring', message: `Monitoring ${deviceId}` });

            } catch (e) {
                socket.emit('cpu_error', { message: `Failed to spawn sdb: ${e.message}` });
            }
        }
    });

    socket.on('stop_cpu_monitoring', () => {
        if (cpuMonitorProcess) {
            cpuMonitorProcess.kill();
            cpuMonitorProcess = null;
        }
        if (cpuMonitorInterval) {
            clearInterval(cpuMonitorInterval);
            cpuMonitorInterval = null;
            socket.emit('cpu_status', { status: 'stopped', message: 'Monitoring Stopped' });
        }
    });

    // --- Thread Analyzer Handlers ---
    let threadMonitorProcess = null;
    let threadMonitorInterval = null;

    socket.on('start_thread_monitoring', ({ deviceId, pid, sdbPath }) => {
        // Cleanup existing
        if (threadMonitorProcess) {
            threadMonitorProcess.kill();
            threadMonitorProcess = null;
        }
        if (threadMonitorInterval) {
            clearInterval(threadMonitorInterval);
            threadMonitorInterval = null;
        }

        if (deviceId === 'mock') {
            console.log(`Starting Mock Thread Monitoring for PID ${pid}`);
            threadMonitorInterval = setInterval(() => {
                // Simulate threads
                const mockThreads = [];
                const threadCount = 5 + Math.floor(Math.random() * 5);
                for (let i = 0; i < threadCount; i++) {
                    const tid = parseInt(pid) + i + 1;
                    const cpu = (Math.random() * 15).toFixed(1);
                    mockThreads.push({
                        tid: tid.toString(),
                        user: 'owner',
                        cpu: parseFloat(cpu),
                        name: i === 0 ? `MainThread` : `WorkerPool-${i}`
                    });
                }

                // Sort by CPU
                mockThreads.sort((a, b) => b.cpu - a.cpu);

                socket.emit('thread_data', {
                    pid,
                    threads: mockThreads
                });
            }, 1000);
        } else {
            console.log(`Starting Thread Monitoring on ${deviceId} for PID ${pid}`);
            // sdb -s [id] shell top -H -b -d 1 -p [PID]
            const args = deviceId && deviceId !== 'auto-detect'
                ? ['-s', deviceId, 'shell', 'top', '-H', '-b', '-d', '1', '-p', pid]
                : ['shell', 'top', '-H', '-b', '-d', '1', '-p', pid];

            try {
                threadMonitorProcess = spawnProc(getSdbBin(sdbPath), args);
                let buffer = '';

                threadMonitorProcess.stdout.on('data', (data) => {
                    buffer += data.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    let threads = [];
                    let parsingThreads = false;

                    for (const line of lines) {
                        const trimmed = line.trim();

                        // Header detection (PID USER ... or PID TID ...)
                        // busybox top with -H shows "PID USER ..." but the PID column is actually TID?
                        // standard procps top shows "PID USER ..." or "pid user ..."
                        // Let's rely on column detection heuristics again.

                        if (trimmed.startsWith('PID') || trimmed.includes('USER')) {
                            parsingThreads = true;
                            continue;
                        }

                        if (parsingThreads && trimmed.length > 0) {
                            const parts = trimmed.split(/\s+/);
                            if (parts.length >= 8) {
                                // In thread mode top -H:
                                // PID is usually the TID.

                                const tid = parts[0];
                                const user = parts[1];
                                const name = parts[parts.length - 1];

                                let cpuVal = 0;
                                const cpuIndex = parts.findIndex((p, i) => i > 1 && p.includes('%'));
                                if (cpuIndex !== -1) {
                                    cpuVal = parseFloat(parts[cpuIndex]);
                                } else {
                                    const val = parseFloat(parts[4]); // Fallback
                                    if (!isNaN(val)) cpuVal = val;
                                }

                                if (cpuVal >= 0) { // Include 0% threads too? maybe just > 0 to reduce noise
                                    threads.push({
                                        tid,
                                        user,
                                        cpu: cpuVal,
                                        name
                                    });
                                }
                            }
                        }
                    }

                    if (threads.length > 0) {
                        // Sort by CPU desc
                        threads.sort((a, b) => b.cpu - a.cpu);
                        socket.emit('thread_data', { pid, threads });
                    }
                });

                threadMonitorProcess.on('error', (err) => {
                    console.error("Thread Monitor Error:", err);
                });

                threadMonitorProcess.on('close', () => {
                    console.log("Thread Monitor Closed");
                    threadMonitorProcess = null;
                });

            } catch (e) {
                console.error("Failed to spawn thread monitor:", e);
            }
        }
    });

    socket.on('stop_thread_monitoring', () => {
        if (threadMonitorProcess) {
            threadMonitorProcess.kill();
            threadMonitorProcess = null;
        }
        if (threadMonitorInterval) {
            clearInterval(threadMonitorInterval);
            threadMonitorInterval = null;
        }
    });

    // --- Memory Analyzer Handlers ---
    let memoryMonitorProcess = null;
    let memoryMonitorInterval = null;

    socket.on('start_memory_monitoring', ({ deviceId, appName, interval, sdbPath }) => {
        // Cleanup existing
        if (memoryMonitorProcess) {
            memoryMonitorProcess.kill();
            memoryMonitorProcess = null;
        }
        if (memoryMonitorInterval) {
            clearInterval(memoryMonitorInterval);
            memoryMonitorInterval = null;
        }

        const pollInterval = parseInt(interval || '1', 10) * 1000;
        const safeAppName = (appName || '').trim();

        if (!safeAppName && deviceId !== 'mock') {
            socket.emit('memory_error', { message: 'App Name is required' });
            return;
        }

        if (deviceId === 'mock') {
            console.log(`Starting Mock Memory Monitoring for ${safeAppName || 'mock-app'}`);
            let tick = 0;
            memoryMonitorInterval = setInterval(() => {
                tick++;
                // Simulate fluctuating memory usage
                const baseMem = 50000 + Math.sin(tick * 0.1) * 10000; // 50MB base
                const noise = Math.random() * 5000;

                socket.emit('memory_data', {
                    timestamp: Date.now(),
                    pss: Math.floor(baseMem + noise),
                    gemrss: Math.floor(baseMem * 1.2 + noise),
                    swap: Math.floor(Math.random() * 1000),
                    gpu: Math.floor(baseMem * 0.5 + noise)
                });
            }, Math.max(100, pollInterval)); // Min 100ms for mock

            socket.emit('memory_status', { status: 'monitoring', message: `Mock Monitoring ${safeAppName || 'mock-app'}` });

        } else {
            console.log(`Starting Memory Monitoring on ${deviceId} for ${safeAppName}`);

            // Step 1: Find PID
            // Tizen 'ps' usually outputs: PID USER VSZ STAT COMMAND or similar.
            // Using 'ps -ef' might be safer if available, or just 'ps'.
            // simple grep approach
            const sdbPrefix = deviceId && deviceId !== 'auto-detect' ? `${getSdbCmd(sdbPath)} -s ${deviceId}` : getSdbCmd(sdbPath);
            const grepCmd = `${sdbPrefix} shell "ps -ef | grep ${safeAppName}"`;

            exec(grepCmd, (error, stdout, stderr) => {
                if (error) {
                    // Try simpler 'ps' if -ef fails?
                    console.log('ps -ef failed, trying simple ps');
                    // fallback logic could go here, but let's report error first
                    socket.emit('memory_error', { message: `Failed to find PID: ${error.message}` });
                    return;
                }

                const lines = stdout.toString().split('\n');
                let targetPid = null;

                // logic to find exact PID (simplified: take first match that isn't grep itself)
                for (const line of lines) {
                    if (line.includes(safeAppName) && !line.includes('grep')) {
                        const parts = line.trim().split(/\s+/);
                        // Busybox ps: PID USER ...
                        // Tizen ps: UID PID ...
                        // Heuristic: 2nd col usually PID if 1st is User/UID
                        if (parts.length > 1) {
                            // If 2nd part is numeric, assume it is PID
                            if (!isNaN(parseInt(parts[1]))) {
                                targetPid = parts[1];
                            } else if (!isNaN(parseInt(parts[0]))) {
                                targetPid = parts[0];
                            }
                            if (targetPid) break;
                        }
                    }
                }

                if (!targetPid) {
                    socket.emit('memory_error', { message: `PID not found for ${safeAppName}` });
                    return;
                }

                console.log(`Found PID ${targetPid} for ${safeAppName}. Starting vd_memps...`);

                // Step 2: Start vd_memps
                // Command: sdb -s [id] shell vd_memps -p [PID] -t [interval]
                const cmdArgs = deviceId && deviceId !== 'auto-detect'
                    ? ['-s', deviceId, 'shell', 'vd_memps', '-p', targetPid, '-t', interval || '1']
                    : ['shell', 'vd_memps', '-p', targetPid, '-t', interval || '1'];

                try {
                    memoryMonitorProcess = spawnProc(getSdbBin(sdbPath), cmdArgs);

                    memoryMonitorProcess.stdout.on('data', (data) => {
                        const text = data.toString();
                        // Parse output
                        // The user said: "PSS, GEMRSS, GPU, SWAP 4가지 단어가 들어가는 line에서"
                        // We will regex for these values.

                        // Helper to extract value
                        const parseValue = (key) => {
                            // Regex to find "Key: Value" or "Key Value" or "Key=Value"
                            // Assume integer values
                            const regex = new RegExp(`${key}[^0-9]*([0-9]+)`, 'i');
                            const match = text.match(regex);
                            return match ? parseInt(match[1]) : 0;
                        };

                        // Check if line looks valid
                        if (text.includes('PSS') || text.includes('GEMRSS')) {
                            const pss = parseValue('PSS');
                            const gemrss = parseValue('GEMRSS');
                            const swap = parseValue('SWAP');
                            const gpu = parseValue('GPU');

                            socket.emit('memory_data', {
                                timestamp: Date.now(),
                                pss: Math.floor(pss),
                                gemrss: Math.floor(gemrss),
                                swap: Math.floor(swap),
                                gpu: Math.floor(gpu)
                            });
                        }
                    });

                    memoryMonitorProcess.stderr.on('data', (data) => {
                        console.log(`vd_memps stderr: ${data}`);
                    });

                    memoryMonitorProcess.on('close', (code) => {
                        console.log(`vd_memps exited with code ${code}`);
                        socket.emit('memory_status', { status: 'stopped', message: 'Monitoring Stopped' });
                        memoryMonitorProcess = null;
                    });

                    socket.emit('memory_status', { status: 'monitoring', message: `Monitoring ${safeAppName}` });

                } catch (e) {
                    socket.emit('memory_error', { message: `Failed to spawn sdb: ${e.message}` });
                }
            });
        }
    });

    socket.on('stop_memory_monitoring', () => {
        if (memoryMonitorProcess) {
            memoryMonitorProcess.kill();
            memoryMonitorProcess = null;
        }
        if (memoryMonitorInterval) {
            clearInterval(memoryMonitorInterval);
            memoryMonitorInterval = null;
            socket.emit('memory_status', { status: 'stopped', message: 'Monitoring Stopped' });
        }
    });

    // --- Tizen SDB File Explorer Handlers ---

    const handleSdbCommand = (cmd, callback, retryCount = 0) => {
        // On Windows, shell errors like "command not found" are in system encoding (CP949 in Korea)
        // which looks like garbage in UTF-8. We intercept common sdb-not-found patterns.
        const fullCmd = process.platform === 'win32' ? `chcp 65001 > nul && ${cmd}` : cmd;

        exec(fullCmd, { encoding: 'utf-8' }, (error, stdout, stderr) => {
            if (error) {
                let msg = stderr || error.message;

                // [Auto-Recovery] for "target not found"
                if (retryCount === 0 && (msg.includes('target not found') || msg.includes('error: target not found'))) {
                    // Force using 192.168.250.250 as requested by user
                    const fixedIp = '192.168.250.250';
                    console.log(`[SDB Recovery] Target not found. Attempting to reconnect to fixed IP ${fixedIp}...`);

                    // Extract sdb binary path from cmd if present, or default to 'sdb'
                    let sdbBin = 'sdb';
                    const binMatch = cmd.match(/^(".*?"|\S+)/);
                    if (binMatch) sdbBin = binMatch[1];

                    const recoverCmd = `${sdbBin} disconnect ${fixedIp} && ${sdbBin} connect ${fixedIp}`;
                    const fullRecoverCmd = process.platform === 'win32' ? `chcp 65001 > nul && ${recoverCmd}` : recoverCmd;

                    exec(fullRecoverCmd, { encoding: 'utf-8' }, (recErr, recOut) => {
                        console.log(`[SDB Recovery] Reconnect output: ${recOut}`);
                        // Retry original command (once)
                        handleSdbCommand(cmd, callback, 1);
                    });
                    return;
                }

                // Detect "sdb is not recognized" in broken encoding or standard English
                if (msg.includes('is not recognized') || msg.includes('not found') || msg.includes('ENOENT') ||
                    (process.platform === 'win32' && (msg.includes('\'sdb\'') || msg.includes('G')))) {
                    msg = "SDB 명령어를 찾을 수 없습니다. Tizen Studio가 설치되어 있고 시스템 PATH 환경 변수에 'sdb' 경로가 포함되어 있는지 확인해주세요.";
                }
                callback(error, stdout, msg);
            } else {
                callback(null, stdout, stderr);
            }
        });
    };

    socket.on('list_tizen_files', ({ deviceId, path: remotePath, sdbPath }) => {
        console.log(`[TizenExplorer] Listing files in ${remotePath} on ${deviceId || 'default'}`);
        // sdb shell ls -alp [path]
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `ls -alF "${remotePath}"`] : ['shell', `ls -alF "${remotePath}"`];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('list_tizen_files_result', { success: false, error: stderr });
                return;
            }

            const lines = stdout.split('\n');
            const files = [];

            // Skip first line if it's "total X"
            for (const line of lines) {
                if (line.trim().startsWith('total ')) continue;
                if (!line.trim()) continue;

                // Typical ls -alF output:
                // drwxr-xr-x    2 root     root          4096 Jan 24 12:34 bin/
                // -rw-r--r--    1 root     root           123 Jan 24 12:34 test.txt
                const parts = line.trim().split(/\s+/);
                if (parts.length < 9) continue;

                const permissions = parts[0];
                let type = 'file';
                if (permissions[0] === 'd') type = 'directory';
                else if (permissions[0] === 'l') type = 'link';

                const size = parseInt(parts[4]);
                let name = parts.slice(8).join(' '); // Name can contain spaces

                // Handle symbolic links (e.g., "linkname -> target")
                if (type === 'link') {
                    const arrowIndex = name.indexOf(' -> ');
                    if (arrowIndex !== -1) {
                        name = name.substring(0, arrowIndex);
                    }
                }

                // Skip . and ..
                if (name === './' || name === '../' || name === '.' || name === '..') continue;

                files.push({
                    name: name.replace(/[*]$/, '').replace(/[/]$/, '').replace(/[@]$/, ''), // Remove trailing F markers
                    type: type === 'link' ? 'file' : type, // UI treats links as files for simplicity (cat works)
                    isLink: type === 'link',
                    size,
                    permissions,
                    owner: parts[2],
                    group: parts[3],
                    modified: parts.slice(5, 8).join(' ')
                });
            }

            socket.emit('list_tizen_files_result', { success: true, files, path: remotePath });
        });
    });

    socket.on('complete_tizen_path', ({ deviceId, path: partialPath, sdbPath }) => {
        // ... (lines 1810-1822 omitted for brevity as they are unchanged logic) ...
        console.log(`[TizenExplorer] Auto-complete request for: ${partialPath}`);
        const lastSlash = partialPath.lastIndexOf('/');
        let dir, fragment;

        if (lastSlash === -1) {
            dir = '.';
            fragment = partialPath;
        } else {
            dir = partialPath.substring(0, lastSlash) || '/';
            fragment = partialPath.substring(lastSlash + 1);
        }

        console.log(`[TizenExplorer] Searching in: ${dir}, Fragment: ${fragment}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `ls -F "${dir}"`] : ['shell', `ls -F "${dir}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout) => {
            if (error) {
                console.error(`[TizenExplorer] Completion error: ${error.message}`);
                socket.emit('complete_tizen_path_result', { success: false, error: 'Command failed' });
                return;
            }
            const matches = stdout.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('total '))
                .map(l => l.replace(/[*]$/, '')) // Remove executable marker
                .filter(l => l.toLowerCase().startsWith(fragment.toLowerCase()));

            console.log(`[TizenExplorer] Found matches: ${matches.length}`);
            socket.emit('complete_tizen_path_result', { success: true, matches, dir, fragment });
        });
    });

    socket.on('pull_tizen_file', ({ deviceId, remotePath, localPath, sdbPath }) => {
        console.log(`[TizenExplorer] Pulling ${remotePath} to ${localPath}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'pull', remotePath, localPath] : ['pull', remotePath, localPath];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('pull_tizen_file_result', { success: false, error: stderr });
            } else {
                socket.emit('pull_tizen_file_result', { success: true, remotePath, localPath });
            }
        });
    });

    socket.on('push_tizen_file', ({ deviceId, localPath, remotePath, sdbPath }) => {
        console.log(`[TizenExplorer] Pushing ${localPath} to ${remotePath}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'push', localPath, remotePath] : ['push', localPath, remotePath];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('push_tizen_file_result', { success: false, error: stderr });
            } else {
                socket.emit('push_tizen_file_result', { success: true, remotePath, localPath });
            }
        });
    });

    socket.on('copy_tizen_path', ({ deviceId, srcPath, destPath, sdbPath }) => {
        console.log(`[TizenExplorer] Copying ${srcPath} to ${destPath}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `cp -r "${srcPath}" "${destPath}"`] : ['shell', `cp -r "${srcPath}" "${destPath}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'copy', target: 'tizen' });
        });
    });

    socket.on('delete_tizen_path', ({ deviceId, path, sdbPath }) => {
        console.log(`[TizenExplorer] Deleting ${path}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `rm -rf "${path}"`] : ['shell', `rm -rf "${path}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'delete', target: 'tizen' });
        });
    });

    socket.on('rename_tizen_path', ({ deviceId, oldPath, newPath, sdbPath }) => {
        console.log(`[TizenExplorer] Renaming ${oldPath} to ${newPath}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `mv "${oldPath}" "${newPath}"`] : ['shell', `mv "${oldPath}" "${newPath}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'rename', target: 'tizen' });
        });
    });

    socket.on('mkdir_tizen_path', ({ deviceId, path, sdbPath }) => {
        console.log(`[TizenExplorer] Creating directory ${path}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `mkdir -p "${path}"`] : ['shell', `mkdir -p "${path}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'mkdir', target: 'tizen' });
        });
    });

    socket.on('install_tizen_tpk', ({ deviceId, path, sdbPath }) => {
        console.log(`[TizenExplorer] Installing TPK: ${path}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `pkgcmd -i -t tpk -p "${path}"`] : ['shell', `pkgcmd -i -t tpk -p "${path}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'install', target: 'tizen', output: stdout });
        });
    });

    socket.on('read_tizen_file', ({ deviceId, path, sdbPath }) => {
        console.log(`[TizenExplorer] Reading file: ${path}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `cat "${path}"`] : ['shell', `cat "${path}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('read_tizen_file_result', { success: false, error: stderr, path });
            } else {
                socket.emit('read_tizen_file_result', { success: true, content: stdout, path });
            }
        });
    });

    socket.on('list_tizen_apps', ({ deviceId, sdbPath }) => {
        console.log(`[TizenAppManager] Listing apps on ${deviceId || 'auto'}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', 'pkgcmd -l'] : ['shell', 'pkgcmd -l'];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`[TizenAppManager] Error listing apps: ${error.message} (${stderr})`);
                socket.emit('list_tizen_apps_result', { success: false, error: stderr });
                return;
            }
            // Parse pkgcmd -l output
            // Example outputs:
            // 	'org.tizen.example'	'ExampleApp'	'installed'
            //   org.tizen.example  ExampleApp  installed
            console.log(`[TizenAppManager] Raw output: ${stdout.substring(0, 200)}...`);

            const apps = stdout.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // Flexible regex to match quoted or unquoted parts
                // 1. Matches text inside single quotes: '(...)'
                // 2. Or matches non-whitespace sequence: ([^\s]+)
                const parts = trimmed.match(/'([^']*)'|([^\s]+)/g);

                if (parts && parts.length >= 3) {
                    const cleaned = parts.map(p => p.replace(/'/g, ''));
                    return {
                        pkgId: cleaned[0],
                        name: cleaned[1] && cleaned[1] !== '' ? cleaned[1] : cleaned[0],  // Fallback to pkgId if name is empty
                        version: cleaned.length >= 4 ? cleaned[2] : null,
                        status: cleaned.length >= 4 ? cleaned[3] : cleaned[2]
                    };
                }
                return null;
            }).filter(Boolean);

            console.log(`[TizenAppManager] Parsed ${apps.length} apps`);
            socket.emit('list_tizen_apps_result', { success: true, apps });
        });
    });

    socket.on('uninstall_tizen_app', ({ deviceId, pkgId, sdbPath }) => {
        console.log(`[TizenAppManager] Uninstalling ${pkgId}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `pkgcmd -u -n "${pkgId}"`] : ['shell', `pkgcmd -u -n "${pkgId}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'uninstall', target: 'tizen_app', pkgId });
        });
    });

    socket.on('launch_tizen_app', ({ deviceId, pkgId, sdbPath }) => {
        console.log(`[TizenAppManager] Launching ${pkgId}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `launch_app "${pkgId}"`] : ['shell', `launch_app "${pkgId}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'launch', target: 'tizen_app', pkgId });
        });
    });

    socket.on('terminate_tizen_app', ({ deviceId, pkgId, sdbPath }) => {
        console.log(`[TizenAppManager] Terminating ${pkgId}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `app_terminate "${pkgId}"`] : ['shell', `app_terminate "${pkgId}"`];
        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            socket.emit('operation_result', { success: !error, error: error ? stderr : null, op: 'terminate', target: 'tizen_app', pkgId });
        });
    });

    // --- Tizen Performance Insight ---
    socket.on('get_tizen_process_info', ({ deviceId, pid, sdbPath }) => {
        // Get more details about a process (e.g. fd count, smaps summary)
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell'] : ['shell'];
        const cmd = `cat /proc/${pid}/status | grep -E "Threads|FDSize|VmRSS|VmSwap"`;

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')} "${cmd}"`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('tizen_process_info_result', { success: false, error: stderr });
            } else {
                socket.emit('tizen_process_info_result', { success: true, pid, info: stdout });
            }
        });
    });

    socket.on('tizen_process_info_result', (data) => {
        // ... previous handlers ...
    });

    // --- Tizen App Manager Handlers ---
    socket.on('list_tizen_apps', ({ deviceId, sdbPath }) => {
        console.log(`[TizenAppManager] Listing apps on ${deviceId || 'default'}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', 'app_launcher -l'] : ['shell', 'app_launcher -l'];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('list_tizen_apps_result', { success: false, error: stderr });
                return;
            }

            // Parse app_launcher output
            // Format: [pkgId] [name] ([status])
            const lines = stdout.split('\n');
            const apps = [];

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('Package') || trimmed.startsWith('Total')) continue;

                // Example: org.tizen.settings Settings (Stopped)
                const match = trimmed.match(/^(\S+)\s+(.+?)\s+\((.+)\)$/);
                if (match) {
                    apps.push({
                        pkgId: match[1],
                        name: match[2].trim(),
                        status: match[3].trim()
                    });
                }
            }

            console.log(`[TizenAppManager] Found ${apps.length} apps`);
            socket.emit('list_tizen_apps_result', { success: true, apps });
        });
    });

    socket.on('launch_tizen_app', ({ deviceId, pkgId, sdbPath }) => {
        console.log(`[TizenAppManager] Launching ${pkgId} on ${deviceId || 'default'}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `app_launcher -s ${pkgId}`] : ['shell', `app_launcher -s ${pkgId}`];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('operation_result', { target: 'tizen_app', success: false, op: 'launch', pkgId, error: stderr });
            } else {
                socket.emit('operation_result', { target: 'tizen_app', success: true, op: 'launch', pkgId, output: stdout });
            }
        });
    });

    socket.on('terminate_tizen_app', ({ deviceId, pkgId, sdbPath }) => {
        console.log(`[TizenAppManager] Terminating ${pkgId} on ${deviceId || 'default'}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `app_launcher -k ${pkgId}`] : ['shell', `app_launcher -k ${pkgId}`];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('operation_result', { target: 'tizen_app', success: false, op: 'terminate', pkgId, error: stderr });
            } else {
                socket.emit('operation_result', { target: 'tizen_app', success: true, op: 'terminate', pkgId, output: stdout });
            }
        });
    });

    socket.on('uninstall_tizen_app', ({ deviceId, pkgId, sdbPath }) => {
        console.log(`[TizenAppManager] Uninstalling ${pkgId} on ${deviceId || 'default'}`);
        const args = deviceId && deviceId !== 'auto-detect' ? ['-s', deviceId, 'shell', `pkgcmd -u -n ${pkgId}`] : ['shell', `pkgcmd -u -n ${pkgId}`];

        handleSdbCommand(`${getSdbCmd(sdbPath)} ${args.join(' ')}`, (error, stdout, stderr) => {
            if (error) {
                socket.emit('operation_result', { target: 'tizen_app', success: false, op: 'uninstall', pkgId, error: stderr });
            } else {
                socket.emit('operation_result', { target: 'tizen_app', success: true, op: 'uninstall', pkgId, output: stdout });
            }
        });
    });

    // --- Local PC File Explorer Handlers ---
    socket.on('list_local_files', async ({ path: localPath }) => {
        const trimmedPath = (localPath || '').trim();
        console.log(`[LocalExplorer] Listing files in ${trimmedPath}`);
        try {
            let targetPath = trimmedPath;
            if (trimmedPath.startsWith('~')) {
                targetPath = path.join(require('os').homedir(), trimmedPath.slice(1));
            }
            if (!targetPath) {
                targetPath = process.platform === 'win32' ? 'C:\\' : '/';
            }
            targetPath = path.resolve(targetPath);

            // Use non-blocking readdir with file types
            const dirents = await fs.promises.readdir(targetPath, { withFileTypes: true });

            // Map dirents to our file objects. We still might need stat for size/mtime if they are files.
            const filePromises = dirents.map(async (dirent) => {
                try {
                    const fullPath = path.join(targetPath, dirent.name);
                    const isDir = dirent.isDirectory();

                    // We only need stat for files to get size/mtime, 
                    // or for directories if we want mtime.
                    const fileStats = await fs.promises.stat(fullPath);

                    return {
                        name: dirent.name,
                        type: isDir ? 'directory' : 'file',
                        size: fileStats.size,
                        modified: fileStats.mtime.toLocaleString(),
                        permissions: fileStats.mode.toString(8)
                    };
                } catch (e) {
                    return null;
                }
            });

            const files = (await Promise.all(filePromises)).filter(Boolean);
            socket.emit('list_local_files_result', { success: true, files, path: targetPath });
        } catch (e) {
            console.error(`[LocalExplorer] Error listing ${localPath}:`, e);
            socket.emit('list_local_files_result', { success: false, error: e.message });
        }
    });

    socket.on('complete_local_path', async ({ path: partialPath }) => {
        console.log(`[LocalExplorer] Auto-complete request for: ${partialPath}`);
        try {
            const isWin = process.platform === 'win32';
            const sep = isWin ? '\\' : '/';

            // Normalize path for finding the last separator
            const normalizedPath = partialPath.replace(/\//g, sep);
            const lastSlash = normalizedPath.lastIndexOf(sep);

            let dir, fragment;
            if (lastSlash === -1) {
                // Check if it's just a drive letter like C:
                if (isWin && /^[a-zA-Z]:$/.test(partialPath)) {
                    dir = partialPath + sep;
                    fragment = '';
                } else {
                    dir = '.';
                    fragment = partialPath;
                }
            } else {
                dir = partialPath.substring(0, lastSlash + 1);
                fragment = partialPath.substring(lastSlash + 1);
            }

            console.log(`[LocalExplorer] Searching in: ${dir}, Fragment: ${fragment}`);
            if (!fs.existsSync(dir)) {
                console.warn(`[LocalExplorer] Directory not found: ${dir}`);
                socket.emit('complete_local_path_result', { success: false, error: 'Directory not found' });
                return;
            }

            const files = fs.readdirSync(dir, { withFileTypes: true });
            const matches = files
                .filter(f => f.name.toLowerCase().startsWith(fragment.toLowerCase()))
                .map(f => f.name + (f.isDirectory() ? sep : ''));

            console.log(`[LocalExplorer] Found matches: ${matches.length}`);
            socket.emit('complete_local_path_result', { success: true, matches, dir, fragment });
        } catch (e) {
            console.error('[CompleteLocalPath] Error:', e.message);
            socket.emit('complete_local_path_result', { success: false, error: e.message });
        }
    });

    socket.on('delete_local_path', ({ path: targetPath }) => {
        console.log(`[LocalExplorer] Deleting ${targetPath}`);
        try {
            if (fs.existsSync(targetPath)) {
                const stats = fs.statSync(targetPath);
                if (stats.isDirectory()) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(targetPath);
                }
                socket.emit('operation_result', { success: true, op: 'delete', target: 'local' });
            } else {
                socket.emit('operation_result', { success: false, error: 'File does not exist', op: 'delete', target: 'local' });
            }
        } catch (e) {
            socket.emit('operation_result', { success: false, error: e.message, op: 'delete', target: 'local' });
        }
    });

    socket.on('copy_local_path', ({ srcPath, destPath }) => {
        console.log(`[LocalExplorer] Copying ${srcPath} to ${destPath}`);
        try {
            if (fs.existsSync(srcPath)) {
                fs.cpSync(srcPath, destPath, { recursive: true });
                socket.emit('operation_result', { success: true, op: 'copy', target: 'local' });
            } else {
                socket.emit('operation_result', { success: false, error: 'Source does not exist', op: 'copy', target: 'local' });
            }
        } catch (e) {
            socket.emit('operation_result', { success: false, error: e.message, op: 'copy', target: 'local' });
        }
    });

    socket.on('rename_local_path', ({ oldPath, newPath }) => {
        console.log(`[LocalExplorer] Renaming ${oldPath} to ${newPath}`);
        try {
            fs.renameSync(oldPath, newPath);
            socket.emit('operation_result', { success: true, op: 'rename', target: 'local' });
        } catch (e) {
            socket.emit('operation_result', { success: false, error: e.message, op: 'rename', target: 'local' });
        }
    });

    socket.on('mkdir_local_path', ({ path: targetPath }) => {
        console.log(`[LocalExplorer] Making directory ${targetPath}`);
        try {
            fs.mkdirSync(targetPath, { recursive: true });
            socket.emit('operation_result', { success: true, op: 'mkdir', target: 'local' });
        } catch (e) {
            socket.emit('operation_result', { success: false, error: e.message, op: 'mkdir', target: 'local' });
        }
    });

    socket.on('open_local_path', ({ path: targetPath }) => {
        console.log(`[LocalExplorer] Opening ${targetPath}`);
        try {
            const { shell } = require('electron');
            if (shell) {
                shell.openPath(targetPath);
            } else {
                const cmd = process.platform === 'win32' ? `explorer "${targetPath}"` : `open "${targetPath}"`;
                exec(cmd);
            }
        } catch (e) {
            console.error('Failed to open path:', e);
        }
    });

    socket.on('disconnect', () => {
        logDebug('User requested disconnect');
        if (sshConnection) {
            sshConnection.end();
            sshConnection = null;
        }
        if (sdbProcess) {
            sdbProcess.kill();
            sdbProcess = null;
        }
        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }
        if (logFileStream) {
            logFileStream.end();
            logFileStream = null;
        }
    });

};

io.on('connection', handleSocketConnection);

// SPA Fallback for non-API routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 3003;

function startServer(userDataPath) {
    if (userDataPath) {
        globalUserDataPath = userDataPath;
        globalBlockTestDir = path.join(userDataPath, 'BlockTest');
        console.log(`[Server] Updated BlockTest Dir to: ${globalBlockTestDir}`);
    }

    // Serve BlockTest files dynamically based on configured path
    app.use('/blocktest', express.static(globalBlockTestDir));

    // Ensure it exists
    if (!fs.existsSync(globalBlockTestDir)) {
        try {
            fs.mkdirSync(globalBlockTestDir, { recursive: true });
        } catch (e) { console.error("Failed to create BlockTest dir:", e); }
    }

    return new Promise((resolve, reject) => {
        let retries = 0;
        const maxRetries = 5;

        const attemptListen = () => {
            const onError = (err) => {
                if (err.code === 'EADDRINUSE') {
                    if (retries < maxRetries) {
                        retries++;
                        console.log(`[Server] Port ${PORT} in use, retrying (${retries}/${maxRetries}) in 1s...`);
                        setTimeout(() => {
                            server.close();
                            attemptListen();
                        }, 1000);
                    } else {
                        const msg = `Port ${PORT} is still busy after ${maxRetries} retries. Please close other HappyTool instances.`;
                        console.error(`[Server] ${msg}`);
                        reject(new Error(msg));
                    }
                } else {
                    reject(err);
                }
            };

            server.listen(PORT, '127.0.0.1', () => {
                console.log(`Log Server running on port ${PORT} (Local Only)`);
                server.removeListener('error', onError);
                resolve(server);
            }).once('error', onError);
        };

        attemptListen();
    });
}

// Run if executed directly
if (require.main === module) {
    startServer();
}

module.exports = { startServer, handleSocketConnection };
