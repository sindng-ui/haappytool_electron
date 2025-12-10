
export enum ToolId {
  LOG_EXTRACTOR = 'LOG_EXTRACTOR',
  POST_TOOL = 'POST_TOOL',
  TPK_EXTRACTOR = 'TPK_EXTRACTOR',
  JSON_TOOLS = 'JSON_TOOLS',
}

export interface LogHighlight {
  id: string;
  keyword: string;
  color: string; // Tailwind bg class e.g. 'bg-yellow-200'
}

export interface LogRule {
  id: string;
  name: string;
  includeGroups: string[][]; // Outer array = OR, Inner array = AND
  disabledGroups?: string[][]; // Inactive filters
  excludes: string[];
  highlights: LogHighlight[];
}

export interface AppSettings {
  logRules: LogRule[];
  savedRequests: SavedRequest[];
  lastEndpoint: string;
  lastMethod: string;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
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
  type: 'INIT_FILE' | 'FILTER_LOGS' | 'GET_LINES' | 'GET_SURROUNDING_LINES' | 'GET_RAW_LINES' | 'INIT_STREAM' | 'PROCESS_CHUNK' | 'UPDATE_RULES' | 'FIND_HIGHLIGHT';
  payload?: any;
  requestId?: string;
}

export interface LogWorkerResponse {
  type: 'STATUS_UPDATE' | 'INDEX_COMPLETE' | 'FILTER_COMPLETE' | 'LINES_DATA' | 'ERROR' | 'STREAM_FLUSH' | 'FIND_RESULT';
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
