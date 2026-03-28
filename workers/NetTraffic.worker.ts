// workers/NetTraffic.worker.ts
// @ts-nocheck

export interface RawCall {
  rawUri: string;
  count: number;
  examples: string[];
  lineIndices: number[];
}

export interface TemplateGroup {
  alias: string;
  templateUri: string;
  totalCount: number;
  rawCalls: RawCall[];
}

export interface UAEndpoint {
  templateUri: string;
  totalCount: number;
  rawCalls: RawCall[];
}

export interface UAResult {
  variables: Record<string, string>;
  count: number;
  examples: string[];
  endpoints: UAEndpoint[];
}

export interface TrafficPattern {
  id: string;
  alias: string;
  keywords: string;
  extractRegex: string;
  enabled: boolean;
}

export interface UAPattern {
  keywords: string;
  template: string;
  enabled: boolean;
}

export interface InsightStats {
  timeline: Record<string, number>; // Minute-bucket -> count
  hosts: Record<string, number>;    // Domain -> count
  methods: Record<string, number>;  // GET, POST -> count
  totalRequests: number;
}

export let patterns: TrafficPattern[] = [];
export let uaPattern: UAPattern | null = null;
export let uaRegex: RegExp | null = null;

export const setPatterns = (p: TrafficPattern[]) => { patterns = p; };
export const setUAPattern = (ua: UAPattern | null) => { 
  uaPattern = ua; 
  uaRegex = templateToRegex(ua?.template || '');
};

// Stateful parsing
let currentUAVars: Record<string, string> | null = null;

// Hierarchical Stats
export type StatsMap = Map<string, { totalCount: number, rawMap: Map<string, { count: number, examples: string[] }> }>;
export let singleStats: StatsMap = new Map();
export let leftStats: StatsMap = new Map();
export let rightStats: StatsMap = new Map();

// Line counters
let lineCounts = { single: 0, left: 0, right: 0 };

// UA Stats
export type UAMap = Map<string, { 
  count: number, 
  examples: string[], 
  variables: Record<string, string>,
  endpointStats: StatsMap 
}>;
export let singleUAMap: UAMap = new Map();
export let leftUAMap: UAMap = new Map();
export let rightUAMap: UAMap = new Map();

// Insights Stats
export interface InternalInsights {
  timeline: Map<string, number>;
  hosts: Map<string, number>;
  methods: Map<string, number>;
  totalRequests: number;
}
const createEmptyInsights = (): InternalInsights => ({
  timeline: new Map(),
  hosts: new Map(),
  methods: new Map(),
  totalRequests: 0
});

let singleInsights = createEmptyInsights();
let leftInsights = createEmptyInsights();
let rightInsights = createEmptyInsights();

const UUID_REGEX = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
// Improved URI_REGEX to avoid catching trailing punctuation and handle common URI: tags
const URI_REGEX = /(?:https?:\/\/[^\s"'<>()\[\]{},;]+|(?<=[\s"'])\/[^\s"'<>()\[\]{},;]+)/g;
const NO_UA_VARS = { AppName: 'No User Agent Detected' };
const NO_UA_KEY = JSON.stringify(NO_UA_VARS);

const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

export const normalizeUri = (uri: string): string => {
  return uri.trim().replace(UUID_REGEX, '$(UUID)');
};

export const extractHost = (uri: string): string => {
  const match = uri.match(/https?:\/\/([^\/\s]+)/);
  return match ? match[1] : 'unknown';
};

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
export const detectMethod = (line: string): string | null => {
  for (const m of METHODS) {
    if (line.includes(` ${m} `) || line.includes(`${m}>`) || line.startsWith(m + ' ')) return m;
  }
  return null;
};

export const extractBucket = (line: string): string | null => {
  // Matches 055.010 or HH:mm:ss
  const match = line.match(/(\d{2}:\d{2}:\d{2})|(\d{2,})\./);
  if (!match) return null;
  if (match[1]) return match[1].substring(0, 5); // HH:mm
  if (match[2]) {
    const sec = parseInt(match[2]);
    const min = Math.floor(sec / 60);
    return `${min}m`;
  }
  return null;
};

export const templateToRegex = (template: string): RegExp | null => {
  if (!template) return null;
  try {
    // 🐧 팁: 플레이스홀더를 기준으로 분할하여 리터럴 부분만 안전하게 이스케이프합니다.
    const parts = template.split(/\$\((.*?)\)/);
    let regexStr = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // 리터럴 영역: 모든 정규식 특수 문자를 이스케이프
        regexStr += parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      } else {
        // 플레이스홀더 영역: 명명된 캡처 그룹으로 변환
        // 변수명에 올바르지 않은 문자가 섞이는 것을 방지하기 위해 알파벳/숫자만 남김
        const groupName = parts[i].replace(/[^a-zA-Z0-9]/g, '');
        if (groupName) {
          // URIs나 UAs에서 구분자로 쓰이는 공백/슬래시/따옴표 등을 제외하고 매칭.
          // 🐧 팁: 문자 클래스 내부에 [ ] ( ) 등이 포함될 경우 반드시 이스케이프가 필요합니다.
          regexStr += `(?<${groupName}>[^/\\s"'<>\\(\\)\\[\\]{},;]+)`;
        }
      }
    }
    return new RegExp(regexStr, 'i');
  } catch (e) {
    return null;
  }
};

