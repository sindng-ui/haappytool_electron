import {
  AgentRequest,
  AgentResponse,
  AgentConfig,
  AnalysisType,
} from '../protocol';

/** 🚨 디버깅 전용: 통신 원본 데이터 로깅 🐧📝 */
async function logTraffic(type: 'REQ' | 'RES' | 'ERR', data: any) {
  try {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.appendFileDirect || !electronAPI?.getAppPath) return;

    const appPath = await electronAPI.getAppPath();
    const logPath = `${appPath}/agent_traffic_debug.log`;
    
    // 처음 실행 시 경로 안내 (콘솔)
    if ((window as any)._debugLogPathPrinted !== logPath) {
      console.log(`%c[DEBUG] AI Traffic Log Path: ${logPath}`, "color: #818cf8; font-weight: bold; font-size: 12px;");
      (window as any)._debugLogPathPrinted = logPath;
    }

    const timestamp = new Date().toISOString();
    const separator = "─".repeat(80);
    const content = `\n${separator}\n[${timestamp}] [${type}]\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n${separator}\n`;
    
    await electronAPI.appendFileDirect(content, logPath);
  } catch (err) {
    console.error('[logTraffic] Failed:', err);
  }
}

// ─── System Prompt 빌더 ───────────────────────────────────────────────────────

const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  crash: `You are an expert crash analyzer. Focus on:
- Signal names (SIGSEGV, SIGABRT, SIGFPE, etc.)
- Stack traces and call chains
- Memory addresses and null pointer dereferences
- Use-After-Free, buffer overflows, heap corruption
- Last known good state before crash`,

  deadlock: `You are an expert deadlock analyzer. Focus on:
- Thread IDs (TID) and their waiting states
- Mutex/lock acquisition order
- Circular wait conditions
- Blocked threads and lock holders
- Resource dependency chains`,

  perf: `You are an expert performance analyzer. Focus on:
- Timestamp deltas and elapsed times
- Bottleneck functions and slow operations
- CPU/Memory spikes and sustained load
- Timeout events and retry storms
- Latency outliers and statistical anomalies`,

  traffic: `You are an expert network traffic analyzer. Focus on:
- HTTP method/endpoint patterns and error rates (4xx, 5xx)
- Unusual traffic spikes or drops
- Slow response times and timeouts
- Repeated failed requests (retry loops)
- Suspicious User-Agent patterns or IP sources`,
  chat: `You are a helpful assistant.`,
};

const SYSTEM_PROMPT_BASE = `You are an intelligent log analysis agent integrated with HappyTool.
You communicate EXCLUSIVELY via HAPPY-MCP Protocol JSON.

## HAPPY-MCP Protocol v1.1 - Response Format

You MUST respond with a single valid JSON object in this exact format:

\`\`\`json
{
  "status": "PROCESSING | COMPLETED | ERROR",
  "thought": "Your current analysis reasoning (always required)",
  "action": {
    "type": "ACTION_TYPE",
    "params": { ... }
  },
  "final_report": "Markdown report (only when status=COMPLETED)",
  "error_msg": "Error description (only when status=ERROR)"
}
\`\`\`

## Available Actions (when status=PROCESSING)

| Action Type | Description | REQUIRED params (MUST NOT BE EMPTY) |
|---|---|---|
| FETCH_LOG_RANGE | Get log lines by range | "start_line" (number), "end_line" (number) |
| SEARCH_KEYWORD | Search by keyword | "keyword" (string), "ignore_case" (boolean) |
| SEARCH_PATTERN | Search by regex | "pattern" (string), "ignore_case" (boolean) |
| EXTRACT_STACKTRACE | Extract thread stack | "tid" (string), "depth" (number) |
| CHECK_METRIC | Get metric-related logs | "metric_type" (CPU/MEM/NET/DISK) |
| USER_QUERY | Ask user a question | "question_text" (string) |

## Important Rules
1. ALWAYS include "thought" field explaining your reasoning.
2. When status=PROCESSING, you MUST provide "action" object with BOTH "type" AND "params".
3. **NEVER leave "params" empty.** For example, SEARCH_KEYWORD MUST have "keyword".

## JSON Examples for Action
- SEARCH_KEYWORD: {"status":"PROCESSING","thought":"...","action":{"type":"SEARCH_KEYWORD","params":{"keyword":"error","ignore_case":true}}}
- SEARCH_PATTERN: {"status":"PROCESSING","thought":"...","action":{"type":"SEARCH_PATTERN","params":{"pattern":"\\[[0-9]+\\]","ignore_case":true}}}
`;

