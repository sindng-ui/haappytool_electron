import {
  AgentRequest,
  AgentResponse,
  AgentConfig,
  AnalysisType,
} from '../protocol';

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

| Action Type | Description | Key Params |
|---|---|---|
| FETCH_LOG_RANGE | Get log lines by range | start_line, end_line, context_size |
| SEARCH_KEYWORD | Search by keyword | keyword, ignore_case |
| SEARCH_PATTERN | Search by regex | pattern, ignore_case |
| EXTRACT_STACKTRACE | Extract thread stack | tid, depth |
| CHECK_METRIC | Get metric-related logs | metric_type (CPU/MEM/NET/DISK) |
| USER_QUERY | Ask user a question | question_text |

## Important Rules
1. ALWAYS include "thought" field explaining your reasoning
2. Request ONE action at a time - analyze results before next action
3. Be aware of remaining iterations - use them wisely
4. When you have enough information, set status=COMPLETED and write final_report in Markdown
5. final_report MUST be comprehensive with root cause, evidence, and recommendations`;

function buildSystemPrompt(analysisType: AnalysisType): string {
  return `${SYSTEM_PROMPT_BASE}\n\n## Analysis Specialization\n${ANALYSIS_PROMPTS[analysisType]}`;
}

function buildUserMessage(request: AgentRequest): string {
  const { analysis_type, mission_name, iteration, max_iterations, context } = request;
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
  // ```json ... ``` 패턴 먼저 시도
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // 첫 번째 { ... } JSON 객체 추출
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.substring(start, end + 1);

  throw new Error('No valid JSON found in LLM response');
}

// ─── API 호출 ─────────────────────────────────────────────────────────────────

export async function sendToAgent(
  request: AgentRequest,
  config: AgentConfig,
  signal?: AbortSignal
): Promise<AgentResponse> {
  if (!config.apiKey) {
    throw new Error('API Key가 설정되지 않았습니다. Settings > AI Agent 탭에서 설정해주세요.');
  }
  if (!config.endpoint) {
    throw new Error('API Endpoint가 설정되지 않았습니다.');
  }

  const systemPrompt = buildSystemPrompt(request.analysis_type);
  const userMessage = buildUserMessage(request);

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: 'text' },
  };

  // Electron proxyRequest를 통해 CORS-safe 요청
  const proxyRequest = (window as any).electronAPI?.proxyRequest;
  if (!proxyRequest) {
    throw new Error('Electron API를 찾을 수 없습니다.');
  }

  const timeoutId = setTimeout(() => {
    // AbortController signal은 외부에서 관리
  }, config.timeoutMs);

  try {
    const response = await proxyRequest({
      method: 'POST',
      url: config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    clearTimeout(timeoutId);

    if (response.error) {
      throw new Error(`API 오류: ${response.message}`);
    }

    if (response.status !== 200) {
      const errMsg = typeof response.data === 'object'
        ? JSON.stringify(response.data)
        : response.data;
      throw new Error(`HTTP ${response.status}: ${errMsg}`);
    }

    // OpenAI-compatible 응답 파싱
    const data = typeof response.data === 'string'
      ? JSON.parse(response.data)
      : response.data;

    const content: string = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 응답에서 content를 찾을 수 없습니다.');
    }

    const jsonText = extractJsonFromText(content);
    const parsed: AgentResponse = JSON.parse(jsonText);

    // 필수 필드 검증
    if (!parsed.status) {
      throw new Error('LLM 응답에 status 필드가 없습니다.');
    }

    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/** API 연결 테스트 */
export async function testAgentConnection(config: AgentConfig): Promise<boolean> {
  const proxyRequest = (window as any).electronAPI?.proxyRequest;
  if (!proxyRequest) throw new Error('Electron API 없음');

  const response = await proxyRequest({
    method: 'POST',
    url: config.endpoint,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    }),
  });

  if (response.error) throw new Error(response.message);
  return response.status === 200;
}
