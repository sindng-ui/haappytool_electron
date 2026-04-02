import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysisAgent } from '../useAnalysisAgent';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---
vi.mock('../../services/hintExtractor', () => ({
  extractHints: vi.fn(),
  parseLogText: vi.fn(async () => [])
}));

vi.mock('../../services/agentApiService', () => ({
  sendToAgent: vi.fn(),
  loadAgentConfig: vi.fn(() => ({
    apiKey: 'test-key',
    endpoint: 'test-url',
    model: 'test-model',
    maxIterations: 3,
    timeoutMs: 30000
  }))
}));

vi.mock('../../services/actionExecutor', () => ({
  executeAction: vi.fn()
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; }
  };
})();
vi.stubGlobal('localStorage', mockLocalStorage);

// Mock electronAPI
vi.stubGlobal('window', {
  electronAPI: {
    proxyRequest: vi.fn()
  }
} as any);

import { extractHints } from '../../services/hintExtractor';
import { sendToAgent } from '../../services/agentApiService';
import { executeAction } from '../../services/actionExecutor';

describe('useAnalysisAgent (Phase 8: Hook UT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    // Default config in localStorage
    mockLocalStorage.setItem('happytool_agent_config', JSON.stringify({
      apiKey: 'test-key',
      endpoint: 'test-url',
      model: 'test-model',
      maxIterations: 3,
      timeoutMs: 30000
    }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useAnalysisAgent());
    expect(result.current.state.status).toBe('idle');
  });

  it('should run full analysis loop (Success Path)', async () => {
    const { result } = renderHook(() => useAnalysisAgent());
    
    vi.mocked(extractHints).mockResolvedValue({
      hints: 'Sample Hints',
      filteredLines: 10,
      analysisTypeMatches: 5
    });
    
    vi.mocked(sendToAgent).mockResolvedValueOnce({
      status: 'PROCESSING',
      thought: '분석을 시작합니다.',
      action: { type: 'SEARCH_KEYWORD', params: { keyword: 'error' } }
    });
    
    vi.mocked(executeAction).mockResolvedValueOnce('Keyword "error" found at line 100');
    
    vi.mocked(sendToAgent).mockResolvedValueOnce({
      status: 'COMPLETED',
      thought: '분석이 완료되었습니다.',
      final_report: '# 최종 보고서\n문제 없음.'
    });

    let analysisPromise: Promise<void>;
    await act(async () => {
      analysisPromise = result.current.startAnalysis([{ text: 'log text', name: 'test.log' }], null, 'crash');
    });

    // Advance timers bit by bit to let all async logic finish
    for (let i = 0; i < 50; i++) {
        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
        });
    }

    await analysisPromise!;

    expect(result.current.state.status).toBe('completed');
    expect(result.current.state.finalReport).toBe('# 최종 보고서\n문제 없음.');
    expect(result.current.state.iterations.length).toBe(2);
  });

  it('should handle cancellation mid-loop', async () => {
    const { result } = renderHook(() => useAnalysisAgent());
    vi.mocked(extractHints).mockResolvedValue({
      hints: 'Hints',
      filteredLines: 10,
      analysisTypeMatches: 5
    });
    
    vi.mocked(sendToAgent).mockImplementation(async () => {
      return new Promise(resolve => {
          setTimeout(() => {
              resolve({ status: 'PROCESSING', thought: '...' });
          }, 500);
      });
    });

    let analysisPromise: Promise<void>;
    await act(async () => {
        analysisPromise = result.current.startAnalysis([{ text: 'log text', name: 'test.log' }], null, 'crash');
    });

    act(() => {
      result.current.cancelAnalysis();
    });

    // Finalize pending timers to allow state transitions
    await act(async () => {
        vi.runAllTimers();
    });

    expect(result.current.state.status).toBe('cancelled');
  });

  it('should fail if API key is missing', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useAnalysisAgent());

    await act(async () => {
      await result.current.startAnalysis([{ text: 'log text', name: 'test.log' }], null, 'crash');
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.errorMessage).toContain('API Key');
  });

  it('should handle iteration limit', async () => {
    const { result } = renderHook(() => useAnalysisAgent());
    vi.mocked(extractHints).mockResolvedValue({
      hints: 'Hints',
      filteredLines: 10,
      analysisTypeMatches: 5
    });
    
    vi.mocked(sendToAgent).mockResolvedValue({
      status: 'PROCESSING',
      thought: '계속 분석중...',
      action: { type: 'SEARCH_KEYWORD', params: { keyword: 'dot' } }
    });
    vi.mocked(executeAction).mockResolvedValue('Result');

    let analysisPromise: Promise<void>;
    await act(async () => {
      analysisPromise = result.current.startAnalysis([{ text: 'log text', name: 'test.log' }], null, 'crash');
    });

    // Sleep 3s occurs after each processing iteration (up to 3 times)
    // We strictly advance time to skip them
    for (let i = 0; i < 100; i++) {
        await act(async () => {
            vi.advanceTimersByTime(200);
            await Promise.resolve();
        });
    }

    await analysisPromise!;

    expect(result.current.state.status).toBe('completed');
    expect(result.current.state.iterations.length).toBe(3);
  });
});