export const processLine = (line: string, targetStats: StatsMap, targetUAMap: UAMap, targetInsights: InternalInsights, lineIdx: number) => {
  const cleanLine = stripAnsi(line);
  
  // 1. Check for User Agent line
  if (uaPattern?.enabled && uaRegex) {
    const uaKeywords = uaPattern.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const lineLower = cleanLine.toLowerCase();
    if (uaKeywords.every(kw => lineLower.includes(kw))) {
      const match = cleanLine.match(uaRegex);
      if (match && match.groups) {
        currentUAVars = match.groups;
        const key = JSON.stringify(currentUAVars);
        if (!targetUAMap.has(key)) {
          targetUAMap.set(key, { count: 0, examples: [], variables: currentUAVars, endpointStats: new Map() });
        }
        const uaData = targetUAMap.get(key)!;
        // count will be incremented when traffic is matched, not on log appearance
        if (uaData.examples.length < 2) uaData.examples.push(cleanLine.trim());
      }
    }
  }

  // 2. Traffic Analysis
  const lineLower = cleanLine.toLowerCase();
  let matched = false;

  for (const p of patterns) {
    if (!p.enabled) continue;
    const keywords = p.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    
    // Match everything if no keywords specified, otherwise check every keyword
    if (keywords.length === 0 || keywords.every(kw => lineLower.includes(kw))) {
      matched = true;
      let urisFound: string[] = [];
      
      // URI Extraction
      if (p.extractRegex) {
        try {
          urisFound = cleanLine.match(new RegExp(p.extractRegex, 'g')) || [];
        } catch (e) {
          console.error('Invalid extractRegex:', p.extractRegex, e);
          urisFound = cleanLine.match(URI_REGEX) || [];
        }
      } else {
        urisFound = cleanLine.match(URI_REGEX) || [];
      }

      console.log(`[NetTraffic] Line: "${cleanLine.substring(0, 100)}..." -> Found: ${urisFound.length} URIs`);

      if (urisFound.length > 0) {
        const bucket = extractBucket(cleanLine);
        if (bucket) {
          targetInsights.timeline.set(bucket, (targetInsights.timeline.get(bucket) || 0) + urisFound.length);
        }

        for (const rawUri of urisFound) {
          const templateUri = normalizeUri(rawUri);
          const host = extractHost(rawUri);
          const method = detectMethod(cleanLine);

          console.log(`[NetTraffic] Hit: [${method || '?'}] ${templateUri} (Raw: ${rawUri})`);

          if (host) targetInsights.hosts.set(host, (targetInsights.hosts.get(host) || 0) + 1);
          if (method) targetInsights.methods.set(method, (targetInsights.methods.get(method) || 0) + 1);
          targetInsights.totalRequests++; 

          const recordAnyHit = (stats: StatsMap) => {
            if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
            const tData = stats.get(templateUri)!;
            tData.totalCount++;
            
            if (!tData.rawMap.has(rawUri)) tData.rawMap.set(rawUri, { count: 0, examples: [], lineIndices: [] });
            const rData = tData.rawMap.get(rawUri)!;
            rData.count++;
            if (rData.examples.length < 3) rData.examples.push(cleanLine.trim());
            if (rData.lineIndices.length < 100) rData.lineIndices.push(lineIdx);
          };

          recordAnyHit(targetStats);

          if (uaPattern?.enabled) {
            let uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
            if (!targetUAMap.has(uaKey)) {
              targetUAMap.set(uaKey, {
                count: 0,
                examples: [],
                variables: currentUAVars || NO_UA_VARS,
                endpointStats: new Map()
              });
            }
            const uaData = targetUAMap.get(uaKey)!;
            uaData.count++; 
            if (uaData.examples.length < 1) uaData.examples.push(cleanLine.trim());
            recordAnyHit(uaData.endpointStats);
          }
        }
      } else {
        // [LOG] hit (No specific URI found, but keywords matched)
        const templateUri = `[LOG] ${p.alias || 'General'}`;
        const rawUri = cleanLine.length > 100 ? cleanLine.substring(0, 100) + '...' : cleanLine;
        console.log(`[NetTraffic] LOG Hit: ${templateUri}`);

        targetInsights.totalRequests++; 

        const recordLogHit = (stats: StatsMap) => {
          if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
          const tData = stats.get(templateUri)!;
          tData.totalCount++;
          
          if (!tData.rawMap.has(rawUri)) tData.rawMap.set(rawUri, { count: 0, examples: [], lineIndices: [] });
          const rData = tData.rawMap.get(rawUri)!;
          rData.count++;
          if (rData.examples.length < 1) rData.examples.push(cleanLine.trim());
          if (rData.lineIndices.length < 100) rData.lineIndices.push(lineIdx);
        };

        recordLogHit(targetStats);

        if (uaPattern?.enabled) {
          let uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
          if (!targetUAMap.has(uaKey)) {
            targetUAMap.set(uaKey, {
              count: 0,
              examples: [],
              variables: currentUAVars || NO_UA_VARS,
              endpointStats: new Map()
            });
          }
          const uaData = targetUAMap.get(uaKey)!;
          uaData.count++; 
          if (uaData.examples.length < 1) uaData.examples.push(cleanLine.trim());
          recordLogHit(uaData.endpointStats);
        }
      }
      
      // Stop checking other patterns for this line once one has matched
      break; 
    }
  }
};

