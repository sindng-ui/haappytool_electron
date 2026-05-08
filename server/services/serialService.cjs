const { SerialPort } = require('serialport');

/**
 * Serial Connection Service
 * Handles COM port communication for Tizen devices
 */
class SerialService {
    constructor() {
        this.serialPort = null;
        this.currentSocket = null;
        this.logFileStream = null;
        this.debugStream = null;
    }

    async listPorts() {
        try {
            const ports = await SerialPort.list();
            return ports;
        } catch (err) {
            console.error('[Serial] Failed to list ports:', err);
            return [];
        }
    }

    connect(socket, { port, baudRate, dataBits, stopBits, parity, saveToFile, debug, globalUserDataPath, handleLogData }) {
        this.currentSocket = socket;

        console.log('[Serial] ========== Serial Connection Request ==========');
        console.log('[Serial] Params:', { port, baudRate, dataBits, stopBits, parity });

        if (this.serialPort && this.serialPort.isOpen) {
            console.log('[Serial] Closing existing port...');
            this.serialPort.close();
        }

        try {
            this.serialPort = new SerialPort({
                path: port,
                baudRate: parseInt(baudRate) || 115200,
                dataBits: parseInt(dataBits) || 8,
                stopBits: parseInt(stopBits) || 1,
                parity: parity || 'none',
                autoOpen: false
            });

            this.serialPort.open((err) => {
                if (err) {
                    console.error('[Serial] Port open error:', err.message);
                    socket.emit('serial_error', { message: `Failed to open ${port}: ${err.message}` });
                    return;
                }

                console.log(`[Serial] ✓ Port ${port} opened successfully`);
                socket.emit('serial_status', { status: 'connected', message: `Connected to ${port}` });

                // Setup logging streams if needed
                if (saveToFile) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const fileName = `serial_${timestamp}.txt`;
                    const basePath = globalUserDataPath || process.cwd();
                    const filePath = require('path').join(basePath, fileName);
                    this.logFileStream = require('fs').createWriteStream(filePath, { flags: 'a' });
                    console.log(`[Serial] Saving logs to ${filePath}`);
                    socket.emit('log_data', `[System] Saving logs to file: ${fileName}\n`);
                }

                this.serialPort.on('data', (data) => {
                    if (this.logFileStream) this.logFileStream.write(data);
                    handleLogData(data, socket);
                });

                this.serialPort.on('error', (err) => {
                    console.error('[Serial] Runtime error:', err.message);
                    socket.emit('serial_error', { message: `Serial Error: ${err.message}` });
                });

                this.serialPort.on('close', () => {
                    console.log('[Serial] Port closed');
                    socket.emit('serial_status', { status: 'disconnected', message: 'Serial Port Closed' });
                    this.cleanup();
                });
            });

        } catch (err) {
            console.error('[Serial] Setup exception:', err);
            socket.emit('serial_error', { message: `Setup Exception: ${err.message}` });
        }
    }

    write(data) {
        if (this.serialPort && this.serialPort.isOpen) {
            this.serialPort.write(data, (err) => {
                if (err) console.error('[Serial] Write error:', err.message);
            });
        }
    }

    disconnect() {
        if (this.serialPort && this.serialPort.isOpen) {
            this.serialPort.close();
        }
        this.cleanup();
    }

    cleanup() {
        if (this.logFileStream) {
            this.logFileStream.end();
            this.logFileStream = null;
        }
        if (this.debugStream) {
            this.debugStream.end();
            this.debugStream = null;
        }
    }
}

module.exports = new SerialService();
