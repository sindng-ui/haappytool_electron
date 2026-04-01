import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendToAgent } from '../agentApiService';
import { AgentRequest, AgentConfig } from '../../protocol';

describe('agentApiService (Generic & Streaming Support)', () => {
  const geminiConfig: AgentConfig = {
    apiKey: 'gemini-key',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    model: 'gemini-2.0-flash',
    maxIterations: 10,
    timeoutMs: 30000
  };

  const genericConfig: AgentConfig = {
    apiKey: 'generic-key',
    endpoint: 'https://api.company.com/v1/chat/completions',
    model: 'custom-model',
    maxIterations: 10,
    timeoutMs: 30000
  };

  const mockRequest: AgentRequest = {
    analysis_type: 'traffic',
    mission_name: 'Traffic Analysis',
    iteration: 1,
    max_iterations: 10,
    context: {
      initial_hints: 'Hints...',
      log_stats: { total_lines: 100, filtered_lines: 5, file_name: 'app.log' }
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    (global as any).window = {
      electronAPI: {
        proxyRequest: vi.fn(),
        streamProxyRequest: vi.fn().mockResolvedValue({}),
        onProxyDataChunk: vi.fn(() => vi.fn()),
        onProxyStreamComplete: vi.fn(() => vi.fn()),
        onProxyStreamError: vi.fn(() => vi.fn()),
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Gemini Mode (Native SDK Style)', () => {
    it('should format body with systemInstruction and responseSchema', async () => {
      const mockProxyRequest = (window as any).electronAPI.proxyRequest as any;
      mockProxyRequest.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { candidates: [{ content: { parts: [{ text: '{"status":"COMPLETED","thought":"done"}' }] } }] }
      });

      await sendToAgent(mockRequest, geminiConfig);

      const callArgs = mockProxyRequest.mock.calls[0][0];
      const body = JSON.parse(callArgs.body);

      expect(callArgs.url).toContain('key=gemini-key');
      expect(body.systemInstruction).toBeDefined();
      expect(body.generationConfig.responseSchema).toBeDefined();
      expect(body.generationConfig.thinkingConfig).toBeDefined();
    });
  });

  describe('Generic Mode (OpenAI Compatible)', () => {
    it('should format body with messages and json_schema', async () => {
      const mockProxyRequest = (window as any).electronAPI.proxyRequest as any;
      mockProxyRequest.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { choices: [{ message: { content: '{"status":"COMPLETED","thought":"done"}' } }] }
      });

      await sendToAgent(mockRequest, genericConfig);

      const callArgs = mockProxyRequest.mock.calls[0][0];
      const body = JSON.parse(callArgs.body);

      expect(callArgs.headers['Authorization']).toBe('Bearer generic-key');
      expect(body.messages).toHaveLength(2);
      expect(body.response_format.type).toBe('json_schema');
      expect(body.response_format.json_schema.schema).toBeDefined();
    });
  });

  describe('Streaming Support', () => {
    it('should handle Gemini-style streaming thought updates', async () => {
      const onPartialUpdate = vi.fn();
      let chunkHandler: any;
      let completeHandler: any;

      const electronAPI = (window as any).electronAPI;

      // Mock event registration
      vi.mocked(electronAPI.onProxyDataChunk).mockImplementation((cb: any) => {
        chunkHandler = cb;
        return vi.fn();
      });
      vi.mocked(electronAPI.onProxyStreamComplete).mockImplementation((cb: any) => {
        completeHandler = cb;
        return vi.fn();
      });

      const promise = sendToAgent(mockRequest, geminiConfig, undefined, onPartialUpdate);

      const streamProxyRequest = electronAPI.streamProxyRequest as any;
      const reqId = streamProxyRequest.mock.calls[0][0].requestId;

      // Simulate first chunk (thought)
      chunkHandler({ 
        requestId: reqId,
        chunk: JSON.stringify({ 
          candidates: [{ content: { parts: [{ thought: 'Thinking process...' }] } }] 
        }) 
      });

      expect(onPartialUpdate).toHaveBeenCalledWith('Thinking process...');

      // Simulate final chunk (text/JSON)
      chunkHandler({ 
        requestId: reqId,
        chunk: JSON.stringify({ 
          candidates: [{ content: { parts: [{ text: '{"status":"COMPLETED","thought":"final"}' }] } }] 
        }) 
      });

      // Complete stream
      completeHandler({ requestId: reqId });

      const result = await promise;
      expect(result.status).toBe('COMPLETED');
    });

    it('should handle OpenAI-style SSE streaming', async () => {
      const onPartialUpdate = vi.fn();
      let chunkHandler: any;
      let completeHandler: any;

      const electronAPI = (window as any).electronAPI;

      vi.mocked(electronAPI.onProxyDataChunk).mockImplementation((cb: any) => {
        chunkHandler = cb; return vi.fn();
      });
      vi.mocked(electronAPI.onProxyStreamComplete).mockImplementation((cb: any) => {
        completeHandler = cb; return vi.fn();
      });

      const promise = sendToAgent(mockRequest, genericConfig, undefined, onPartialUpdate);
      const streamProxyRequest = electronAPI.streamProxyRequest as any;
      const reqId = streamProxyRequest.mock.calls[0][0].requestId;

      // Simulate SSE chunks
      chunkHandler({ requestId: reqId, chunk: 'data: {"choices":[{"delta":{"content":"{\\"status\\":\\"COMPLETED\\","}}] }\n' });
      chunkHandler({ requestId: reqId, chunk: 'data: {"choices":[{"delta":{"content":"\\"thought\\":\\"SSE Thinking\\"}"}}] }\n' });

      completeHandler({ requestId: reqId });

      const result = await promise;
      expect(result.status).toBe('COMPLETED');
      expect(result.thought).toBe('SSE Thinking');
      expect(onPartialUpdate).toHaveBeenCalled();
    });
  });
});
