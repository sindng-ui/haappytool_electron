import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCliHandlers } from '../../hooks/useCliHandlers';

// Mock Workers
const MockWorker = vi.fn();

vi.mock('../../workers/LogProcessor.worker.ts?worker', () => ({
    default: MockWorker
}));

vi.mock('../../workers/SplitAnalysis.worker.ts?worker', () => ({
    default: MockWorker
}));

vi.mock('../../utils/filterGroupUtils', () => ({
    assembleIncludeGroups: vi.fn(() => ({}))
}));

describe('useCliHandlers', () => {
    let mockElectronAPI: any;
    let stdoutLogs: string[] = [];
    let stderrLogs: string[] = [];

    const mockStdout = (msg: string) => stdoutLogs.push(msg);
    const mockStderr = (msg: string) => stderrLogs.push(msg);

    beforeEach(() => {
        stdoutLogs = [];
        stderrLogs = [];
        vi.clearAllMocks();

        mockElectronAPI = {
            cliStdout: vi.fn(),
            cliStderr: vi.fn(),
            getCliSettings: vi.fn(),
            getFileSize: vi.fn().mockResolvedValue(100),
            readFile: vi.fn(),
            saveFileDirect: vi.fn().mockResolvedValue({ status: 'success', filePath: '/mock/path' }),
            readFileSegment: vi.fn(),
            proxyRequest: vi.fn()
        };

        (window as any).electronAPI = mockElectronAPI;
        vi.stubGlobal('electronAPI', mockElectronAPI);
        
        // Mock localStorage
        const store: Record<string, string> = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = value; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const key in store) delete store[key]; }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const waitForWorkers = async (workers: any[], count: number, timeout = 2000) => {
        const start = Date.now();
        while (workers.length < count) {
            if (Date.now() - start > timeout) throw new Error(`Timeout waiting for ${count} workers`);
            await new Promise(r => setTimeout(r, 10));
        }
    };

    describe('handleAnalyzeDiff Sorting Logic', () => {
        it('should correctly sort results and handle worker flow', async () => {
            const { result } = renderHook(() => useCliHandlers());
            
            mockElectronAPI.getCliSettings.mockResolvedValue({
                logRules: [{ name: 'test-filter', bigBrainGroups: [] }]
            });

            const payload = {
                filterName: 'test-filter',
                leftPath: 'left.log',
                rightPath: 'right.log',
                outputPath: 'out.json',
                cwd: '/base'
            };

            // Capture Workers
            const workers: any[] = [];
            vi.mocked(MockWorker).mockImplementation(function(this: any) {
                this.postMessage = vi.fn();
                this.terminate = vi.fn();
                this.addEventListener = vi.fn();
                this.removeEventListener = vi.fn();
                this.onmessage = null;
                workers.push(this);
                return this;
            } as any);

            // Start the process
            const promise = result.current.handleAnalyzeDiff(payload, mockStdout, mockStderr);

            await waitForWorkers(workers, 2);

            // Simulate flow for Left and Right Workers
            await act(async () => {
                // 1. Initialized (Left/Right)
                workers.forEach((w, i) => {
                    const side = i === 0 ? 'LEFT' : 'RIGHT';
                    w.onmessage({ data: { type: 'INDEX_COMPLETE', payload: { totalLines: 100 } } });
                    w.onmessage({ data: { type: 'FILTER_COMPLETE', payload: { matchCount: 50 } } });
                });
            });

            // 2. Metrics & Aliases Request
            // In handleAnalyzeDiff, getMetrics/getAliasEvents use addEventListener
            // 2. Metrics & Aliases Request
            await act(async () => {
                workers.forEach((w, i) => {
                    const side = i === 0 ? 'left' : 'right';
                    // Broadcast to all listeners since we have multiple concurrent requests
                    const listeners = w.addEventListener.mock.calls.filter((c: any) => c[0] === 'message').map((c: any) => c[1]);
                    
                    listeners.forEach((listener: any) => {
                        listener({
                            data: {
                                type: 'ANALYSIS_METRICS_RESULT',
                                requestId: `cli-${side}-metrics`,
                                payload: { sequence: [{}], pointMetrics: {} }
                            }
                        });
                        listener({
                            data: {
                                type: 'ALIAS_EVENTS_RESULT',
                                requestId: `cli-${side}-alias`,
                                payload: { events: [] }
                            }
                        });
                    });
                });
            });

            // 3. Comparison (SplitAnalysisWorker)
            // The split worker is created AFTER metrics are extracted
            await act(async () => {
                // Trigger the next phase by resolving metrics
                // (Already done in the previous act block)
            });

            await waitForWorkers(workers, 3);
            const splitWorker = workers[2]; // Third worker created
            await act(async () => {
                if (splitWorker && splitWorker.onmessage) {
                    splitWorker.onmessage({
                        data: {
                            type: 'SPLIT_ANALYSIS_COMPLETE',
                            payload: {
                                results: [
                                    { key: 'A', deltaDiff: 100, leftAvgDelta: 10, rightAvgDelta: 110 },  // Regression
                                    { key: 'B', deltaDiff: 50, leftAvgDelta: 10, rightAvgDelta: 60 },    // Regression (Smaller)
                                    { key: 'C', deltaDiff: -200, leftAvgDelta: 210, rightAvgDelta: 10 }, // Improvement
                                    { key: 'D', deltaDiff: -50, leftAvgDelta: 60, rightAvgDelta: 10 },  // Improvement (Smaller)
                                    { key: 'E', deltaDiff: 5, leftAvgDelta: 10, rightAvgDelta: 15 }      // Stable
                                ],
                                pointResults: [
                                    { sig: 'Log1', count: 10 },
                                    { sig: 'Log2', count: 100 }
                                ]
                            }
                        }
                    });
                }
            });

            await promise;

            // Verify Sorting
            const [savedUint8] = mockElectronAPI.saveFileDirect.mock.calls[0];
            const resultData = JSON.parse(new TextDecoder().decode(savedUint8));

            // Absolute deltaDiff Descending
            expect(resultData.results.regressions[0].key).toBe('A');
            expect(resultData.results.regressions[1].key).toBe('B');
            expect(resultData.results.improvements[0].key).toBe('C');
            expect(resultData.results.improvements[1].key).toBe('D');
            
            // New Logs by Count Descending
            expect(resultData.results.newLogs[0].sig).toBe('Log2');
            expect(resultData.results.newLogs[1].sig).toBe('Log1');
        });
    });

    describe('handleJsonTool', () => {
        it('should beautify JSON correctly', async () => {
            const { result } = renderHook(() => useCliHandlers());
            const payload = { inputPath: 'in.json', outputPath: 'out.json', cwd: '/base' };
            
            mockElectronAPI.readFile.mockResolvedValue('{"a":1}');
            
            await result.current.handleJsonTool(payload, mockStdout, mockStderr);
            
            expect(mockElectronAPI.readFile).toHaveBeenCalledWith('in.json');
            const [data, path] = mockElectronAPI.saveFileDirect.mock.calls[0];
            const savedText = new TextDecoder().decode(data);
            expect(JSON.parse(savedText)).toEqual({ a: 1 });
            expect(savedText).toContain('    "a": 1'); // Check indentation
            expect(path).toBe('out.json');
        });
    });

    describe('handleLogExtractor', () => {
        it('should extract and save logs correctly', async () => {
            const { result } = renderHook(() => useCliHandlers());
            
            mockElectronAPI.getCliSettings.mockResolvedValue({
                logRules: [{ name: 'test-mission' }],
                defaultOutputFolder: '/default'
            });

            const payload = { filterName: 'test-mission', inputPath: 'in.log', cwd: '/base' };
            const workers: any[] = [];
            vi.mocked(MockWorker).mockImplementation(function(this: any) {
                this.postMessage = vi.fn();
                this.terminate = vi.fn();
                this.onmessage = null;
                workers.push(this);
                return this;
            } as any);

            const promise = result.current.handleLogExtractor(payload, mockStdout, mockStderr);

            await waitForWorkers(workers, 1);

            // Simulate worker flow
            await act(async () => {
                const w = workers[0];
                w.onmessage({ data: { type: 'INDEX_COMPLETE', payload: { totalLines: 100 } } });
                w.onmessage({ data: { type: 'FILTER_COMPLETE', payload: { matchCount: 10 } } });
                w.onmessage({ data: { type: 'FULL_TEXT_DATA', requestId: 'cli-export', payload: { text: 'extracted-content' } } });
            });

            await promise;

            expect(mockElectronAPI.saveFileDirect).toHaveBeenCalled();
            const [data] = mockElectronAPI.saveFileDirect.mock.calls[0];
            expect(new TextDecoder().decode(data)).toBe('extracted-content');
        });
    });

    describe('handlePostTool', () => {
        it('should execute request and log response', async () => {
            const { result } = renderHook(() => useCliHandlers());
            const mockSettings = {
                savedRequests: [
                    { name: 'Req1', method: 'GET', url: 'http://test.com', headers: [{ key: 'H1', value: 'V1' }] }
                ]
            };
            mockElectronAPI.getCliSettings.mockResolvedValue(mockSettings);
            mockElectronAPI.proxyRequest.mockResolvedValue({
                status: 200,
                statusText: 'OK',
                data: { ok: true }
            });

            await result.current.handlePostTool({ requestName: 'Req1' }, mockStdout, mockStderr);

            expect(mockElectronAPI.proxyRequest).toHaveBeenCalledWith({
                method: 'GET',
                url: 'http://test.com',
                headers: { H1: 'V1' },
                body: undefined
            });
            expect(stdoutLogs.some(l => l.includes('200 OK'))).toBe(true);
        });
    });
});
