import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToAgent } from '../agentApiService';
import { AgentRequest, AgentConfig } from '../../protocol';

describe('agentApiService (Phase 8: UT)', () => {
  const mockConfig: AgentConfig = {
    apiKey: 'sk-test-key',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4',
    maxIterations: 10,
    timeoutMs: 30000
  };

  const mockRequest: AgentRequest = {
    analysis_type: 'crash',
    mission_name: 'Test Mission',
    iteration: 1,
    max_iterations: 10,
    context: {
      initial_hints: 'Sample 1차 힌트 로그...',
      log_stats: {
        total_lines: 1000,
        filtered_lines: 10,
        file_name: 'test.log'
      }
    }
  };

  beforeEach(() => {
    // Mock global electronAPI.proxyRequest
    (global as any).window = {
      electronAPI: {
        proxyRequest: vi.fn()
      }
    };
  });

  it('should format request and parse successful JSON response', async () => {
    const mockProxyRequest = vi.mocked(window.electronAPI.proxyRequest);
    
    // Simulate LLM response with JSON inside code block
    const mockLLMResponse = {
      choices: [{
        message: {
          content: '```json\n{ "status": "PROCESSING", "thought": "분석중...", "action": { "type": "SEARCH_KEYWORD", "params": { "keyword": "fatal" } } }\n```'
        }
      }]
    };
    
    mockProxyRequest.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockLLMResponse
    });
    
    const result = await sendToAgent(mockRequest, mockConfig);
    
    expect(result.status).toBe('PROCESSING');
    expect(result.thought).toBe('분석중...');
    expect(result.action?.type).toBe('SEARCH_KEYWORD');
    
    // Verify request formatting
    const callArgs = mockProxyRequest.mock.calls[0][0];
    expect(callArgs.url).toBe(mockConfig.endpoint);
    expect(callArgs.method).toBe('POST');
    expect(callArgs.headers['Authorization']).toBe(`Bearer ${mockConfig.apiKey}`);
    
    const body = JSON.parse(callArgs.body);
    expect(body.model).toBe(mockConfig.model);
    expect(body.messages[0].role).toBe('system');
  });

  it('should parse raw JSON response (without code blocks)', async () => {
    const mockProxyRequest = vi.mocked(window.electronAPI.proxyRequest);
    
    const mockRawJSON = {
      choices: [{
        message: {
          content: '{ "status": "COMPLETED", "thought": "분석 끝!", "final_report": "# 분석 결과" }'
        }
      }]
    };
    
    mockProxyRequest.mockResolvedValue({ 
      status: 200,
      statusText: 'OK',
      headers: {},
      data: mockRawJSON 
    });
    
    const result = await sendToAgent(mockRequest, mockConfig);
    expect(result.status).toBe('COMPLETED');
    expect(result.final_report).toBe('# 분석 결과');
  });

  it('should handle API errors gracefully', async () => {
    const mockProxyRequest = vi.mocked(window.electronAPI.proxyRequest);
    
    mockProxyRequest.mockResolvedValue({
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      data: { error: { message: 'Invalid API Key' } }
    });
    
    await expect(sendToAgent(mockRequest, mockConfig))
      .rejects.toThrow('HTTP 401');
  });

  it('should handle network/proxy failures', async () => {
    const mockProxyRequest = vi.mocked(window.electronAPI.proxyRequest);
    mockProxyRequest.mockRejectedValue(new Error('Network disconnected'));
    
    await expect(sendToAgent(mockRequest, mockConfig))
      .rejects.toThrow('Network disconnected');
  });
});
