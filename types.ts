import { CommandBlock, Pipeline } from './components/BlockTest/types';

export enum ToolId {
  LOG_EXTRACTOR = 'LOG_EXTRACTOR',
  POST_TOOL = 'POST_TOOL',
  TPK_EXTRACTOR = 'TPK_EXTRACTOR',
  JSON_TOOLS = 'JSON_TOOLS',
  SMARTTHINGS_DEVICES = 'SMARTTHINGS_DEVICES',
  SMARTTHINGS_LAB = 'SMARTTHINGS_LAB',
  REVERSE_ENGINEER = 'REVERSE_ENGINEER',
  BLOCK_TEST = 'BLOCK_TEST',
  EASY_UML = 'EASY_UML',
  CPU_ANALYZER = 'CPU_ANALYZER',
  SMART_HOME_DASHBOARD = 'SMART_HOME_DASHBOARD',
  SCREEN_MATCHER = 'SCREEN_MATCHER',
  AI_ASSISTANT = 'AI_ASSISTANT',
  RXFLOW_VISUALIZER = 'RXFLOW_VISUALIZER',
  TIZEN_LAB = 'TIZEN_LAB',
  EASY_POST = 'EASY_POST',
  PERF_ANALYZER = 'PERF_ANALYZER',
}

export interface LogHighlight {
  id: string;
  keyword: string;
  color: string; // Tailwind bg class e.g. 'bg-yellow-200'
  lineEffect?: boolean;
}

export interface HappyGroup {
  id: string;
  tags: string[];
  enabled: boolean;
}

export interface FamilyCombo {
  id: string;
  name: string;
  startTags: string[];
  endTags: string[];
  middleTags: string[][]; // Array of branches (AND conditions)
  enabled: boolean;
}

export interface LogRule {
  id: string;
  name: string;
  includeGroups: string[][]; // Outer array = OR, Inner array = AND
  happyGroups?: HappyGroup[]; // New unified structure for Happy Combos
  familyCombos?: FamilyCombo[]; // New Family Combo structure
  disabledGroups?: string[][]; // Inactive filters
  excludes: string[];
  highlights: LogHighlight[];
  logCommand?: string;
  logTags?: string[];
  happyCombosCaseSensitive?: boolean;
  blockListCaseSensitive?: boolean;
  colorHighlightsCaseSensitive?: boolean;
  showRawLogLines?: boolean;
}

export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E';

export interface LogLevelStyle {
  level: LogLevel;
  color: string; // Hex color e.g. '#ff0000'
  enabled: boolean;
}

export interface LogViewPreferences {
  rowHeight: number;
  fontSize: number;
  fontFamily?: string;
  levelStyles: LogLevelStyle[];
  logLevelOpacity?: number; // 0-100 percentage
}

export interface PostGlobalVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface EnvironmentProfile {
  id: string;
  name: string;
  variables: PostGlobalVariable[];
}

export interface PostGlobalAuth {
  enabled: boolean;
  type: 'none' | 'bearer' | 'basic' | 'apikey';
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'header' | 'query';
}

export interface RequestHistoryItem extends SavedRequest {
  executedAt: number;
}

export interface AppSettings {
  logRules: LogRule[];
  savedRequests: SavedRequest[];
  savedRequestGroups?: RequestGroup[];
  requestHistory?: RequestHistoryItem[];
  postGlobalVariables?: PostGlobalVariable[]; // specific to the active profile mostly, or legacy dump
  envProfiles?: EnvironmentProfile[];
  activeEnvId?: string;
  postGlobalAuth?: PostGlobalAuth;
  logViewPreferences?: LogViewPreferences;
  lastEndpoint: string;
  lastMethod: string;
  enabledPlugins?: string[];
  blocks?: CommandBlock[];
  pipelines?: Pipeline[];
  mockEndpoints?: MockEndpoint[];
}

export interface RequestGroup {
  id: string;
  name: string;
  collapsed: boolean;
}

// Test Assertions
export interface TestAssertion {
  id: string;
  type: 'status' | 'jsonPath' | 'responseTime' | 'header';
  field?: string; // JSON path or header name
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
  expected?: string | number;
}

export interface TestResult {
  assertionId: string;
  passed: boolean;
  actual: any;
  expected: any;
  message: string;
}

// Request Chaining
export interface ResponseExtractor {
  id: string;
  name: string; // Variable name to save as
  source: 'body' | 'header' | 'status';
  jsonPath?: string; // e.g., "data.token"
  headerName?: string;
}

// Mock Server
export interface MockEndpoint {
  id: string;
  enabled: boolean;
  method: string;
  path: string; // e.g., "/api/users/:id"
  statusCode: number;
  headers: { key: string; value: string }[];
  body: string;
  delay?: number; // Response delay in ms
}

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  groupId?: string;
  auth?: {
    type: 'none' | 'bearer' | 'basic';
    bearerToken?: string;
    basicUsername?: string;
    basicPassword?: string;
  };
  tests?: TestAssertion[];
  extractors?: ResponseExtractor[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface PerfResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  timeTaken: number;
}

// --- Worker Types ---

export type WorkerStatus = 'idle' | 'indexing' | 'filtering' | 'ready' | 'error';

export interface LogWorkerMessage {
  type: 'INIT_FILE' | 'FILTER_LOGS' | 'GET_LINES' | 'GET_SURROUNDING_LINES' | 'GET_RAW_LINES' | 'INIT_STREAM' | 'PROCESS_CHUNK' | 'UPDATE_RULES' | 'FIND_HIGHLIGHT' | 'GET_LINES_BY_INDICES' | 'TOGGLE_BOOKMARK' | 'CLEAR_BOOKMARKS' | 'ANALYZE_TRANSACTION';
  payload?: any;
  requestId?: string;
}

export interface LogWorkerResponse {
  type: 'STATUS_UPDATE' | 'INDEX_COMPLETE' | 'FILTER_COMPLETE' | 'LINES_DATA' | 'ERROR' | 'STREAM_FLUSH' | 'FIND_RESULT' | 'FULL_TEXT_DATA' | 'BOOKMARKS_UPDATED';
  payload?: any;
  requestId?: string;
}

export interface LineRequest {
  startLine: number;
  count: number;
  encoding?: string;
}

export interface LineResult {
  lines: { lineNum: number, content: string }[];
}
