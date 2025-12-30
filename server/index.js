require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client } = require('ssh2');
const { spawn, exec } = require('child_process');

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
    const BLOCK_TEST_DIR = path.join(process.cwd(), 'BlockTest');

    // Ensure dir exists
    if (!fs.existsSync(BLOCK_TEST_DIR)) {
        try {
            fs.mkdirSync(BLOCK_TEST_DIR, { recursive: true });
        } catch (e) {
            console.error("Failed to create BlockTest dir:", e);
        }
    }

    socket.on('save_file', ({ filename, content }) => {
        try {
            if (!fs.existsSync(BLOCK_TEST_DIR)) {
                fs.mkdirSync(BLOCK_TEST_DIR, { recursive: true });
            }
            const filePath = path.join(BLOCK_TEST_DIR, filename);
            fs.writeFileSync(filePath, content, 'utf-8');
            socket.emit('save_file_result', { filename, success: true });
        } catch (e) {
            socket.emit('save_file_result', { filename, success: false, error: e.message });
        }
    });

    socket.on('load_file', ({ filename }) => {
        try {
            const filePath = path.join(BLOCK_TEST_DIR, filename);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                socket.emit('load_file_result', { filename, success: true, content });
            } else {
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
    // --- CPU Analyzer Handlers ---

    let cpuMonitorProcess = null;
    let cpuMonitorInterval = null;

    socket.on('start_cpu_monitoring', ({ deviceId }) => {
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

            const args = ['-s', deviceId, 'shell', 'top', '-b', '-d', '1'];

            try {
                cpuMonitorProcess = spawn('sdb', args);

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
                        // Case 1: "User 13% + System 4% ... = 17% Total"
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
                            // PID USER PR NI CPU% S #THR VSS RSS PCY Name
                            // If parts length is large enough

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
                    // 'top -b' just streams. We parsed lines.
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

    socket.on('start_thread_monitoring', ({ deviceId, pid }) => {
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
            const args = ['-s', deviceId, 'shell', 'top', '-H', '-b', '-d', '1', '-p', pid];

            try {
                threadMonitorProcess = spawn('sdb', args);
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

});

// SPA Fallback for non-API routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 3003;

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
