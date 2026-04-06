const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = electron;
const path = require('path');
const fs = require('fs/promises');
const originalFs = require('fs');

// ✅ CLI 실행 시 GUI와 데이터 잠금 충돌을 피하기 위해 전용 경로 설정
// 이 로직은 app.whenReady() 이전에 실행되어야 안전합니다.
const args = process.defaultApp ? process.argv.slice(2) : process.argv.slice(1);
const isCliMode = args.length > 0 && args[0] === 'cli';
if (isCliMode) {
    const cliDataPath = path.join(app.getPath('userData'), 'cli-session');
    app.setPath('userData', cliDataPath);
}

// ✅ WSL/Virtual Drive(Y:) Environment Fixes & SharedArrayBuffer Enable
if (app && app.commandLine) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
  // ✅ GPU 캐시 오류 수정: 캐시 크기 0으로 설정하여 캐시 생성 시도를 막음 🐧🔧
  app.commandLine.appendSwitch('disk-cache-size', '0');
  app.commandLine.appendSwitch('media-cache-size', '0');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache'); // ✅ 셰이더 캐시도 차단! 🐧
  app.disableHardwareAcceleration();
}

// ✅ 하위 호환성 및 보안을 위해 프로토콜 등록을 최상단으로 이동 (whenReady 이전) 🐧🛡️
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

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
            sandbox: false, // ✅ 형님, 생산 빌드에서도 워커와 SharedArrayBuffer가 원활하도록 샌드박스를 끕니다! 🐧🧼
            preload: path.join(__dirname, 'preload.cjs')
        },
        autoHideMenuBar: true,
        backgroundColor: '#000000', // ✅ React LoadingSplash(bg-black)와 정확히 일치! 🐧
        show: true  // ✅ 창을 즉시 표시: 검정 배경이 바로 보이고 React가 로드되면 스플래시 등장! 빠름! 🐧🚀
    };

    mainWindow = new BrowserWindow(winOptions);

    if (!savedState || savedState.isMaximized) {
        mainWindow.maximize();
    }

    // ✅ Zoom 제한: did-finish-load 시점에만 적용 (창 표시와 분리)
    const isDev = !app.isPackaged;
    console.log('[DEBUG] isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV);

    //  ✅ 전략: did-finish-load에서 Zoom 설정만 처리함다. 창 표시는 show:true가 담당.
    const pageLoadedPromise = new Promise((resolve) => {
        mainWindow.webContents.once('did-finish-load', () => {
            console.log('[DEBUG] did-finish-load fired inside createWindow');
            // Zoom 제한 (렌더러 준비된 후 설정)
            mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
            mainWindow.webContents.setZoomFactor(1.0);
            resolve();
        });
    });

    if (isDev) {
        console.log('[DEBUG] Loading dev URL: http://127.0.0.1:3000');
        await mainWindow.loadURL('http://127.0.0.1:3000');
    } else {
        // Production: loadURL을 통해 'app://' 프로토콜 사용 🐧🚀
        console.log('[DEBUG] Loading production via app:// protocol');
        mainWindow.loadURL('app://./index.html');
    }

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

    return pageLoadedPromise;
}

