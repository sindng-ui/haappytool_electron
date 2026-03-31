import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCliHandlers } from '../../hooks/useCliHandlers';

// 🐧 팁: Web Worker는 테스트 환경에서 직접 실행하기 어려우므로, vi.fn()으로 모킹하여
// 메시지 송수신 흐름(INIT -> PROCESS_CHUNK -> RESULT_UPDATE)을 시뮬레이션합니다. ⚡
const MockWorker = vi.fn();
vi.mock('../../workers/NetTraffic.worker.ts?worker', () => ({
    default: MockWorker
}));

// 비교 로직 유틸리티 모킹
vi.mock('../../utils/netTrafficDiffUtils', () => ({
    compareEndpoints: vi.fn((l, r) => [{ templateUri: 'diff-endpoint', diff: 10 }]),
    compareUAs: vi.fn((l, r) => [{ variables: { AppName: 'DiffUA' }, diff: 1 }])
}));

describe('useCliHandlers - NetTraffic CLI', () => {
    let mockElectronAPI: any;
    let stdoutLogs: string[] = [];
    let stderrLogs: string[] = [];

    const mockStdout = (msg: string) => stdoutLogs.push(msg);
    const mockStderr = (msg: string) => stderrLogs.push(msg);

    beforeEach(() => {
        stdoutLogs = [];
        stderrLogs = [];
        vi.clearAllMocks();

        // Electron 브릿지 API 모킹
        mockElectronAPI = {
            getFileSize: vi.fn().mockResolvedValue(100),
            readFileSegment: vi.fn().mockResolvedValue(new TextEncoder().encode('mock content')),
            saveFileDirect: vi.fn().mockResolvedValue({ status: 'success', filePath: '/mock/result.json' }),
            cliStdout: vi.fn(),
            cliStderr: vi.fn()
        };
        (window as any).electronAPI = mockElectronAPI;
        vi.stubGlobal('electronAPI', mockElectronAPI);

        // localStorage 설정 모킹 (GUI에서 설정한 값 시뮬레이션)
        const store: Record<string, string> = {
            'happytool_nettraffic_ua_pattern': JSON.stringify({ keywords: 'UA', template: '$(UA)', enabled: true }),
            'happytool_nettraffic_traffic_patterns': JSON.stringify([{ id: '1', alias: 'Test', keywords: 'K', extractRegex: 'R', enabled: true }])
        };
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

    // 워커 생성을 기다리는 헬퍼 함수
    const waitForWorkers = async (workers: any[], count: number, timeout = 2000) => {
        const start = Date.now();
        while (workers.length < count) {
            if (Date.now() - start > timeout) throw new Error(`Timeout waiting for ${count} workers`);
            await new Promise(r => setTimeout(r, 10));
        }
    };

    it('should handle single mode NetTraffic analysis', async () => {
        const { result } = renderHook(() => useCliHandlers());
        const workers: any[] = [];

        // 워커 인스턴스 캡처 설정
        vi.mocked(MockWorker).mockImplementation(function(this: any) {
            this.postMessage = vi.fn();
            this.terminate = vi.fn();
            this.onmessage = null;
            workers.push(this);
            return this;
        } as any);

        const payload = { inputPath: 'test.log', cwd: '/base' };
        const promise = result.current.handleNetTraffic(payload, mockStdout, mockStderr);

        // 1. 워커 생성 확인 및 초기화 메시지 검증
        await waitForWorkers(workers, 1);
        const w = workers[0];
        expect(w.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'INIT' }));

        // 2. 워커의 분석 완료(RESULT_UPDATE) 시뮬레이션
        await act(async () => {
            w.onmessage({ 
                data: { 
                    type: 'RESULT_UPDATE', 
                    payload: { 
                        target: 'single', 
                        data: [{ templateUri: '/api/v1/test', totalCount: 100 }],
                        uaData: [],
                        insights: { totalRequests: 100 }
                    } 
                } 
            });
        });

        await promise;

        // 3. 파일 저장 및 최종 결과 검증
        expect(mockElectronAPI.saveFileDirect).toHaveBeenCalled();
        const [uint8, path] = mockElectronAPI.saveFileDirect.mock.calls[0];
        const savedData = JSON.parse(new TextDecoder().decode(uint8));
        
        expect(savedData.mode).toBe('single');
        expect(savedData.endpoints[0].templateUri).toBe('/api/v1/test');
        expect(stdoutLogs.some(l => l.includes('NetTraffic analysis complete'))).toBe(true);
    });

    it('should handle compare mode NetTraffic analysis', async () => {
        const { result } = renderHook(() => useCliHandlers());
        const workers: any[] = [];

        vi.mocked(MockWorker).mockImplementation(function(this: any) {
            this.postMessage = vi.fn();
            this.terminate = vi.fn();
            this.onmessage = null;
            workers.push(this);
            return this;
        } as any);

        const payload = { leftPath: 'left.log', rightPath: 'right.log', cwd: '/base' };
        const promise = result.current.handleNetTraffic(payload, mockStdout, mockStderr);

        // 2개의 워커가 병렬로 생성되어야 함
        await waitForWorkers(workers, 2);

        // 두 워커의 결과를 각각 시뮬레이션
        await act(async () => {
            workers[0].onmessage({ 
                data: { 
                    type: 'RESULT_UPDATE', 
                    payload: { target: 'left', data: [], uaData: [], insights: {} } 
                } 
            });
            workers[1].onmessage({ 
                data: { 
                    type: 'RESULT_UPDATE', 
                    payload: { target: 'right', data: [], uaData: [], insights: {} } 
                } 
            });
        });

        await promise;

        // 최종 결과 검증 (비교 로직 모킹 결과 포함)
        const [uint8] = mockElectronAPI.saveFileDirect.mock.calls[0];
        const savedData = JSON.parse(new TextDecoder().decode(uint8));
        
        expect(savedData.mode).toBe('compare');
        expect(savedData.comparison.endpointDiffs[0].templateUri).toBe('diff-endpoint');
        expect(stdoutLogs.some(l => l.includes('Generating comparison/diff data'))).toBe(true);
    });

    it('should handle worker error and log to stderr', async () => {
        const { result } = renderHook(() => useCliHandlers());
        const workers: any[] = [];

        vi.mocked(MockWorker).mockImplementation(function(this: any) {
            this.postMessage = vi.fn();
            this.terminate = vi.fn();
            workers.push(this);
            return this;
        } as any);

        const payload = { inputPath: 'fail.log', cwd: '/base' };
        const promise = result.current.handleNetTraffic(payload, mockStdout, mockStderr);

        await waitForWorkers(workers, 1);
        
        // 🐧 팁: 비동기 에러 테스트 시, onmessage를 호출한 즉시 promise가 reject되므로
        // act() 내에서 에러를 던지기보다 직접 호출하고 reject를 기다리는 것이 더 깔끔합니다.
        workers[0].onmessage({ data: { type: 'ERROR', payload: 'Mock indexing failed' } });

        await expect(promise).rejects.toThrow('Mock indexing failed');
        expect(stderrLogs.some(l => l.includes('Mock indexing failed'))).toBe(true);
    });
});
