// HAPPY-MCP Protocol v1.1
// Tool(Client) <-> LLM Agent(Server) 통신 규격

export type AnalysisType = 'crash' | 'deadlock' | 'perf' | 'traffic';

export type AgentStatus = 'PROCESSING' | 'COMPLETED' | 'ERROR';

export type ActionType =
  | 'FETCH_LOG_RANGE'
  | 'SEARCH_KEYWORD'
  | 'SEARCH_PATTERN'
  | 'EXTRACT_STACKTRACE'
  | 'CHECK_METRIC'
  | 'USER_QUERY';

// ─── Action 파라미터 타입 ─────────────────────────────────────────────────────

export interface FetchLogRangeParams {
  start_line: number;
  end_line: number;
  context_size?: number; // 앞뒤 추가 줄 수 (기본 10)
}

export interface SearchKeywordParams {
  keyword: string;
  ignore_case?: boolean;
}

export interface SearchPatternParams {
  pattern: string; // 정규식 문자열
  ignore_case?: boolean;
}

export interface ExtractStacktraceParams {
  tid: string; // Thread ID
  depth?: number; // 최대 스택 깊이 (기본 50)
}

export interface CheckMetricParams {
  metric_type: 'CPU' | 'MEM' | 'NET' | 'DISK';
  timestamp?: string; // 특정 시간대 필터 (optional)
}

export interface UserQueryParams {
  question_text: string;
}

export type ActionParams =
  | FetchLogRangeParams
  | SearchKeywordParams
  | SearchPatternParams
  | ExtractStacktraceParams
  | CheckMetricParams
  | UserQueryParams;

// ─── 메시지 구조 ─────────────────────────────────────────────────────────────

export interface AgentAction {
  type: ActionType;
  params: ActionParams;
}

/** LLM Agent → Tool 응답 */
export interface AgentResponse {
  status: AgentStatus;
  thought?: string;
  action?: AgentAction;
  final_report?: string; // status === 'COMPLETED' 시
  error_msg?: string;    // status === 'ERROR' 시
}

/** Tool → LLM Agent 요청 */
export interface AgentRequest {
  analysis_type: AnalysisType;
  mission_name: string;
  iteration: number;
  max_iterations: number;
  context: {
    initial_hints: string;      // 1차 힌트 추출 결과
    action_result?: string;     // 이전 액션 실행 결과
    previous_thought?: string;  // 연속성을 위한 이전 thought
    log_stats: {
      total_lines: number;
      filtered_lines: number;
      file_name: string;
    };
  };
}

// ─── 설정 ─────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  endpoint: string;   // API 엔드포인트 URL
  apiKey: string;     // API Key
  model: string;      // 모델명 (e.g. 'gpt-4')
  maxIterations: number;
  timeoutMs: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4',
  maxIterations: 10,
  timeoutMs: 60000,
};

export const AGENT_CONFIG_STORAGE_KEY = 'happytool_agent_config';

// ─── UI 상태 ─────────────────────────────────────────────────────────────────

export interface IterationRecord {
  iteration: number;
  thought: string;
  action?: AgentAction;
  actionResult?: string;
  timestamp: number;
}
