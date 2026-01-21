import { renderHook, act, waitFor } from '@testing-library/react';
import { useLogExtractorLogic } from '../../hooks/useLogExtractorLogic';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// --- Mocks ---

import { getStoredValue } from '../../utils/db';

// Define hoisted mocks for things we need to access directly but are inside factories
const { mockedAddToast } = vi.hoisted(() => ({ mockedAddToast: vi.fn() }));

// Mock Database Utils
vi.mock('../../utils/db', () => ({
    getStoredValue: vi.fn().mockResolvedValue(null),
    setStoredValue: vi.fn(),
}));

// Mock Toast Context
vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: mockedAddToast }),
}));

// Mock Web Worker
class MockWorker {
    static instances: MockWorker[] = [];

    // Helper to access the 'last' created worker, usually Right Pane or just convenient
    static get lastInstance() {
        return this.instances[this.instances.length - 1];
    }

    postMessage = vi.fn();
    terminate = vi.fn();
    onmessage: ((e: MessageEvent) => void) | null = null;
    addEventListener = vi.fn();
    removeEventListener = vi.fn();

    constructor() {
        MockWorker.instances.push(this);
    }

    // Helper to simulate worker response
    emitMessage(data: any) {
        if (this.onmessage) {
            this.onmessage({ data } as MessageEvent);
        }
    }

    static reset() {
        this.instances = [];
    }
}
// Assign to global
vi.stubGlobal('Worker', MockWorker);


describe('useLogExtractorLogic (Frontend Logic)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAddToast.mockClear();
        MockWorker.reset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Helper props
    const defaultProps = {
        rules: [],
        onUpdateRules: vi.fn(),
        onExportSettings: vi.fn(),
        onImportSettings: vi.fn(),
        configPanelWidth: 300,
        setConfigPanelWidth: vi.fn(),
        tabId: 'test-tab',
        isActive: true
    };

    it('should initialize and spawn workers', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));

        // Should create Left and Right workers
        expect(MockWorker.instances.length).toBe(2);
        expect(result.current).toBeDefined();
    });

    it('should handle Tizen connection start (sdb)', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));

        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });

        act(() => {
            // handleTizenStreamStart(socket, deviceName, mode)
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'sdb');
        });

        // Verify state updates
        expect(result.current.tizenSocket).toBe(mockSocket);

        // Check Left Worker (index 0)
        const leftWorker = MockWorker.instances[0];
        expect(leftWorker.postMessage).toHaveBeenCalledWith({ type: 'INIT_STREAM' });
    });

    it('should BUFFER log_data for 500ms before sending to worker', async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));
        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });

        act(() => {
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'sdb');
        });

        const leftWorker = MockWorker.instances[0];
        // Clear previous calls (INIT_STREAM etc)
        leftWorker.postMessage.mockClear();

        // 1. Emit Log Data
        const logLine = 'Log Line 1\n';
        act(() => {
            mockSocket.emit('log_data', logLine);
        });

        // 2. Immediate check: Should NOT have sent yet
        expect(leftWorker.postMessage).not.toHaveBeenCalled();

        // 3. Advance time by 400ms (Total 400ms) - Still waiting
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(leftWorker.postMessage).not.toHaveBeenCalled();

        // 4. Advance time by 200ms (Total 600ms) - Should flush
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(leftWorker.postMessage).toHaveBeenCalledWith({
            type: 'PROCESS_CHUNK',
            payload: logLine
        });

        vi.useRealTimers();
    });

    it('should FLUSH IMMEDIATELY if buffer exceeds limit (>2000 items)', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));
        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });

        act(() => {
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'sdb');
        });
        const leftWorker = MockWorker.instances[0];
        leftWorker.postMessage.mockClear();

        // Emit 2005 lines rapidly
        act(() => {
            // Arrays are faster to emit
            for (let i = 0; i < 2005; i++) {
                mockSocket.emit('log_data', `Line ${i}\n`);
            }
        });

        // Should have called postMessage at least once (for the flush)
        // Note: The logic flushes ONE chunk when it hits 2001. 
        // Then remaining 4 might buffer.
        expect(leftWorker.postMessage).toHaveBeenCalled();

        // Verify the payload of the first call contains many lines
        const callArgs = leftWorker.postMessage.mock.calls[0][0];
        expect(callArgs.type).toBe('PROCESS_CHUNK');
        expect(callArgs.payload.length).toBeGreaterThan(100); // Should be a big chunk
    });

    it('should reset state on disconnect', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));
        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });

        act(() => {
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'sdb');
        });

        expect(result.current.tizenSocket).toBeTruthy();

        act(() => {
            mockSocket.emit('disconnect');
        });

        expect(result.current.tizenSocket).toBeNull();
    });

    it('should handle SSH Error event', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));
        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });

        act(() => {
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'ssh');
        });

        const leftWorker = MockWorker.instances[0];
        leftWorker.postMessage.mockClear();

        // Emit SSH Error
        act(() => {
            mockSocket.emit('ssh_error', { message: 'Auth Failed' });
        });

        // 1. Should show toast
        expect(mockedAddToast).toHaveBeenCalledWith(expect.stringContaining('SSH Error: Auth Failed'), 'error');

        // 2. Should append error to log (flushed to worker)
        expect(leftWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'PROCESS_CHUNK',
            payload: expect.stringContaining('[SSH ERROR] Auth Failed')
        }));
    });

    it('should handle SSH Auth Request and Response', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));
        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });
        // Spy on emit
        const emitSpy = vi.spyOn(mockSocket, 'emit');

        act(() => {
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'ssh');
        });

        // Emit Auth Request
        act(() => {
            mockSocket.emit('ssh_auth_request', { prompt: 'Password: ', echo: false });
        });

        // Should show toast
        expect(mockedAddToast).toHaveBeenCalledWith(expect.stringContaining('Input Required'), 'info');

        // Send Command (Response)
        act(() => {
            result.current.sendTizenCommand('secret_password');
        });

        // Should emit ssh_auth_response
        expect(emitSpy).toHaveBeenCalledWith('ssh_auth_response', 'secret_password');

        // And reset auth state (subsequent commands should be normal ssh_write)
        emitSpy.mockClear();
        act(() => {
            result.current.sendTizenCommand('ls -la');
        });
        expect(emitSpy).toHaveBeenCalledWith('ssh_write', 'ls -la');
    });

    it('should handle logical disconnect (sdb_status)', () => {
        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));
        const mockSocket = Object.assign(new EventEmitter(), {
            disconnect: vi.fn(),
            connect: vi.fn(),
        });

        act(() => {
            result.current.handleTizenStreamStart(mockSocket as any, 'test-device', 'sdb');
        });
        expect(result.current.tizenSocket).toBeTruthy();

        // Emit logical disconnect
        act(() => {
            mockSocket.emit('sdb_status', { status: 'disconnected' });
        });

        expect(result.current.tizenSocket).toBeNull();
    });

    it('should load logViewPreferences from DB on mount', async () => {
        // Setup mock return
        vi.mocked(getStoredValue).mockResolvedValueOnce(JSON.stringify({ rowHeight: 99, fontSize: 14 }));

        const { result } = renderHook(() => useLogExtractorLogic(defaultProps));

        // Initial state might be default, need to wait for useEffect -> getStoredValue resolves
        await waitFor(() => {
            expect(result.current.logViewPreferences.rowHeight).toBe(99);
            expect(result.current.logViewPreferences.fontSize).toBe(14);
        });
    });
});