app.whenReady().then(async () => {
    const { session } = require('electron');

    // ✅ 'app://' 프로토콜 핸들러 등록 (SharedArrayBuffer를 위해 Response에 헤더 주입 가능)
    protocol.handle('app', async (request) => {
        let url = request.url.replace('app://./', '');
        url = url.split('?')[0].split('#')[0];
        const decodedUrl = decodeURIComponent(url);
        const filePath = path.join(__dirname, '../dist', decodedUrl);

        try {
            const data = await originalFs.promises.readFile(filePath);
            const mimeType = require('mime-types').lookup(filePath) || 'application/octet-stream';
            return new Response(data, {
                headers: {
                    'Content-Type': mimeType,
                    'Cross-Origin-Opener-Policy': 'same-origin',
                    'Cross-Origin-Embedder-Policy': 'require-corp'
                }
            });
        } catch (e) {
            console.error('[Protocol] Failed to read:', filePath, e);
            return new Response('Not Found', { status: 404 });
        }
    });

    const csp = "default-src 'self' app:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: app:; " +
        "worker-src 'self' blob: app:; " +
        "style-src 'self' 'unsafe-inline' app:; " +
        "font-src 'self' data: app:; " +
        "img-src 'self' data: app:; " +
        "connect-src 'self' * ws://127.0.0.1:3000 ws://localhost:3000 ws://127.0.0.1:3003 ws://localhost:3003 http://127.0.0.1:3003 http://localhost:3003 app:;";

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
                'Cross-Origin-Opener-Policy': ['same-origin'],
                'Cross-Origin-Embedder-Policy': ['require-corp']
            }
        });
    });

    // IPC Handlers
    ipcMain.handle('readFile', async (event, filePath) => {
        try { return await fs.readFile(filePath, 'utf-8'); }
        catch (error) { console.error('Error reading file:', error); throw error; }
    });

    // ✅ Startup Status 핸들러 추가: 리액트가 뜨자마자 현재 상태를 물어볼 수 있게 함다.
    let startupStatus = { progress: 0, status: 'Initializing...', isComplete: false };
    const bootLogs = [];
    ipcMain.handle('get-startup-status', () => {
        return { ...startupStatus, logs: bootLogs };
    });

    ipcMain.handle('getFileSize', async (event, filePath) => {
        try { const stat = await fs.stat(filePath); return stat.size; }
        catch (error) { console.error('Error getting file size:', error); throw error; }
    });

    const openFileHandles = new Map();

    async function getOrCreateFileHandle(filePath) {
        // 캐시에 없으면 "파일을 여는 Promise" 자체를 즉시 캐시에 등록하여 동시 다발적 접근(Race Condition)을 방지합니다.
        if (!openFileHandles.has(filePath)) {
            const openPromise = (async () => {
                const handle = await fs.open(filePath, 'r');
                return { handle, timeout: null };
            })();
            openFileHandles.set(filePath, openPromise);
        }

        // Promise를 await 하여 핸들 객체를 확보합니다.
        const item = await openFileHandles.get(filePath);

        if (item.timeout) clearTimeout(item.timeout);
        item.timeout = setTimeout(() => {
            item.handle.close().catch(console.error);
            openFileHandles.delete(filePath);
        }, 15000);

        return item.handle;
    }

    ipcMain.handle('readFileSegment', async (event, { path: filePath, start, end }) => {
        try {
            const length = end - start;
            if (length <= 0) return Buffer.alloc(0);

            const fileHandle = await getOrCreateFileHandle(filePath);
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await fileHandle.read(buffer, 0, length, start);
            return buffer.subarray(0, bytesRead);
        } catch (error) {
            console.error('Error reading file segment:', error);
            throw error;
        }
    });

    ipcMain.handle('toggle-fullscreen', (event, flag) => {
        if (mainWindow) mainWindow.setFullScreen(flag);
    });

    // ✅ 설정 파일 저장 핸들러 (CLI 공유용) 🐧📁
    ipcMain.handle('save-settings-file', async (event, settingsJson) => {
        try {
            // CLI 모드일 경우 패런트 디렉토리(원본 userData)에 저장
            const realUserData = isCliMode
                ? path.join(app.getPath('userData'), '..')
                : app.getPath('userData');
            const settingsPath = path.join(realUserData, 'bigbrain_settings.json');
            // Legacy Migration: 만약 신규 파일이 없고 구 파일이 있다면 복사 시도
            const legacyPath = path.join(realUserData, 'settings.json');
            try {
                await fs.access(settingsPath);
            } catch (e) {
                try {
                    await fs.access(legacyPath);
                    await fs.copyFile(legacyPath, settingsPath);
                    console.log('[Main] Migrated legacy settings.json to bigbrain_settings.json');
                } catch (migrateErr) {}
            }
            await fs.writeFile(settingsPath, settingsJson, 'utf-8');
            return { status: 'success' };
        } catch (error) {
            console.error('Error saving settings file:', error);
            throw error;
        }
    });

    // ✅ 설정 파일 로드 핸들러 (CLI 모드에서 GUI 설정 복구용)
    ipcMain.handle('get-cli-settings', async () => {
        try {
            // CLI 전용 세션 폴더의 상위(원본 userData)에서 탐색
            const realUserData = isCliMode
                ? path.join(app.getPath('userData'), '..')
                : app.getPath('userData');
            const settingsPath = path.join(realUserData, 'bigbrain_settings.json');
            const legacyPath = path.join(realUserData, 'settings.json');
            let content;
            try {
                content = await originalFs.promises.readFile(settingsPath, 'utf-8');
            } catch (e) {
                // Fallback to legacy
                try {
                    content = await originalFs.promises.readFile(legacyPath, 'utf-8');
                } catch (ee) {
                    return null;
                }
            }
            return JSON.parse(content);
        } catch (error) {
            // 파일이 없으면 에러 내지 않고 null 반환
            return null;
        }
    });

    ipcMain.handle('saveFile', async (event, content) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            filters: [{ name: 'Text Files', extensions: ['txt', 'log'] }]
        });
        if (canceled || !filePath) return { status: 'canceled' };
        try { await fs.writeFile(filePath, content, 'utf-8'); return { status: 'success', filePath }; }
        catch (error) { return { status: 'error', error: error.message }; }
    });

    // ✅ CLI 전용: 다이얼로그 없이 지정 경로에 직접 저장! 🐧🎯
    ipcMain.handle('saveFileDirect', async (event, { data, filePath, isBase64 }) => {
        try {
            const buffer = isBase64
                ? Buffer.from(data, 'base64')
                : Buffer.from(data);
            await fs.writeFile(filePath, buffer);
            return { status: 'success', filePath };
        } catch (error) {
            console.error('[saveFileDirect] Error:', error);
            return { status: 'error', error: error.message };
        }
    });

    // 🚨 디버깅 전용: 파일 끝에 내용 추가 (로그용) 🐧📝
    ipcMain.handle('appendFileDirect', async (event, { data, filePath, isBase64 }) => {
        try {
            const buffer = isBase64
                ? Buffer.from(data, 'base64')
                : Buffer.from(data);
            await originalFs.promises.appendFile(filePath, buffer);
            return { status: 'success', filePath };
        } catch (error) {
            console.error('[appendFileDirect] Error:', error);
            return { status: 'error', error: error.message };
        }
    });

    ipcMain.handle('saveBinaryFile', async (event, { data, fileName }) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: fileName,
            filters: [{ name: 'Tizen Package', extensions: ['tpk'] }]
        });
        if (canceled || !filePath) return { status: 'canceled' };
        try { await fs.writeFile(filePath, Buffer.from(data)); return { status: 'success', filePath }; }
        catch (error) { console.error('Save failed:', error); return { status: 'error', error: error.message }; }
    });

    ipcMain.handle('copyToClipboard', async (event, text) => {
        try { const { clipboard } = require('electron'); clipboard.writeText(text); return { status: 'success' }; }
        catch (error) { console.error('Clipboard error:', error); throw error; }
    });

    ipcMain.handle('openExternal', async (event, url) => {
        try { await shell.openExternal(url); return { status: 'success' }; }
        catch (error) { console.error('Error opening external:', error); return { status: 'error', error: error.message }; }
    });

    ipcMain.handle('fetchUrl', async (event, { url, type }) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
            if (type === 'buffer') { const arrayBuffer = await response.arrayBuffer(); return Buffer.from(arrayBuffer); }
            else { return await response.text(); }
        } catch (error) { console.error('Fetch URL failed:', error); throw error; }
    });

    ipcMain.handle('proxyRequest', async (event, { method, url, headers, body }) => {
        try {
            const fetchOptions = {
                method, headers,
                body: ['GET', 'HEAD'].includes(method) ? undefined : body
            };
            const response = await fetch(url, fetchOptions);
            const responseHeaders = {};
            for (const [key, value] of response.headers.entries()) { responseHeaders[key] = value; }
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try { data = await response.json(); } catch { data = await response.text(); }
            } else { data = await response.text(); }
            return { status: response.status, statusText: response.statusText, headers: responseHeaders, data: data };
        } catch (error) { console.error('Proxy Request failed:', error); return { error: true, message: error.message }; }
    });

    // ✅ 스트리밍 프록시 요청 핸들러 (실시간 데이터 청크 전송용) 🐧🚀
    ipcMain.handle('streamProxyRequest', async (event, { method, url, headers, body, requestId }) => {
        try {
            const fetchOptions = {
                method, headers,
                body: ['GET', 'HEAD'].includes(method) ? undefined : body
            };
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                const errorText = await response.text();
                return { error: true, status: response.status, message: errorText };
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // 백그라운드에서 스트림 읽기 시작
            (async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('proxy-data-chunk', { requestId, chunk });
                        }
                    }
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('proxy-stream-complete', { requestId });
                    }
                } catch (err) {
                    console.error('[Main] Stream processing error:', err);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('proxy-stream-error', { requestId, message: err.message });
                    }
                }
            })();

            return { status: response.status, statusText: response.statusText };
        } catch (error) {
            console.error('[Main] Stream Proxy Request failed:', error);
            return { error: true, message: error.message };
        }
    });


    ipcMain.handle('getAppPath', () => {
        const isDev = process.env.NODE_ENV === 'development';
        return isDev ? path.join(__dirname, '..') : process.resourcesPath;
    });

    const activeStreams = new Map();
    ipcMain.handle('streamReadFile', (event, filePath, requestId, options = {}) => {
        const stream = originalFs.createReadStream(filePath, {
            encoding: 'utf-8', highWaterMark: 64 * 1024, start: options.start || 0
        });
        activeStreams.set(requestId, stream);
        stream.on('data', (chunk) => { if (mainWindow && activeStreams.has(requestId)) mainWindow.webContents.send('file-chunk', { chunk, requestId }); });
        stream.on('end', () => { activeStreams.delete(requestId); if (mainWindow) mainWindow.webContents.send('file-stream-complete', { requestId }); });
        stream.on('error', (err) => { activeStreams.delete(requestId); console.error('Stream error:', err); if (mainWindow) mainWindow.webContents.send('file-stream-error', { error: err.message, requestId }); });
        return { status: 'started', requestId };
    });

    ipcMain.handle('cancelStream', (event, requestId) => {
        const stream = activeStreams.get(requestId);
        if (stream) { stream.destroy(); activeStreams.delete(requestId); return { status: 'cancelled', requestId }; }
        return { status: 'not_found', requestId };
    });

    ipcMain.handle('validateRoslyn', async (event, code) => {
        return [{ Id: 'INFO_SKIP', Message: 'Validator skipped (Missing .NET Runtime). Please install .NET 7.0.', Line: 0, Severity: 'Warning' }];
    });

    ipcMain.handle('parseRxCode', async (event, code) => {
        const { spawn } = require('child_process');
        const isDev = !require('electron').app.isPackaged;
        return new Promise((resolve) => {
            const validatorPath = isDev
                ? path.join(__dirname, '..', 'RxFlow.Validator', 'bin', 'Debug', 'net7.0', 'RxFlow.Validator.exe')
                : path.join(process.resourcesPath, 'RxFlow.Validator.exe');
            if (!originalFs.existsSync(validatorPath)) {
                resolve({ nodes: [], edges: [], errors: ['RxFlow Validator not found.'] });
                return;
            }
            const child = spawn(validatorPath, ['--parse'], { stdio: ['pipe', 'pipe', 'pipe'] });
            let stdout = ''; let stderr = '';
            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());
            child.on('close', (code) => {
                if (code !== 0) { resolve({ nodes: [], edges: [], errors: [`Validator failed: ${stderr}`] }); return; }
                try {
                    const jsonStart = stdout.indexOf('{'); const jsonEnd = stdout.lastIndexOf('}');
                    if (jsonStart >= 0 && jsonEnd > jsonStart) { resolve(JSON.parse(stdout.substring(jsonStart, jsonEnd + 1))); }
                    else { resolve({ nodes: [], edges: [], errors: [] }); }
                } catch (e) { resolve({ nodes: [], edges: [], errors: ['Failed to parse output'] }); }
            });
            child.stdin.write(code); child.stdin.end();
        });
    });

    ipcMain.handle('run-sdb-command', async (event, cmd) => {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            // ✅ Only allow sdb commands for safety
            if (!cmd.startsWith('sdb ')) {
                resolve({ error: true, message: 'Only sdb commands are allowed' });
                return;
            }
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    resolve({ error: true, message: stderr || error.message });
                } else {
                    resolve({ stdout });
                }
            });
        });
    });

    if (isCliMode) {
        require('./cli.cjs').runCli(args.slice(1));
        return;
    }

    // ✅ 병렬 실행 시작 (윈도우 생성 & 서버 시작)
    const windowLoadPromise = createWindow();

    const originalLog = console.log;
    const sendProgress = (progress, status) => {
        startupStatus = { progress, status, isComplete: progress >= 100 };
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('loading-progress', { progress, status });
        }
    };

    const sendLog = (message) => {
        if (bootLogs.length > 500) bootLogs.shift();
        bootLogs.push(message);
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('loading-log', message);
        }
    };

    console.log = (...args) => {
        const message = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    const str = JSON.stringify(arg);
                    return str.length > 1000 ? '[Large Object]' : str;
                } catch (e) { return '[Circular or Non-Serializable Object]'; }
            }
            return String(arg);
        }).join(' ');

        sendLog(message);
        originalLog.apply(console, args);
    };

    let serverStarted = false;
    let serverError = null;
    const serverStartPromise = (async () => {
        try { 
            const { startServer } = require('../server/index.cjs');
            await startServer(app.getPath('userData')); 
            serverStarted = true; 
        }
        catch (e) { serverError = e; console.error('Failed to start internal server:', e); }
    })();

    // ✅ 서버가 켜질 때까지 가짜 진행률
    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
        if (fakeProgress < 95) {
            fakeProgress += (95 - fakeProgress) * 0.12;
            sendProgress(fakeProgress, 'Starting internal services...');
        }
    }, 90);

    // 둘 다 기다림
    await Promise.all([windowLoadPromise, serverStartPromise]);
    clearInterval(progressInterval);

    if (serverStarted) {
        sendProgress(100, 'Ready!');
        if (mainWindow) mainWindow.webContents.send('loading-complete');
    } else {
        dialog.showErrorBox('Startup Error', `Server failed: ${serverError?.message}`);
        app.quit();
    }

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
