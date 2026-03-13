import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliApp } from '../../CliApp';

if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
        return Promise.resolve(new ArrayBuffer(this.size || 0));
    };
}

// Mock dependencies
vi.mock('../../components/BlockTest/hooks/useBlockTest', () => ({
    useBlockTest: vi.fn(() => ({
        scenarios: [{ name: 'Test Scenario' }],
        pipelines: [{ name: 'Test Pipeline' }],
        executePipeline: vi.fn().mockResolvedValue(true),
        executeScenario: vi.fn().mockResolvedValue(true)
    }))
}));

// Mock dynamic import for rpmParser
vi.mock('../../utils/rpmParser', () => ({
    extractTpkFromRpm: vi.fn().mockResolvedValue({
        name: 'test_exported.tpk',
        data: new Blob(['fake_data'])
    })
}));

describe('CliApp Renderer Entry', () => {
    let mockElectronAPI: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockElectronAPI = {
            onCliCommand: vi.fn().mockImplementation((cb) => {
                // Simulate saving the callback so we can manually trigger it in tests
                mockElectronAPI._triggerCliCommand = cb;
                return () => { }; // return mock unsubscribe function
            }),
            cliReady: vi.fn(),
            cliStdout: vi.fn(),
            cliStderr: vi.fn(),
            cliExit: vi.fn(),
            getCliSettings: vi.fn().mockResolvedValue(null),
            readFile: vi.fn(),
            saveFileDirect: vi.fn(),
            fetchUrl: vi.fn(),
            getFileSize: vi.fn(),
            readFileSegment: vi.fn(),
            proxyRequest: vi.fn()
        };

        // Inject the mock API into window object
        (window as any).electronAPI = mockElectronAPI;

        // Setup local storage wrapper
        const localStorageMock = (() => {
            let store: any = {};
            return {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => { store[key] = value.toString(); },
                removeItem: (key: string) => { delete store[key]; },
                clear: () => { store = {}; }
            };
        })();
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    });

    afterEach(() => {
        delete (window as any).electronAPI;
    });

    const renderCliApp = () => {
        return render(<CliApp />);
    };

    it('should initialize and notify main process that it is ready', () => {
        renderCliApp();
        expect(mockElectronAPI.onCliCommand).toHaveBeenCalled();
        expect(mockElectronAPI.cliReady).toHaveBeenCalled();
        expect(mockElectronAPI.cliStdout).toHaveBeenCalledWith('CLI Renderer Ready...\n');
        expect(screen.getByText(/Initializing CLI Mode.../i)).toBeInTheDocument();
    });

    it('should exit with error on unknown command', async () => {
        renderCliApp();

        // Trigger command
        await act(async () => {
            await mockElectronAPI._triggerCliCommand({ command: 'unknown-cmd', payload: {} });
        });

        expect(mockElectronAPI.cliStderr).toHaveBeenCalledWith('Unknown CLI command: unknown-cmd\n');
        expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(1);
    });

    describe('json-tool', () => {
        it('should beautify JSON file correctly', async () => {
            renderCliApp();

            mockElectronAPI.readFile.mockResolvedValue('{"minified":true}');
            mockElectronAPI.saveFileDirect.mockResolvedValue({ status: 'success', filePath: '/out/beautified.json' });

            await act(async () => {
                await mockElectronAPI._triggerCliCommand({
                    command: 'json-tool',
                    payload: { inputPath: '/in/file.json', outputPath: '/out/file.json', cwd: '/mock' }
                });
            });

            expect(mockElectronAPI.readFile).toHaveBeenCalledWith('/in/file.json');
            expect(mockElectronAPI.saveFileDirect).toHaveBeenCalled();

            // Should encode and save properly formatted JSON
            const [savedUint8Array, savedPath] = mockElectronAPI.saveFileDirect.mock.calls[0];
            const decoder = new TextDecoder();
            const decodedJson = decoder.decode(savedUint8Array);

            expect(decodedJson).toContain('"minified": true');
            expect(savedPath).toBe('/out/file.json');
            expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(0);
        });

        it('should handle json parse error', async () => {
            renderCliApp();

            mockElectronAPI.readFile.mockResolvedValue('{"invalid_json":');

            await act(async () => {
                await mockElectronAPI._triggerCliCommand({
                    command: 'json-tool',
                    payload: { inputPath: '/in/file.json' }
                });
            });

            expect(mockElectronAPI.cliStderr).toHaveBeenCalledWith(expect.stringContaining('[Error] json-tool failed:'));
            expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(1);
        });
    });

    describe('post-tool', () => {
        it('should execute API request from settings', async () => {
            // Setup settings in localStorage
            window.localStorage.setItem('devtool_suite_settings', JSON.stringify({
                savedRequests: [
                    { name: 'MyReq', method: 'GET', url: 'https://api.test.com', headers: [] }
                ]
            }));

            renderCliApp();

            mockElectronAPI.proxyRequest.mockResolvedValue({
                status: 200, statusText: 'OK', data: { success: true }
            });

            await act(async () => {
                await mockElectronAPI._triggerCliCommand({
                    command: 'post-tool',
                    payload: { requestName: 'MyReq' }
                });
            });

            expect(mockElectronAPI.proxyRequest).toHaveBeenCalledWith({
                method: 'GET',
                url: 'https://api.test.com',
                headers: {},
                body: undefined
            });

            expect(mockElectronAPI.cliStdout).toHaveBeenCalledWith(expect.stringContaining('[Post Tool] Response: 200 OK'));
            expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(0);
        });

        it('should fail if request is not found', async () => {
            window.localStorage.setItem('devtool_suite_settings', JSON.stringify({
                savedRequests: []
            }));

            renderCliApp();

            await act(async () => {
                await mockElectronAPI._triggerCliCommand({
                    command: 'post-tool',
                    payload: { requestName: 'MissingReq' }
                });
            });

            expect(mockElectronAPI.cliStderr).toHaveBeenCalledWith(expect.stringContaining('[Error] Request execution failed: Request named "MissingReq" not found.'));
            expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(1);
        });
    });

    describe('tpk-extractor', () => {
        it('should route RPM extraction from URL', async () => {
            renderCliApp();

            mockElectronAPI.fetchUrl.mockResolvedValue(new ArrayBuffer(10));
            mockElectronAPI.saveFileDirect.mockResolvedValue({ status: 'success', filePath: '/out/test.tpk' });

            try {
                await act(async () => {
                    await mockElectronAPI._triggerCliCommand({
                        command: 'tpk-extractor',
                        payload: {
                            input: 'https://repo.test/test.rpm',
                            outputPath: '/out/test.tpk',
                            cwd: '/mock'
                        }
                    });
                });
            } catch (e) {
                // Ignore thrown errors in the test, we check cliStderr
            }

            if (mockElectronAPI.cliStderr.mock.calls.length > 0) {
                console.error('tpk-extractor stdErr:', mockElectronAPI.cliStderr.mock.calls);
            }

            expect(mockElectronAPI.fetchUrl).toHaveBeenCalledWith('https://repo.test/test.rpm', 'buffer');
            expect(mockElectronAPI.saveFileDirect).toHaveBeenCalled();
            expect(mockElectronAPI.cliStdout).toHaveBeenCalledWith(expect.stringContaining('[Success] TPK saved to: /out/test.tpk'));
            expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(0);
        });

        it('should route RPM extraction from Local File', async () => {
            renderCliApp();

            mockElectronAPI.getFileSize.mockResolvedValue(100);
            mockElectronAPI.readFileSegment.mockResolvedValue(new ArrayBuffer(100));
            mockElectronAPI.saveFileDirect.mockResolvedValue({ status: 'success', filePath: '/out/test2.tpk' });

            try {
                await act(async () => {
                    await mockElectronAPI._triggerCliCommand({
                        command: 'tpk-extractor',
                        payload: {
                            input: 'C:\\test2.rpm',
                            outputPath: '/out/test2.tpk',
                            cwd: 'C:\\'
                        }
                    });
                });
            } catch (e) { }

            if (mockElectronAPI.cliStderr.mock.calls.length > 0) {
                console.error('tpk-extractor stdErr (local):', mockElectronAPI.cliStderr.mock.calls);
            }

            expect(mockElectronAPI.getFileSize).toHaveBeenCalledWith('C:\\test2.rpm');
            expect(mockElectronAPI.readFileSegment).toHaveBeenCalledWith({ path: 'C:\\test2.rpm', start: 0, end: 100 });
            expect(mockElectronAPI.saveFileDirect).toHaveBeenCalled();
            expect(mockElectronAPI.cliExit).toHaveBeenCalledWith(0);
        });
    });

    describe('block-test', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should render CliBlockTestWrapper and trigger scenario execution asynchronously', async () => {
            renderCliApp();

            await act(async () => {
                await mockElectronAPI._triggerCliCommand({
                    command: 'block-test',
                    payload: {
                        scenarioName: 'Test Scenario'
                    }
                });
            });

            // Advance the timer by 3.5s (3s init + 0.5s margin) to trigger the initialization
            await act(async () => {
                vi.advanceTimersByTime(3500);
            });

            // Wait for microtasks (the async callback of setTimeout)
            await act(async () => {
                await Promise.resolve();
            });

            // Check if Found Scenario was logged
            const stdoutCalls = mockElectronAPI.cliStdout.mock.calls.map((call: any) => call[0]);
            const containsScenarioOk = stdoutCalls.some((msg: string) => msg.includes('Found Scenario: "Test Scenario"'));

            if (!containsScenarioOk) {
                console.log('Current stdout calls:', stdoutCalls);
            }

            expect(containsScenarioOk).toBeTruthy();
        });
    });

    describe('analyze-diff', () => {
        it('should route analyze-diff command correctly', async () => {
            renderCliApp();

            mockElectronAPI.getCliSettings.mockResolvedValue({
                logRules: [{ name: 'mission1' }]
            });

            await act(async () => {
                await mockElectronAPI._triggerCliCommand({
                    command: 'analyze-diff',
                    payload: {
                        filterName: 'mission1',
                        leftPath: 'left.log',
                        rightPath: 'right.log',
                        outputPath: 'out.json',
                        cwd: '/mock'
                    }
                });
            });

            expect(mockElectronAPI.cliStdout).toHaveBeenCalledWith(expect.stringContaining('[Analyze Diff]'));
        });
    });
});
