const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { program } = require('commander');

let hiddenWindow = null;

// 터미널 색상 출력을 위한 chalk 패키지
let chalk;
(async () => {
    chalk = (await import('chalk')).default;
})();

function createHiddenWindow() {
    return new Promise((resolve) => {
        hiddenWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                preload: path.join(__dirname, 'preload.cjs')
            }
        });

        // 콘솔 메시지 릴레이 (Renderer -> 터미널)
        hiddenWindow.webContents.on('console-message', (event, level, message) => {
            // Vue/React 개발 모드 로깅 등 불필요한 메시지 필터링
            if (message.startsWith('[CLI]')) {
                const msg = message.replace('[CLI]', '').trim();
                console.log(chalk ? chalk.blue(msg) : msg);
            } else if (level >= 2) {
                console.error(chalk ? chalk.red(`[Renderer Error] ${message}`) : `[Renderer Error] ${message}`);
            }
        });

        const isDev = !app.isPackaged;
        // CLI 전용 라우트나 파라미터를 넘겨서 UI 렌더링을 최소화할 수 있음.
        // 현재는 기존 로직을 온전히 타기 위해 동일한 index.html을 로드하되 URL 파라미터로 구분.
        const useDevServer = !app.isPackaged && process.env.NODE_ENV !== 'production';

        ipcMain.once('cli-ready', () => {
            resolve(hiddenWindow);
        });

        if (useDevServer) {
            hiddenWindow.loadURL('http://127.0.0.1:3000?mode=cli');
        } else {
            hiddenWindow.loadURL('app://./index.html?mode=cli');
        }
    });
}

// 공통 로그 출력 헬퍼
function logInfo(msg) { console.log(chalk ? chalk.greenBright(msg) : msg); }
function logError(msg) { console.error(chalk ? chalk.redBright.bold(msg) : msg); }

async function runCli(args) {
    // IPC 이벤트: 렌더러에서 터미널 출력 및 종료 요청 처리
    ipcMain.on('cli-stdout', (event, msg) => {
        process.stdout.write(msg);
    });

    ipcMain.on('cli-stderr', (event, msg) => {
        process.stderr.write(chalk ? chalk.red(msg) : msg);
    });

    ipcMain.on('cli-exit', (event, code) => {
        app.exit(code || 0);
    });

    program
        .name('HappyTool CLI')
        .description('Headless Command Line Interface for HappyTool')
        .version(app.getVersion());

    // 1. Log Extractor
    program.command('log-extractor')
        .description('Extract logs using a saved HappyTool mission/filter')
        .requiredOption('-f, --filter <name>', 'Name of the saved filter/mission')
        .requiredOption('-i, --input <path>', 'Path to the input log file')
        .option('-o, --output <path>', 'Path to save the output text file')
        .action(async (options) => {
            logInfo(`Starting Log Extractor CLI...`);
            logInfo(`Filter: ${options.filter}`);
            logInfo(`Input: ${options.input}`);
            if (options.output) logInfo(`Output: ${options.output}`);

            // 렌더러 생성 후 명령 하달
            await createHiddenWindow();
            hiddenWindow.webContents.send('cli-run-command', {
                command: 'log-extractor',
                payload: {
                    filterName: options.filter,
                    inputPath: path.resolve(options.input),
                    outputPath: options.output ? path.resolve(options.output) : null,
                    cwd: process.cwd()
                }
            });
        });

    program.command('json-tool')
        .description('Beautify a JSON file')
        .requiredOption('-i, --input <path>', 'Input JSON file path')
        .option('-o, --output <path>', 'Output file path')
        .action(async (options) => {
            logInfo(`Starting Json Tool CLI...`);
            await createHiddenWindow();
            hiddenWindow.webContents.send('cli-run-command', {
                command: 'json-tool',
                payload: {
                    inputPath: path.resolve(options.input),
                    outputPath: options.output ? path.resolve(options.output) : null,
                    cwd: process.cwd()
                }
            });
        });

    program.command('post-tool')
        .description('Execute HTTP request using saved Post Tool configuration')
        .requiredOption('-n, --name <name>', 'Saved request name')
        .action(async (options) => {
            logInfo(`Starting Post Tool CLI...`);
            await createHiddenWindow();
            hiddenWindow.webContents.send('cli-run-command', {
                command: 'post-tool',
                payload: {
                    requestName: options.name,
                    cwd: process.cwd()
                }
            });
        });

    // 지원되지 않는 옵션 처리
    program.on('command:*', function () {
        logError('Invalid command: ' + program.args.join(' '));
        logError('See --help for a list of available commands.');
        app.exit(1);
    });

    try {
        // Electron 실행 시 기본으로 삽입되는 exec path 등 제외
        program.parse(args, { from: 'user' });
    } catch (err) {
        logError(err.message);
        app.exit(1);
    }
}

module.exports = { runCli };