let buffers: Record<'single' | 'left' | 'right', string> = { single: '', left: '', right: '' };

export const resetInternalState = () => {
  patterns = [];
  uaPattern = null;
  uaRegex = null;
  currentUAVars = null;
  singleStats.clear(); leftStats.clear(); rightStats.clear();
  singleUAMap.clear(); leftUAMap.clear(); rightUAMap.clear();
  singleInsights = createEmptyInsights();
  leftInsights = createEmptyInsights();
  rightInsights = createEmptyInsights();
  buffers.single = ''; buffers.left = ''; buffers.right = '';
  lineCounts.single = 0; lineCounts.left = 0; lineCounts.right = 0;
};

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'INIT':
      resetInternalState();
      patterns = payload.patterns || [];
      uaPattern = payload.uaPattern || null;
      uaRegex = templateToRegex(uaPattern?.template || '');
      break;
      
    case 'PROCESS_CHUNK': {
      const { target, chunk } = payload;
      const tStats = target === 'single' ? singleStats : target === 'left' ? leftStats : rightStats;
      const tUA = target === 'single' ? singleUAMap : target === 'left' ? leftUAMap : rightUAMap;
      const tInsights = target === 'single' ? singleInsights : target === 'left' ? leftInsights : rightInsights;
      buffers[target] += chunk;
      let lines = buffers[target].split('\n');
      buffers[target] = lines.pop() || '';
      for (const line of lines) {
        processLine(line, tStats, tUA, tInsights, lineCounts[target]++);
      }
      break;
    }
      
    case 'STREAM_DONE': {
      const { target } = payload;
      const fStats = target === 'single' ? singleStats : target === 'left' ? leftStats : rightStats;
      const fUA = target === 'single' ? singleUAMap : target === 'left' ? leftUAMap : rightUAMap;
      const fInsights = target === 'single' ? singleInsights : target === 'left' ? leftInsights : rightInsights;
      
      if (buffers[target].trim()) processLine(buffers[target], fStats, fUA, fInsights, lineCounts[target]++);
      buffers[target] = '';
      
      const formatStats = (stats: StatsMap): TemplateGroup[] => {
        const results = Array.from(stats.entries()).map(([templateUri, data]) => ({
          alias: 'Auto',
          templateUri: templateUri.trim(),
          totalCount: data.totalCount,
          rawCalls: Array.from(data.rawMap.entries()).map(([rawUri, rd]) => ({
            rawUri: rawUri.trim(), count: rd.count, examples: rd.examples, lineIndices: rd.lineIndices
          })).sort((a, b) => b.count - a.count)
        })).sort((a, b) => b.totalCount - a.totalCount);

        console.log(`[NetTraffic] Final Stats Built. Nodes: ${results.length}, Total Hits: ${results.reduce((acc, curr) => acc + curr.totalCount, 0)}`);
        return results;
      };

      const mapToRecord = (map: Map<string, number>) => Object.fromEntries(map);

      const trafficResult = formatStats(fStats);
      const uaResult: UAResult[] = Array.from(fUA.values()).map(d => ({
        variables: d.variables,
        count: d.count,
        examples: d.examples,
        endpoints: formatStats(d.endpointStats).map(t => ({
          templateUri: t.templateUri,
          totalCount: t.totalCount,
          rawCalls: t.rawCalls
        }))
      })).sort((a, b) => b.count - a.count);

      const insightsPayload: InsightStats = {
        timeline: mapToRecord(fInsights.timeline),
        hosts: mapToRecord(fInsights.hosts),
        methods: mapToRecord(fInsights.methods),
        totalRequests: fInsights.totalRequests
      };
      
      console.log('[NetTraffic] Sending RESULT_UPDATE', { nodes: trafficResult.length, total: insightsPayload.totalRequests });
      self.postMessage({ type: 'RESULT_UPDATE', payload: { target, data: trafficResult, uaData: uaResult, insights: insightsPayload } });
      break;
    }
  }
};
