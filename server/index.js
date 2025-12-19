require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client } = require('ssh2');
const { spawn } = require('child_process');

const path = require('path');

const app = express();
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../dist')));

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
                    <!-- The logic should find this URL -->
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
            <!-- The logic should find this .rpm file -->
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

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for local tool flexibility
        methods: ["GET", "POST"]
    }
});

const fs = require('fs');

// Active connections
let sshConnection = null;
let sdbProcess = null;
let debugStream = null;

function logDebug(msg) {
    if (debugStream) {
        const timestamp = new Date().toISOString();
        debugStream.write(`[${timestamp}] ${msg}\n`);
    }
}

io.on('connection', (socket) => {
    console.log('Client connected');

    // --- SCROLL TEST STREAM ---
    let scrollInterval = null;

    socket.on('start_scroll_stream', () => {
        if (scrollInterval) clearInterval(scrollInterval);
        let counter = 0;
        scrollInterval = setInterval(() => {
            // Generate multiple lines to simulate burst
            const lines = [];
            for (let i = 0; i < 5; i++) {
                lines.push(`[TEST_LOG_${counter++}] ${new Date().toISOString()} - Simulated log line for testing auto-scroll behavior. Data packet #${counter}`);
            }
            socket.emit('log_data', lines.join('\n') + '\n');
        }, 100); // 100ms interval => 50 lines/sec
    });

    socket.on('toggle_scroll_stream', (active) => {
        if (!active && scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        } else if (active && !scrollInterval) {
            let counter = 0;
            scrollInterval = setInterval(() => {
                const lines = [];
                for (let i = 0; i < 5; i++) {
                    lines.push(`[TEST_LOG_${counter++}] ${new Date().toISOString()} - Simulated log line for testing auto-scroll behavior. Data packet #${counter}`);
                }
                socket.emit('log_data', lines.join('\n') + '\n');
            }, 100);
        }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
        if (scrollInterval) clearInterval(scrollInterval);
    });
    // --------------------------

    // SSH Auth Flow State
    let sshAuthFinish = null;

    // --- SSH Handler ---
    socket.on('connect_ssh', ({ host, port, username, password, debug }) => {
        if (sshConnection) {
            sshConnection.end();
            sshConnection = null;
        }
        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }

        // Reset Auth State
        sshAuthFinish = null;

        if (debug) {
            // Use process.cwd() to verify where the file goes (requested by user)
            // Typically this is the root of the app or dist folder.
            const fileName = `tizen_debug_ssh_${Date.now()}.log`;
            const filePath = path.join(process.cwd(), fileName);
            debugStream = fs.createWriteStream(filePath, { flags: 'a' });
            logDebug(`Starting SSH Connection to ${host}:${port} as ${username}`);
            logDebug(`Debug file path: ${filePath}`);
            socket.emit('debug_log', `Debug logging started: ${filePath}`);
        }

        const conn = new Client();

        conn.on('ready', () => {
            logDebug('SSH Client ready');
            socket.emit('ssh_status', { status: 'connected', message: 'SSH Connection Established' });

            // Start dlog tail only after connection is ready
            // Use 'shell' to allow interactive commands if needed, or exec if strictly dlog?
            // User wants to see "id/password" prompts from MobaXterm. 
            // If those prompts are from the DEVICE SHELL (post-auth), we need a shell.
            // If they are SSH Auth prompts, they happen before 'ready'.
            // MobaXterm prompts are likely SSH Auth.
            // But if the user successfully connects via SSH (e.g. key/password) and THEN sees prompts, that's shell.
            // Given "connect & start stream" hanging, it's likely pre-auth.

            // User requested Shell mode instead of auto dlogutil
            // "ssh 연결후 shell이 나오게 해줘"
            logDebug('Starting Interactive Shell...');
            conn.shell((err, stream) => {
                if (err) {
                    logDebug(`SSH Shell Error: ${err.message}`);
                    socket.emit('ssh_error', { message: 'Failed to start shell: ' + err.message });
                    return;
                }

                // Store stream for writing (if needed later)
                sshConnection.stream = stream;

                stream.on('close', (code, signal) => {
                    logDebug(`Stream closed. Code: ${code}, Signal: ${signal}`);
                    socket.emit('ssh_status', { status: 'disconnected', message: 'Shell closed' });
                    if (debugStream) { debugStream.end(); debugStream = null; }
                }).on('data', (data) => {
                    if (debugStream) logDebug(`[DATA CHUNK] ${data.length} bytes`);
                    socket.emit('log_data', data.toString());
                }).stderr.on('data', (data) => {
                    logDebug(`STDERR: ${data}`);
                    socket.emit('log_data', data.toString()); // Emit stderr as log too
                });
            });

        }).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
            logDebug(`SSH Keyboard Interactive: ${JSON.stringify(prompts)}`);

            // If we have prompts, ask the client
            if (prompts.length > 0) {
                // Auto-Answer if password is provided and prompt looks like password
                const firstPrompt = prompts[0].prompt.toLowerCase();
                if (password && (firstPrompt.includes('password') || firstPrompt.includes('passphrase'))) {
                    logDebug(`Auto-answering SSH password prompt`);
                    finish([password]);
                    return;
                }

                sshAuthFinish = finish;
                // Emit event to client to ask user
                // tailored for the first prompt usually
                const promptMsg = prompts[0].prompt;
                socket.emit('log_data', `[SSH Auth] ${name || 'Server'} asks: ${promptMsg}\n`);
                socket.emit('ssh_auth_request', { prompt: promptMsg, echo: prompts[0].echo });
            } else {
                finish([]);
            }
        }).on('error', (err) => {
            logDebug(`SSH Connection Error: ${err.level} - ${err.message}`);

            let userMessage = err.message;
            if (err.level === 'client-authentication') {
                userMessage = 'Authentication failed. Check username/password or generated keys.';
            } else if (err.level === 'client-timeout') {
                userMessage = 'Connection timeout. Check IP and Port.';
            }

            socket.emit('ssh_error', { message: userMessage });
            if (debugStream) { debugStream.end(); debugStream = null; }
        }).connect({
            host,
            port: port || 22,
            username: username || 'root',
            password,
            readyTimeout: 20000,
            tryKeyboard: true,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
            algorithms: {
                serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519'],
                kex: ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256', 'curve25519-sha256', 'curve25519-sha256@libssh.org'],
                cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes128-cbc', '3des-cbc']
            }
        });

        sshConnection = conn;
    });

    socket.on('ssh_auth_response', (response) => {
        logDebug(`Received SSH Auth Response: ${response ? '***' : '(empty)'}`);
        if (sshAuthFinish) {
            sshAuthFinish([response]);
            sshAuthFinish = null;
        }
    });

    socket.on('ssh_write', (data) => {
        if (sshConnection && sshConnection.stream) {
            try {
                sshConnection.stream.write(data);
            } catch (e) {
                logDebug(`Failed to write to SSH stream: ${e.message}`);
            }
        }
    });

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
        sshAuthFinish = null;
    });

    // --- SDB Handler ---
    socket.on('list_sdb_devices', () => {
        try {
            const sdbList = spawn('sdb', ['devices']);
            let output = '';

            sdbList.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    socket.emit('sdb_error', {
                        message: 'SDB command not found. Please install Tizen Studio and add sdb to your system PATH.'
                    });
                } else {
                    socket.emit('sdb_error', { message: `SDB error: ${err.message}` });
                }
            });

            sdbList.stdout.on('data', (data) => {
                output += data.toString();
            });

            sdbList.on('close', (code) => {
                if (code === 0) {
                    const devices = output.split('\n')
                        .filter(line => line.includes('\tdevice') || line.includes('\temulator'))
                        .map(line => {
                            const [id, type] = line.split('\t');
                            return { id: id.trim(), type: type ? type.trim() : 'device' };
                        });
                    socket.emit('sdb_devices', devices);
                } else if (code !== null) {
                    socket.emit('sdb_error', { message: 'Failed to list sdb devices' });
                }
            });
        } catch (e) {
            socket.emit('sdb_error', { message: `Failed to execute sdb: ${e.message}` });
        }
    });

    socket.on('connect_sdb', ({ deviceId, debug }) => {
        if (sdbProcess) {
            sdbProcess.kill();
            sdbProcess = null;
        }
        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }

        if (debug) {
            const fileName = `tizen_debug_sdb_${Date.now()}.log`;
            debugStream = fs.createWriteStream(path.join(__dirname, fileName), { flags: 'a' });
            logDebug(`Starting SDB Shell to ${deviceId || 'default'}`);
            socket.emit('debug_log', `Debug logging started: ${fileName}`);
        }

        // Changed to 'shell' for interactive terminal
        const args = deviceId ? ['-s', deviceId, 'shell'] : ['shell'];
        logDebug(`Spawning sdb with args: ${args.join(' ')}`);

        try {
            sdbProcess = spawn('sdb', args);

            sdbProcess.on('error', (err) => {
                logDebug(`SDB Process Error: ${err.code} - ${err.message}`);
                if (err.code === 'ENOENT') {
                    socket.emit('sdb_error', {
                        message: 'SDB command not found.\n\nPlease:\n1. Install Tizen Studio\n2. Add sdb to your system PATH\n3. Restart HappyTool'
                    });
                } else {
                    socket.emit('sdb_error', { message: `SDB error: ${err.message}` });
                }
                if (debugStream) { debugStream.end(); debugStream = null; }
            });

            socket.emit('sdb_status', { status: 'connected', message: `SDB Shell Connected to ${deviceId || 'default'}` });

            sdbProcess.stdout.on('data', (data) => {
                if (debugStream) logDebug(`[DATA CHUNK] ${data.length} bytes`);
                socket.emit('log_data', data.toString());
            });

            sdbProcess.stderr.on('data', (data) => {
                // In shell mode, stderr is also part of terminal output
                socket.emit('log_data', data.toString());
                logDebug(`SDB STDERR: ${data.toString()}`);
            });

            sdbProcess.on('close', (code) => {
                logDebug(`SDB process exited with code ${code}`);
                socket.emit('sdb_status', { status: 'disconnected', message: 'SDB process exited' });
                sdbProcess = null;
                if (debugStream) { debugStream.end(); debugStream = null; }
            });
        } catch (e) {
            logDebug(`SDB Spawn Error: ${e.message}`);
            socket.emit('sdb_error', { message: 'Failed to start SDB process: ' + e.message });
            if (debugStream) { debugStream.end(); debugStream = null; }
        }
    });

    socket.on('sdb_write', (data) => {
        if (sdbProcess && sdbProcess.stdin) {
            try {
                sdbProcess.stdin.write(data);
            } catch (e) {
                console.error("Failed to write to SDB:", e);
            }
        }
    });

    // --- SDB Remote Connect (Addon) ---
    socket.on('connect_sdb_remote', ({ ip }) => {
        let isTimedOut = false;
        // Total timeout 10 seconds
        const timeoutTimer = setTimeout(() => {
            isTimedOut = true;
            socket.emit('sdb_remote_result', { success: false, message: 'Connection timed out (10s)' });
        }, 10000);

        // Step 1: sdb disconnect
        const disconnectProc = spawn('sdb', ['disconnect']);

        disconnectProc.on('close', () => {
            if (isTimedOut) return;

            // Step 2: sdb connect [ip]
            const connectProc = spawn('sdb', ['connect', ip]);
            let output = '';

            connectProc.stdout.on('data', (data) => output += data.toString());
            connectProc.stderr.on('data', (data) => output += data.toString());

            connectProc.on('close', (code) => {
                if (isTimedOut) return;

                // Check output for success confirmation
                const isConnected = output.includes(`connected to ${ip}`) || output.includes(`already connected`);

                if (isConnected) {
                    // Step 3: sdb root on
                    const rootProc = spawn('sdb', ['root', 'on']);

                    rootProc.on('close', () => {
                        if (isTimedOut) return;
                        clearTimeout(timeoutTimer);
                        socket.emit('sdb_remote_result', { success: true, message: `Connected to ${ip} (Root Enabled)` });
                    });
                } else {
                    clearTimeout(timeoutTimer);
                    socket.emit('sdb_remote_result', { success: false, message: `Failed: ${output.trim()}` });
                }
            });
        });
    });

    socket.on('disconnect_sdb', () => {
        logDebug('User requested SDB disconnect');

        // Kill Active Shell process
        if (sdbProcess) {
            sdbProcess.kill();
            sdbProcess = null;
        }

        // REQUESTED: Execute sdb disconnect command
        spawn('sdb', ['disconnect']);

        socket.emit('sdb_status', { status: 'disconnected', message: 'SDB Disconnected by user' });

        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        if (sshConnection) {
            sshConnection.end();
            sshConnection = null;
        }

        // Ensure clean SDB state by forcing disconnect
        spawn('sdb', ['disconnect']);

        if (sdbProcess) {
            sdbProcess.kill();
            sdbProcess = null;
        }
        if (debugStream) { debugStream.end(); debugStream = null; }
    });
});
// SPA Fallback for non-API routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 3002;

function startServer() {
    return new Promise((resolve, reject) => {
        server.listen(PORT, '127.0.0.1', () => {
            console.log(`Log Server running on port ${PORT} (Local Only)`);
            resolve(server);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${PORT} already in use, assuming server is running.`);
                resolve(server);
            } else {
                reject(err);
            }
        });
    });
}

// Run if executed directly
if (require.main === module) {
    startServer();
}

module.exports = { startServer };
