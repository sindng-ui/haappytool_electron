import { CommandBlock, Pipeline } from './components/BlockTest/types';

export enum ToolId {
  LOG_EXTRACTOR = 'LOG_EXTRACTOR',
  POST_TOOL = 'POST_TOOL',
  TPK_EXTRACTOR = 'TPK_EXTRACTOR',
  JSON_TOOLS = 'JSON_TOOLS',
  SMARTTHINGS_DEVICES = 'SMARTTHINGS_DEVICES',
  REVERSE_ENGINEER = 'REVERSE_ENGINEER',
  BLOCK_TEST = 'BLOCK_TEST',
  EASY_UML = 'EASY_UML',
  CPU_ANALYZER = 'CPU_ANALYZER',
  SMART_HOME_DASHBOARD = 'SMART_HOME_DASHBOARD',
  SCREEN_MATCHER = 'SCREEN_MATCHER',

}

export interface LogHighlight {
  id: string;
  keyword: string;
  color: string; // Tailwind bg class e.g. 'bg-yellow-200'
}

export interface HappyGroup {
  id: string;
  tags: string[];
  enabled: boolean;
}

export interface LogRule {
  id: string;
  name: string;
  includeGroups: string[][]; // Outer array = OR, Inner array = AND
  happyGroups?: HappyGroup[]; // New unified structure for Happy Combos
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

export interface PostGlobalVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface AppSettings {
  logRules: LogRule[];
  savedRequests: SavedRequest[];
  savedRequestGroups?: RequestGroup[];
  postGlobalVariables?: PostGlobalVariable[];
  lastEndpoint: string;
  lastMethod: string;
  enabledPlugins?: string[];
  blocks?: CommandBlock[];
  pipelines?: Pipeline[];
}

export interface RequestGroup {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  groupId?: string;
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
  type: 'INIT_FILE' | 'FILTER_LOGS' | 'GET_LINES' | 'GET_SURROUNDING_LINES' | 'GET_RAW_LINES' | 'INIT_STREAM' | 'PROCESS_CHUNK' | 'UPDATE_RULES' | 'FIND_HIGHLIGHT' | 'GET_LINES_BY_INDICES' | 'TOGGLE_BOOKMARK';
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
