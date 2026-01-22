const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises'); // For async/await helper if needed
const originalFs = require('fs'); // For streams
const { startServer } = require('../server/index.cjs');

let mainWindow;

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

async function createWindow() {
    let savedState = null;
    try {
        const data = await fs.readFile(windowStatePath, 'utf-8');
        savedState = JSON.parse(data);
    } catch (e) {
        // No saved state or error reading
    }

    const winOptions = {
        width: savedState?.width || 1280,
        height: savedState?.height || 800,
        x: savedState?.x,
        y: savedState?.y,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#94a3b8',
            height: 36
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false
        },
        autoHideMenuBar: true,
        backgroundColor: '#0f172a',
        show: false
    };

    mainWindow = new BrowserWindow(winOptions);

    // Maximize if previously maximized or if it's the first run (no saved state)
    if (!savedState || savedState.isMaximized) {
        mainWindow.maximize();
    }

    mainWindow.show();

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL('http://127.0.0.1:3003');
    }

    // Save state on close
    mainWindow.on('close', async () => {
        if (!mainWindow) return;
        try {
            const bounds = mainWindow.getBounds();
            const isMaximized = mainWindow.isMaximized();
            const state = { ...bounds, isMaximized };
            await fs.writeFile(windowStatePath, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save window state:', e);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    // IPC Handler for file reading
    ipcMain.handle('readFile', async (event, filePath) => {
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    });

    // IPC Handler for file saving
    ipcMain.handle('saveFile', async (event, content) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            filters: [{ name: 'Text Files', extensions: ['txt', 'log'] }]
        });
        if (canceled || !filePath) return { status: 'canceled' };
        try {
            await fs.writeFile(filePath, content, 'utf-8');
            return { status: 'success', filePath };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    });

    // IPC Handler for binary file saving
    ipcMain.handle('saveBinaryFile', async (event, { data, fileName }) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: fileName,
            filters: [{ name: 'Tizen Package', extensions: ['tpk'] }]
        });
        if (canceled || !filePath) return { status: 'canceled' };
        try {
            await fs.writeFile(filePath, Buffer.from(data));
            return { status: 'success', filePath };
        } catch (error) {
            console.error('Save failed:', error);
            return { status: 'error', error: error.message };
        }
    });

    // IPC Handler for clipboard
    const { clipboard } = require('electron');
    ipcMain.handle('copyToClipboard', async (event, text) => {
        try {
            clipboard.writeText(text);
            return { status: 'success' };
        } catch (error) {
            console.error('Clipboard error:', error);
            throw error;
        }
    });

    // IPC Handler for opening external URLs/files
    ipcMain.handle('openExternal', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { status: 'success' };
        } catch (error) {
            console.error('Error opening external:', error);
            return { status: 'error', error: error.message };
        }
    });

    // IPC Handler for fetching URLs (Bypass CORS)
    ipcMain.handle('fetchUrl', async (event, { url, type }) => {
        try {
            // Using Node.js native fetch (Node 18+)
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

            if (type === 'buffer') {
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('Fetch URL failed:', error);
            throw error;
        }
    });

    // IPC Handler for getting app path
    ipcMain.handle('getAppPath', () => {
        // In development: return project root
        // In production: return process.resourcesPath where extraResources are located
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
            return path.join(__dirname, '..');
        } else {
            // In production, extraResources are in the resources folder
            return process.resourcesPath;
        }
    });

    // IPC Handler for file streaming
    ipcMain.handle('streamReadFile', (event, filePath) => {
        const stream = originalFs.createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 }); // 64KB chunks

        stream.on('data', (chunk) => {
            if (mainWindow) mainWindow.webContents.send('file-chunk', chunk);
        });

        stream.on('end', () => {
            if (mainWindow) mainWindow.webContents.send('file-stream-complete');
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (mainWindow) mainWindow.webContents.send('file-stream-error', err.message);
        });

        return { status: 'started' };
    });

    // IPC Handler for Roslyn Validation
    ipcMain.handle('validateRoslyn', async (event, code) => {
        const { spawn } = require('child_process');

        // Determine path to validator
        // In Dev: K:\...\RxFlow.Validator\bin\Debug\net9.0\RxFlow.Validator.exe
        // In Prod: resources/RxFlow.Validator.exe (if we pack it)
        console.log('[Roslyn] process.env.NODE_ENV:', process.env.NODE_ENV);
        console.log('[Roslyn] app.isPackaged:', require('electron').app.isPackaged);

        // Use app.isPackaged as more reliable indicator
        const isDev = !require('electron').app.isPackaged;
        console.log('[Roslyn] isDev:', isDev);

        return new Promise((resolve) => {

            const validatorPath = isDev
                ? path.join(__dirname, '..', 'RxFlow.Validator', 'bin', 'Debug', 'net7.0', 'RxFlow.Validator.exe')
                : path.join(process.resourcesPath, 'RxFlow.Validator.exe');

            console.log('[Roslyn] Looking for validator at:', validatorPath);
            console.log('[Roslyn] __dirname is:', __dirname);

            // Check if validator exists
            if (!require('fs').existsSync(validatorPath)) {
                console.warn('[Roslyn] Validator not found at:', validatorPath);
                resolve([{ Id: 'ERR_VALIDATOR_MISSING', Message: 'RxFlow Validator not found. Please build the .NET project.', Line: 0, Severity: 'Warning' }]);
                return;
            }

            const child = spawn(validatorPath, [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());

            child.on('close', (code) => {
                if (code !== 0) {
                    console.error('Validator exited with code', code, stderr);
                    resolve([{ Id: 'ERR_PROCESS', Message: `Validator process failed: ${stderr}`, Line: 0, Severity: 'Error' }]);
                    return;
                }
                try {
                    // Find the JSON array in output (ignore build logs if any)
                    // dotnet run might output "Building..."
                    // We look for [ ... ]
                    const jsonStart = stdout.indexOf('[');
                    const jsonEnd = stdout.lastIndexOf(']');
                    if (jsonStart >= 0 && jsonEnd > jsonStart) {
                        const json = stdout.substring(jsonStart, jsonEnd + 1);
                        resolve(JSON.parse(json));
                    } else {
                        resolve([]); // No output?
                    }
                } catch (e) {
                    console.error('Failed to parse validator output', e, stdout);
                    resolve([{ Id: 'ERR_PARSE', Message: 'Failed to parse validator output', Line: 0, Severity: 'Error' }]);
                }
            });

            // Write code to stdin
            child.stdin.write(code);
            child.stdin.end();
        });
    });

    console.log('[DEBUG] HappyTool Main Process Started - ID: 8888');
    console.log('Starting internal server...');
    try {
        await startServer(app.getPath('userData'));
        console.log('Internal server started!');
    } catch (e) {
        console.error('Failed to start internal server:', e);
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