/** 공통 JSON 스키마 (Gemini & OpenAI 공유) */
const HAPPY_MCP_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['PROCESSING', 'COMPLETED', 'ERROR'] },
    thought: { type: 'string', description: '분석 과정 및 추론 내용' },
    action: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'FETCH_LOG_RANGE',
            'SEARCH_KEYWORD',
            'SEARCH_PATTERN',
            'EXTRACT_STACKTRACE',
            'CHECK_METRIC',
            'USER_QUERY',
          ],
          description: '수행할 액션 종류'
        },
        params: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: '정규식 패턴' },
            keyword: { type: 'string', description: '검색 키워드' },
            ignore_case: { type: 'boolean', description: '대소문자 무시 여부' },
            start_line: { type: 'number', description: '시작 라인 번호' },
            end_line: { type: 'number', description: '종료 라인 번호' },
            tid: { type: 'string', description: '스레드 ID' },
            depth: { type: 'number', description: '스택 깊이' },
            metric_type: { type: 'string', enum: ['CPU', 'MEM', 'NET', 'DISK'] },
            question_text: { type: 'string', description: '사용자에게 할 질문' }
          },
          description: '액션에 필요한 상세 파라미터'
        },
      },
    },
    final_report: { type: 'string', description: '최종 분석 보고서 (Markdown)' },
    error_msg: { type: 'string', description: '에러 발생 시 메시지' },
  },
  required: ['status', 'thought'],
};

function buildSystemPrompt(analysisType: AnalysisType): string {
  return `${SYSTEM_PROMPT_BASE}\n\n## Analysis Specialization\n${ANALYSIS_PROMPTS[analysisType]}`;
}

function buildUserMessage(request: AgentRequest): string {
  const { analysis_type, mission_name, iteration, max_iterations, context } = request;
  
  // 🐧 채팅 모드일 경우 메타데이터 없이 순수 텍스트만 반환
  if (analysis_type === 'chat') {
    return context.initial_hints || '';
  }

  const remaining = max_iterations - iteration;

  let message = `## Log Analysis Request
- **Analysis Type**: ${analysis_type.toUpperCase()}
- **Mission**: ${mission_name}
- **Iteration**: ${iteration} / ${max_iterations} (${remaining} remaining)
- **Log File**: ${context.log_stats.file_name}
- **Log Stats**: ${context.log_stats.total_lines.toLocaleString()} total lines, ${context.log_stats.filtered_lines.toLocaleString()} filtered

## Initial Hints (from Happy Combo filter)
\`\`\`
${context.initial_hints || '(No hints extracted - analyze from raw patterns)'}
\`\`\``;

  if (context.previous_thought) {
    message += `\n\n## Previous Analysis Thought\n${context.previous_thought}`;
  }

  if (context.action_result) {
    message += `\n\n## Action Result\n\`\`\`\n${context.action_result}\n\`\`\``;
  }

  if (remaining <= 2) {
    message += `\n\n⚠️ WARNING: Only ${remaining} iteration(s) left! If you have enough evidence, please finalize your report now.`;
  }

  return message;
}

// ─── JSON 추출 ────────────────────────────────────────────────────────────────

function extractJsonFromText(text: string): string {
  if (!text) return '{}';
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.substring(start, end + 1);
  return text.trim();
}

// ─── API 호출 ─────────────────────────────────────────────────────────────────

