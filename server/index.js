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

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3001"], // Allow both Dev and Prod(Self)
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

        if (debug) {
            const fileName = `tizen_debug_ssh_${Date.now()}.log`;
            debugStream = fs.createWriteStream(path.join(__dirname, fileName), { flags: 'a' });
            logDebug(`Starting SSH Connection to ${host}:${port} as ${username}`);
            socket.emit('debug_log', `Debug logging started: ${fileName}`);
        }

        const conn = new Client();

        conn.on('ready', () => {
            logDebug('SSH Client ready');
            socket.emit('ssh_status', { status: 'connected', message: 'SSH Connection Established' });

            logDebug('Executing: dlogutil -v threadtime');
            // Start dlog tail only after connection is ready
            conn.exec('dlogutil -v threadtime', (err, stream) => {
                if (err) {
                    logDebug(`SSH Exec Error: ${err.message}`);
                    socket.emit('ssh_error', { message: 'Failed to execute dlogutil: ' + err.message });
                    return;
                }

                stream.on('close', (code, signal) => {
                    logDebug(`Stream closed. Code: ${code}, Signal: ${signal}`);
                    socket.emit('ssh_status', { status: 'disconnected', message: 'Log stream closed' });
                    if (debugStream) { debugStream.end(); debugStream = null; }
                }).on('data', (data) => {
                    // Stream log data to client
                    if (debugStream) logDebug(`[DATA CHUNK] ${data.length} bytes`);
                    socket.emit('log_data', data.toString());
                }).stderr.on('data', (data) => {
                    logDebug(`STDERR: ${data}`);
                });
            });

        }).on('error', (err) => {
            logDebug(`SSH Connection Error: ${err.level} - ${err.message}`);

            let userMessage = err.message;

            // Provide user-friendly messages for common SSH errors
            if (err.level === 'client-authentication') {
                userMessage = 'Authentication failed.\\n\\nPlease check:\\n??Username and password are correct\\n??SSH is enabled on the device';
            } else if (err.level === 'client-timeout') {
                userMessage = 'Connection timeout.\\n\\nPlease check:\\n??Device IP address is correct\\n??Device is powered on and connected to the network\\n??Firewall is not blocking SSH port (22)';
            } else if (err.code === 'ENOTFOUND') {
                userMessage = 'Host not found.\\n\\nPlease check:\\n??IP address is typed correctly\\n??Device is connected to the network';
            } else if (err.code === 'ECONNREFUSED') {
                userMessage = 'Connection refused.\\n\\nPlease check:\\n??SSH service is running on the device\\n??Port number is correct (default: 22)';
            }

            socket.emit('ssh_error', { message: userMessage });
            if (debugStream) { debugStream.end(); debugStream = null; }
        }).connect({
            host,
            port: port || 22,
            username: username || 'root',
            password,
            readyTimeout: 20000,
            tryKeyboard: true, // Try keyboard-interactive auth
            keepaliveInterval: 10000, // Keep connection alive
            keepaliveCountMax: 3,
            // Add legacy algorithms for older Tizen devices compatibility
            algorithms: {
                serverHostKey: ['ssh-rsa', 'ssh-dss'],
                kex: ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256'],
                cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes128-cbc', '3des-cbc']
            }
        });

        sshConnection = conn;
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
        const connectProc = spawn('sdb', ['connect', ip]);
        let output = '';

        connectProc.stdout.on('data', (data) => output += data.toString());
        connectProc.stderr.on('data', (data) => output += data.toString());

        connectProc.on('close', (code) => {
            if (output.includes(`connected to ${ip}`) || output.includes(`already connected`)) {
                socket.emit('sdb_remote_result', { success: true, message: `Connected to ${ip}` });
                // Auto-refresh device list
                socket.emit('list_sdb_devices');
            } else {
                socket.emit('sdb_remote_result', { success: false, message: `Failed: ${output.trim()}` });
            }
        });
    });

    socket.on('disconnect_sdb', () => {
        logDebug('User requested SDB disconnect');
        if (sdbProcess) {
            sdbProcess.kill();
            sdbProcess = null;
            socket.emit('sdb_status', { status: 'disconnected', message: 'SDB Disconnected by user' });
        }
        if (debugStream) {
            debugStream.end();
            debugStream = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        if (sshConnection) sshConnection.end();
        if (sdbProcess) sdbProcess.kill();
        if (debugStream) { debugStream.end(); debugStream = null; }
    });
});
// SPA Fallback for non-API routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 3001;

function startServer() {
    return new Promise((resolve, reject) => {
        server.listen(PORT, () => {
            console.log(`Log Server running on port ${PORT}`);
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
