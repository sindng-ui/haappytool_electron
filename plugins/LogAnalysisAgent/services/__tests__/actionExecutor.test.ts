import { describe, it, expect, vi } from 'vitest';
import { executeAction } from '../actionExecutor';
import { AgentAction } from '../../protocol';

describe('actionExecutor (Phase 8: UT)', () => {
  const mockLogs = [
    'Line 0: System Boot',
    'Line 1: I/ActivityManager: Start activity A',
    'Line 2: D/Handler: Handling message 1',
    'Line 3: E/AndroidRuntime: FATAL EXCEPTION in TID 1234',
    'Line 4:   at com.example.MainActivity.onCreate(MainActivity.java:10)',
    'Line 5:   at android.app.ActivityThread.main(ActivityThread.java:2000)',
    'Line 6: I/Metric: CPU Usage 50%',
    'Line 7: I/Metric: Memory usage 200MB',
    'Line 8: I/Network: Connected to 192.168.0.1',
    'Line 9: System Shutdown'
  ];

  it('should handle FETCH_LOG_RANGE with context', async () => {
    const action: AgentAction = {
      type: 'FETCH_LOG_RANGE',
      params: { start_line: 1, end_line: 2, context_size: 1 }
    };
    
    // startLine = max(0, 1 - 1) = 0
    // endLine = min(9, 2 + 1) = 3
    const result = await executeAction(action, mockLogs);
    
    expect(result).toContain('[0] Line 0');
    expect(result).toContain('[3] Line 3');
    expect(result).toContain('(4줄)');
  });

  it('should handle SEARCH_KEYWORD', async () => {
    const action: AgentAction = {
      type: 'SEARCH_KEYWORD',
      params: { keyword: 'ActivityManager', ignore_case: true }
    };
    
    const result = await executeAction(action, mockLogs);
    expect(result).toContain('1개 발견');
    expect(result).toContain('Start activity A');
  });

  it('should handle SEARCH_PATTERN (RegExp)', async () => {
    const action: AgentAction = {
      type: 'SEARCH_PATTERN',
      params: { pattern: 'Metric: (CPU|Memory)', ignore_case: true }
    };
    
    const result = await executeAction(action, mockLogs);
    expect(result).toContain('2개 발견');
    expect(result).toContain('CPU Usage');
    expect(result).toContain('Memory usage');
  });

  it('should handle EXTRACT_STACKTRACE by TID', async () => {
    const action: AgentAction = {
      type: 'EXTRACT_STACKTRACE',
      params: { tid: '1234', depth: 3 }
    };
    
    const result = await executeAction(action, mockLogs);
    expect(result).toContain('TID "1234" 스택트레이스');
    expect(result).toContain('at com.example.MainActivity');
    expect(result).toContain('[5] Line 5');
  });

  it('should handle CHECK_METRIC for CPU/MEM/NET', async () => {
    const actionCPU: AgentAction = {
      type: 'CHECK_METRIC',
      params: { metric_type: 'CPU' }
    };
    const resultCPU = await executeAction(actionCPU, mockLogs);
    expect(resultCPU).toContain('CPU Usage 50%');

    const actionNET: AgentAction = {
      type: 'CHECK_METRIC',
      params: { metric_type: 'NET' }
    };
    const resultNET = await executeAction(actionNET, mockLogs);
    expect(resultNET).toContain('Connected to 192.168.0.1');
  });

  it('should handle USER_QUERY via callback', async () => {
    const action: AgentAction = {
      type: 'USER_QUERY',
      params: { question_text: 'What is the app version?' }
    };
    
    const mockOnUserQuery = vi.fn().mockResolvedValue('v1.0.0');
    
    const result = await executeAction(action, mockLogs, mockOnUserQuery);
    
    expect(mockOnUserQuery).toHaveBeenCalledWith('What is the app version?');
    expect(result).toBe('v1.0.0');
  });

  it('should return error for unknown action type', async () => {
    const action = { type: 'GHOST_ACTION', params: {} } as any;
    const result = await executeAction(action, mockLogs);
    expect(result).toContain('알 수 없는 액션 타입');
  });
});
