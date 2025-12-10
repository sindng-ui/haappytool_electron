import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLogExtractorLogic } from '../../hooks/useLogExtractorLogic';

// Mock Worker
class WorkerMock {
    onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
    postMessage(message: any) {
        // Echo back or handle specific messages for testing
    }
    terminate() { }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent() { return true; }
}

global.Worker = WorkerMock as any;

// Mock URL
global.URL = class extends URL {
    constructor(url: string | URL, base?: string | URL) {
        super(url, base || 'http://localhost');
    }
} as any;


describe('useLogExtractorLogic', () => {
    it('initializes with default values', () => {
        const { result } = renderHook(() => useLogExtractorLogic({
            rules: [],
            onUpdateRules: vi.fn(),
            onExportSettings: vi.fn(),
            onImportSettings: vi.fn()
        }));

        expect(result.current.isDualView).toBe(false);
        expect(result.current.leftFileName).toBe('');
    });

    it('toggles dual view', async () => {
        const { result } = renderHook(() => useLogExtractorLogic({
            rules: [],
            onUpdateRules: vi.fn(),
            onExportSettings: vi.fn(),
            onImportSettings: vi.fn()
        }));

        expect(result.current.isDualView).toBe(false);

        act(() => {
            result.current.setIsDualView(true);
        });

        expect(result.current.isDualView).toBe(true);
    });
});
