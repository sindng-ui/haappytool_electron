import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysisAgent } from '../useAnalysisAgent';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useAnalysisAgent());
    expect(result.current.state.status).toBe('idle');
  });

  it('should run full analysis loop (Success Path)', async () => {
    const { result } = renderHook(() => useAnalysisAgent());
    
    // 1. Mock 1차 힌트 추출
    vi.mocked(extractHints).mockResolvedValue({
      hints: 'Sample Hints',
      filteredLines: 10,
      analysisTypeMatches: 5
    });
    
    // 2. Mock 1차 LLM 응답 (Action 요청)
    vi.mocked(sendToAgent).mockResolvedValueOnce({
      status: 'PROCESSING',
      thought: '분석을 시작합니다.',
      action: { type: 'SEARCH_KEYWORD', params: { keyword: 'error' } }
    });
    
    // 3. Mock 액션 실행 결과
    vi.mocked(executeAction).mockResolvedValueOnce('Keyword "error" found at line 100');
    
    // 4. Mock 2차 LLM 응답 (최종 보고서)
    vi.mocked(sendToAgent).mockResolvedValueOnce({
      status: 'COMPLETED',
      thought: '분석이 완료되었습니다.',
      final_report: '# 최종 보고서\n문제 없음.'
    });

    // 실행!
    await act(async () => {
      await result.current.startAnalysis('log text', 'test.log', null, 'crash');
    });

    // 상태 검증
    // 상태 검증 - waitFor 대신 act와 act(async() => {}) 조합 사용
    for (let i = 0; i < 20; i++) {
        if (result.current.state.status === 'completed') break;
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    }
    expect(result.current.state.status).toBe('completed');
    expect(result.current.state.finalReport).toBe('# 최종 보고서\n문제 없음.');
    expect(result.current.state.iterations.length).toBe(2);

    expect(extractHints).toHaveBeenCalled();
    expect(sendToAgent).toHaveBeenCalledTimes(2);
    expect(executeAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SEARCH_KEYWORD' }),
      expect.any(Array)
    );
  });

  it('should handle cancellation mid-loop', async () => {
    const { result } = renderHook(() => useAnalysisAgent());
    vi.mocked(extractHints).mockResolvedValue({
      hints: 'Hints',
      filteredLines: 10,
      analysisTypeMatches: 5
    });
    
    // LLM 응답이 오기 전에 취소 시뮬레이션을 위해 Promise 조절 가능하지만
    // 여기서는 cancelAnalysis 호출 후 상태 변화 확인
    vi.mocked(sendToAgent).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { status: 'PROCESSING', thought: '...' };
    });

    act(() => {
        result.current.startAnalysis('log text', 'test.log', null, 'crash');
    });

    act(() => {
      result.current.cancelAnalysis();
    });

    for (let i = 0; i < 20; i++) {
        if (result.current.state.status === 'cancelled') break;
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    }
    expect(result.current.state.status).toBe('cancelled');
  });

  it('should fail if API key is missing', async () => {
    localStorage.clear(); // No config
    const { result } = renderHook(() => useAnalysisAgent());

    await act(async () => {
      await result.current.startAnalysis('log text', 'test.log', null, 'crash');
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
    
    // 계속 PROCESSING만 내뱉는 LLM (무한 루프 유도)
    vi.mocked(sendToAgent).mockResolvedValue({
      status: 'PROCESSING',
      thought: '계속 분석중...',
      action: { type: 'SEARCH_KEYWORD', params: { keyword: 'dot' } }
    });
    vi.mocked(executeAction).mockResolvedValue('Result');

    await act(async () => {
      await result.current.startAnalysis('log text', 'test.log', null, 'crash');
    });

    // maxIterations (3) 에서 멈춰야 함
    for (let i = 0; i < 20; i++) {
        if (result.current.state.status === 'completed') break;
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    }
    expect(result.current.state.status).toBe('completed');
    expect(result.current.state.iterations.length).toBe(3);
  });
});
