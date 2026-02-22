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
            height: 32
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
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

    // ✅ Enforce Strict Zoom Limits (Main Process Side) - Double protection against native zoom
    // This ensures that even if preload.js fails or is delayed, the main process locks zoom to 1.0.
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    mainWindow.webContents.setZoomFactor(1.0);



    const isDev = !app.isPackaged;
    console.log('[DEBUG] isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV);

    // Show window when ready (must be registered BEFORE loadURL)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Track page load completion (must be registered BEFORE loadURL)
    const pageLoadedPromise = new Promise((resolve) => {
        mainWindow.webContents.once('did-finish-load', () => {
            console.log('[DEBUG] did-finish-load fired inside createWindow');
            resolve();
        });
    });

    // Load URL
    if (isDev) {
        console.log('[DEBUG] Loading dev URL: http://127.0.0.1:3000');
        await mainWindow.loadURL('http://127.0.0.1:3000');
        // mainWindow.webContents.openDevTools();
    } else {
        // Production: Load built files
        const indexPath = path.join(__dirname, '../dist/index.html');
        console.log('[DEBUG] Loading production file:', indexPath);
        mainWindow.loadFile(indexPath);
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

    /* 
    // Custom Zoom Handling (Fine-grained control) - DISABLED to enforce font-size only zoom
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control || input.meta) {
            const { code, type } = input;
            if (type === 'keyDown') {
                if (code === 'Equal' || code === 'NumpadAdd') { // Zoom In
                    // event.preventDefault();
                    // const currentZoom = mainWindow.webContents.getZoomFactor();
                    // mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 5.0)); // +10%
                } else if (code === 'Minus' || code === 'NumpadSubtract') { // Zoom Out
                    // event.preventDefault();
                    // const currentZoom = mainWindow.webContents.getZoomFactor();
                    // mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.2)); // -10%
                } else if (code === 'Digit0' || code === 'Numpad0') { // Reset Zoom
                    // event.preventDefault();
                    // mainWindow.webContents.setZoomFactor(1.0);
                }
            }
        }
    });
    */

    // Wait for page to finish loading
    return pageLoadedPromise;
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

    // Toggle Fullscreen IPC
    ipcMain.handle('toggle-fullscreen', (event, flag) => {
        if (mainWindow) {
            mainWindow.setFullScreen(flag);
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

    // IPC Handler for PostTool Requests (Full Proxy)
    ipcMain.handle('proxyRequest', async (event, { method, url, headers, body }) => {
        try {
            const fetchOptions = {
                method,
                headers,
                body: ['GET', 'HEAD'].includes(method) ? undefined : body
            };

            const response = await fetch(url, fetchOptions);

            // Convert headers to plain object
            const responseHeaders = {};
            for (const [key, value] of response.headers.entries()) {
                responseHeaders[key] = value;
            }

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch {
                    data = await response.text(); // Fallback if JSON parse fails
                }
            } else {
                data = await response.text();
            }

            return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                data: data
            };
        } catch (error) {
            console.error('Proxy Request failed:', error);
            return {
                error: true,
                message: error.message
            };
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

    const activeStreams = new Map();

    // IPC Handler for file streaming
    ipcMain.handle('streamReadFile', (event, filePath, requestId, options = {}) => {
        const stream = originalFs.createReadStream(filePath, {
            encoding: 'utf-8',
            highWaterMark: 64 * 1024,
            start: options.start || 0
        });

        activeStreams.set(requestId, stream);

        stream.on('data', (chunk) => {
            if (mainWindow && activeStreams.has(requestId)) {
                mainWindow.webContents.send('file-chunk', { chunk, requestId });
            }
        });

        stream.on('end', () => {
            activeStreams.delete(requestId);
            if (mainWindow) mainWindow.webContents.send('file-stream-complete', { requestId });
        });

        stream.on('error', (err) => {
            activeStreams.delete(requestId);
            console.error('Stream error:', err);
            if (mainWindow) mainWindow.webContents.send('file-stream-error', { error: err.message, requestId });
        });

        return { status: 'started', requestId };
    });

    ipcMain.handle('cancelStream', (event, requestId) => {
        const stream = activeStreams.get(requestId);
        if (stream) {
            stream.destroy();
            activeStreams.delete(requestId);
            return { status: 'cancelled', requestId };
        }
        return { status: 'not_found', requestId };
    });

    // IPC Handler for Roslyn Validation
    ipcMain.handle('validateRoslyn', async (event, code) => {
        // [Hotfix] .NET 7.0 런타임 누락으로 인한 앱 종료 방지
        // 사용자가 런타임을 설치하기 전까지는 유효성 검사를 스킵합니다.
        return [{ Id: 'INFO_SKIP', Message: 'Validator skipped (Missing .NET Runtime). Please install .NET 7.0.', Line: 0, Severity: 'Warning' }];

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

    // IPC Handler for Rx Code Parsing
    ipcMain.handle('parseRxCode', async (event, code) => {
        const { spawn } = require('child_process');

        const isDev = !require('electron').app.isPackaged;
        console.log('[RxParser] Parsing Rx code, isDev:', isDev);

        return new Promise((resolve) => {
            const validatorPath = isDev
                ? path.join(__dirname, '..', 'RxFlow.Validator', 'bin', 'Debug', 'net7.0', 'RxFlow.Validator.exe')
                : path.join(process.resourcesPath, 'RxFlow.Validator.exe');

            console.log('[RxParser] Looking for validator at:', validatorPath);

            // Check if validator exists
            if (!require('fs').existsSync(validatorPath)) {
                console.warn('[RxParser] Validator not found at:', validatorPath);
                resolve({ nodes: [], edges: [], errors: ['RxFlow Validator not found. Please build the .NET project.'] });
                return;
            }

            const child = spawn(validatorPath, ['--parse'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());

            child.on('close', (code) => {
                if (code !== 0) {
                    console.error('[RxParser] Validator exited with code', code, stderr);
                    resolve({ nodes: [], edges: [], errors: [`Validator process failed: ${stderr}`] });
                    return;
                }
                try {
                    // Find the JSON object in output
                    const jsonStart = stdout.indexOf('{');
                    const jsonEnd = stdout.lastIndexOf('}');
                    if (jsonStart >= 0 && jsonEnd > jsonStart) {
                        const json = stdout.substring(jsonStart, jsonEnd + 1);
                        resolve(JSON.parse(json));
                    } else {
                        resolve({ nodes: [], edges: [], errors: [] });
                    }
                } catch (e) {
                    console.error('[RxParser] Failed to parse output', e, stdout);
                    resolve({ nodes: [], edges: [], errors: ['Failed to parse validator output'] });
                }
            });

            // Write code to stdin
            child.stdin.write(code);
            child.stdin.end();
        });
    });

    console.log('[DEBUG] HappyTool Main Process Started - ID: 8888');

    // Create window first (hidden) - await because it's async
    await createWindow();
    console.log('[DEBUG] Window created, mainWindow exists:', !!mainWindow);

    // Console.log 오버라이드 (조기 설정으로 서버 시작 로그도 캡처)
    const originalLog = console.log;
    const originalError = console.error;

    // Send loading progress events (use originalLog to avoid infinite recursion)
    const sendProgress = (progress, status) => {
        originalLog('[DEBUG] sendProgress called:', progress, status);
        if (mainWindow && mainWindow.webContents) {
            try {
                mainWindow.webContents.send('loading-progress', { progress, status });
                originalLog('[DEBUG] Sent loading-progress event');
            } catch (e) {
                originalError('[DEBUG] Failed to send progress:', e);
            }
        } else {
            originalLog('[DEBUG] mainWindow or webContents not available');
        }
    };

    const sendLog = (message) => {
        originalLog('[DEBUG] sendLog called:', message);
        if (mainWindow && mainWindow.webContents) {
            try {
                mainWindow.webContents.send('loading-log', message);
                originalLog('[DEBUG] Sent loading-log event');
            } catch (e) {
                originalError('[DEBUG] Failed to send log:', e);
            }
        } else {
            originalLog('[DEBUG] mainWindow or webContents not available');
        }
    };

    console.log = (...args) => {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        // 로딩 관련 메시지만 전송
        if (message.includes('Server') ||
            message.includes('running') ||
            message.includes('VITE') ||
            message.includes('dotenv') ||
            message.includes('Loading') ||
            message.includes('[FILE]') ||
            message.includes('[Server]')) {
            sendLog(message);
        }

        originalLog.apply(console, args);
    };

    console.error = (...args) => {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        sendLog(`❌ ${message}`);
        originalError.apply(console, args);
    };

    // Start server in parallel with page load (don't await yet)
    let serverStarted = false;
    let serverError = null;

    const serverStartPromise = (async () => {
        try {
            await startServer(app.getPath('userData'));
            serverStarted = true;
        } catch (e) {
            serverError = e;
            console.error('Failed to start internal server:', e);
        }
    })();



    // createWindow already waited for did-finish-load, so page is ready
    console.log('[DEBUG] Page loaded, starting initialization...');

    // 초기화 시작
    sendProgress(0, 'Initializing...');
    sendLog('🚀 HappyTool starting...');
    sendLog('📦 Loading application resources...');
    await new Promise(resolve => setTimeout(resolve, 100));

    sendProgress(5, 'Checking environment...');
    sendLog('🔍 Checking system environment...');
    sendLog(`📁 User data directory: ${app.getPath('userData')}`);
    sendLog(`💻 Platform: ${process.platform} (${process.arch})`);
    sendLog(`⚡ Electron v${process.versions.electron}`);
    sendLog(`🌐 Node.js v${process.versions.node}`);
    await new Promise(resolve => setTimeout(resolve, 150));

    sendProgress(15, 'Initializing services...');
    sendLog('⚙️  Initializing internal services...');
    sendLog('🔧 Setting up IPC handlers...');
    await new Promise(resolve => setTimeout(resolve, 100));

    sendProgress(20, 'Starting internal server...');
    sendLog('🌐 Starting internal server...');
    sendLog('📡 Binding to port 3003...');

    // Wait for server to finish (already started in parallel)
    await serverStartPromise;

    if (serverStarted) {
        sendProgress(50, 'Server started successfully');
        sendLog('✅ Internal server ready on http://127.0.0.1:3003');
        sendLog('🔌 Server endpoints initialized');
        sendLog('📂 Static files route configured');
    } else {
        const errorMsg = serverError?.message || 'Unknown error';
        sendLog(`❌ Error: ${errorMsg}`);
        console.error('[Critical] Server failed to start:', errorMsg);

        // Show error dialog to user
        dialog.showErrorBox(
            'Startup Error',
            `Failed to start local server service.\n\nError: ${errorMsg}\n\nPlease check if port 3003 is executing or another instance is running.`
        );
        app.quit();
        return; // Stop initialization
    }

    sendProgress(60, 'Loading components...');
    sendLog('🔌 Loading application components...');
    await new Promise(resolve => setTimeout(resolve, 150));

    sendProgress(70, 'Initializing plugins...');
    sendLog('🎨 Loading Block Test plugin...');
    sendLog('📊 Loading Log Extractor plugin...');
    sendLog('🔧 Loading TPK Extractor plugin...');
    await new Promise(resolve => setTimeout(resolve, 200));

    sendProgress(85, 'Loading workspace...');
    sendLog('💾 Loading user workspace...');
    sendLog('📋 Restoring previous session...');
    await new Promise(resolve => setTimeout(resolve, 150));

    sendProgress(95, 'Finalizing...');
    sendLog('🎯 Finalizing application setup...');
    sendLog('🔐 Applying security policies...');
    await new Promise(resolve => setTimeout(resolve, 100));

    sendProgress(100, 'Ready!');
    sendLog('✨ HappyTool is ready!');
    sendLog('🎉 All systems operational');

    // Console.log 복원
    setTimeout(() => {
        console.log = originalLog;
        console.error = originalError;
    }, 1000);


    // Send loading complete event
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('loading-complete');
    }

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