export async function sendToAgent(
  request: AgentRequest,
  config: AgentConfig,
  signal?: AbortSignal,
  onPartialUpdate?: (thought: string) => void,
  onRawUpdate?: (raw: string) => void
): Promise<AgentResponse> {
  if (!config.apiKey) throw new Error('API Key가 설정되지 않았습니다.');
  if (!config.endpoint) throw new Error('API Endpoint가 설정되지 않았습니다.');

  const systemPrompt = buildSystemPrompt(request.analysis_type);
  const userMessage = buildUserMessage(request);
  const isGemini = config.endpoint.includes('generativelanguage.googleapis.com');
  const isGaussAgent = config.endpoint.includes('agent.sec.samsung.net');
  const requestId = `agent-stream-${Date.now()}`;
  const electronAPI = (window as any).electronAPI;

  let body: any;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (isGemini) {
    body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: -1 },
        responseSchema: HAPPY_MCP_SCHEMA,
      },
    };
  } else if (isGaussAgent) {
    // 삼성 가우스 에지전트 규격 (Agent Run API)
    headers['x-api-key'] = config.apiKey;
    body = {
      input_type: 'chat',
      output_type: 'chat',
      input_value: userMessage, // 가우스 에이전트는 이미 Rule/Role을 빌더에 설정함
    };
  } else {
    // OpenAI 규격 (범용)
    body = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      stream: !!onPartialUpdate,
      // Structured Outputs (OpenAI 규격)
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'happy_mcp_response',
          strict: true,
          schema: HAPPY_MCP_SCHEMA
        }
      }
    };
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  let finalUrl = config.endpoint;
  if (isGemini && !finalUrl.includes('key=')) {
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + `key=${config.apiKey}`;
  }

  // 가우스 에이전트는 stream 파라미터를 URL 쿼리나 바디에서 조절 가능
  if (isGaussAgent && onPartialUpdate && !finalUrl.includes('stream=true')) {
    const updatedUrl = finalUrl.replace('stream=false', 'stream=true');
    if (updatedUrl === finalUrl && !finalUrl.includes('stream=true')) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'stream=true';
    } else {
      finalUrl = updatedUrl;
    }
  }

  // 🚨 [DEBUG] 요청 전문 로깅 🐧📝
  const fullReqLog = {
    url: finalUrl,
    method: 'POST',
    headers,
    body: body
  };
  logTraffic('REQ', fullReqLog);

  // 1️⃣ 스트리밍 모드
  if (onPartialUpdate) {
    const streamUrl = isGemini ? finalUrl.replace(':generateContent', ':streamGenerateContent') : finalUrl;

    return new Promise((resolve, reject) => {
      let fullThought = '';
      let finalJsonResponse = '';
      let streamBuffer = '';

      const cleanup = () => {
        offChunk(); offComplete(); offError();
      };

      const offChunk = electronAPI.onProxyDataChunk(({ requestId: id, chunk }: any) => {
        if (id !== requestId) return;
        streamBuffer += chunk;
        if (onRawUpdate) onRawUpdate(chunk); // 원본 청크 전달
        
        if (isGemini) {
          // Gemini 전용 중괄호 추적 파서
          parseGeminiStream(streamBuffer, (thought, text) => {
            if (thought) { fullThought += thought; onPartialUpdate(fullThought); }
            if (text) finalJsonResponse += text;
          });
        } else if (isGaussAgent) {
          // 가우스 전용 SSE 파서
          streamBuffer = parseGaussStream(streamBuffer, (content) => {
            if (content) {
              // console.debug('[Gauss] Received chunk:', content); // 디버깅용
              fullThought += content; // 가우스 에이전트(Chat)는 thought 대신 직접 텍스트를 스트리밍함
              onPartialUpdate(fullThought);
              finalJsonResponse += content; // 나중에 한꺼번에 파싱할 수 있도록 누적 (JSON일 경우 대비)
            }
          });
        } else {
          // OpenAI 전용 SSE 파서
          streamBuffer = parseOpenAIStream(streamBuffer, (content) => {
            if (content) {
              finalJsonResponse += content;
              try {
                const partial = JSON.parse(extractJsonFromText(finalJsonResponse));
                if (partial.thought && partial.thought !== fullThought) {
                  fullThought = partial.thought;
                  onPartialUpdate(fullThought);
                }
              } catch(e) {}
            }
          });
        }
      });

      const offComplete = electronAPI.onProxyStreamComplete(({ requestId: id }: any) => {
        if (id !== requestId) return;
        cleanup();
        
        // 🚨 [DEBUG] 스트리밍 응답 합본 로깅 🐧📝 
        logTraffic('RES', (finalJsonResponse || fullThought));

        try {
          const cleanedJson = extractJsonFromText(finalJsonResponse || '{}');
          // 가우스 에이전트 결과가 순수 텍스트라면 JSON 파싱 대신 수동 조립
          let parsed: AgentResponse;
          try {
            parsed = JSON.parse(cleanedJson);
          } catch(e) {
            // JSON이 아니라면(채팅 모드) 수동으로 세팅
            parsed = { 
              status: 'COMPLETED' as any, 
              thought: fullThought,
              final_report: fullThought.includes('##') ? fullThought : undefined 
            } as AgentResponse;
          }
          if (!parsed.thought && fullThought) parsed.thought = fullThought;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON 조립 실패: ${e.message}`));
        }
      });

      const offError = electronAPI.onProxyStreamError(({ requestId: id, message }: any) => {
        if (id !== requestId) return;
        logTraffic('ERR', message);
        cleanup(); reject(new Error(`스트리밍 오류: ${message}`));
      });

      electronAPI.streamProxyRequest({
        method: 'POST', url: streamUrl, headers, body: JSON.stringify(body), requestId
      }).catch(err => {
        logTraffic('ERR', err.message);
        reject(err);
      });
    });
  }

  // 2️⃣ 일반 요청 모드
  const response = await electronAPI.proxyRequest({
    method: 'POST', url: finalUrl, headers, body: JSON.stringify(body)
  });

  if (response.error) {
    logTraffic('ERR', response.message);
    throw new Error(`API 오류: ${response.message}`);
  }
  
  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  
  // 🚨 [DEBUG] 응답 전문 로깅 🐧📝 
  logTraffic('RES', data);

  let rawContent = '';

  if (isGemini) {
    rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (isGaussAgent) {
    // 가우스 에이전트의 일반적인 응답 필드 (output_value, answer, text 중 하나)
    rawContent = data?.output_value || data?.answer || data?.text || data?.result || data?.outputs?.message || data?.message || '';
  } else {
    rawContent = data?.choices?.[0]?.message?.content || '';
  }

  const parsed: AgentResponse = JSON.parse(extractJsonFromText(rawContent));
  if (!parsed.status) throw new Error('LLM 응답 형식이 올바르지 않습니다.');
  return parsed;
}

/** Gemini 스트림 파서 */
function parseGeminiStream(buffer: string, callback: (thought: string, text: string) => void) {
  let startIndex = -1;
  let braceCount = 0;
  let inString = false;

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];
    if (char === '"' && buffer[i-1] !== '\\') inString = !inString;
    if (!inString) {
      if (char === '{') { if (braceCount === 0) startIndex = i; braceCount++; }
      else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          const jsonStr = buffer.substring(startIndex, i + 1);
          try {
            const data = JSON.parse(jsonStr);
            const parts = data?.candidates?.[0]?.content?.parts || [];
            for (const p of parts) callback(p.thought || '', p.text || '');
          } catch(e) {}
        }
      }
    }
  }
}

/** OpenAI SSE 스트림 파서 */
function parseOpenAIStream(buffer: string, callback: (content: string) => void): string {
  const lines = buffer.split('\n');
  // 마지막 라인은 아직 전송 중일 수 있으므로(개행 없음) 남겨둡니다.
  const remaining = lines.pop() || '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) continue;
    
    const dataStr = trimmed.replace('data: ', '').trim();
    if (dataStr === '[DONE]') continue;
    try {
      const data = JSON.parse(dataStr);
      const content = data?.choices?.[0]?.delta?.content || '';
      if (content) callback(content);
    } catch(e) {}
  }
  return remaining;
}

/** 가우스 에이전트 SSE 스트림 파서 */
function parseGaussStream(buffer: string, callback: (content: string) => void): string {
  const lines = buffer.split('\n');
  const remaining = lines.pop() || '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    let dataStr = trimmed;
    if (trimmed.startsWith('data: ')) {
      dataStr = trimmed.replace('data: ', '').trim();
    }
    
    if (!dataStr || dataStr === '[DONE]') continue;
    
    try {
      const data = JSON.parse(dataStr);
      // 가우스 에이전트 스트리밍 필드들 (output_value, message, delta, answer, chunk 등)
      // 🐧 형님이 알려주신 {"data": {"chunk": "..."}} 규격도 추가!
      const content = 
        data?.output_value || 
        data?.message || 
        data?.delta || 
        data?.answer || 
        data?.text || 
        data?.result || 
        data?.outputs?.message ||
        data?.data?.message ||
        data?.data?.chunk || // <--- New format
        data?.chunk || 
        '';
      
      if (content) {
        callback(content);
      } else if (typeof data === 'string') {
        // 데이터 자체가 문자열인 경우 (드문 케이스)
        callback(data);
      }
    } catch(e) {
      // JSON 파싱 실패 시, 혹시 순수 텍스트 스트림인지 확인
      // (단, 'data: '로 시작하지 않는 일반 텍스트일 경우에만)
      if (!trimmed.startsWith('data: ') && trimmed.length > 0) {
        callback(trimmed);
      }
    }
  }
  return remaining;
}

export async function testAgentConnection(config: AgentConfig): Promise<boolean> {
  const isGaussAgent = config.endpoint.includes('agent.sec.samsung.net');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: any;

  if (isGaussAgent) {
    headers['x-api-key'] = config.apiKey;
    body = { input_type: 'chat', output_type: 'chat', input_value: 'ping' };
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    body = {
      model: config.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    };
  }

  const response = await (window as any).electronAPI.proxyRequest({
    method: 'POST', 
    url: config.endpoint,
    headers,
    body: JSON.stringify(body),
  });
  return response.status === 200;
}
