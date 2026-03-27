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

let patterns: TrafficPattern[] = [];
let uaPattern: UAPattern | null = null;
let uaRegex: RegExp | null = null;

// Stateful parsing
let currentUAVars: Record<string, string> | null = null;

// Hierarchical Stats
type StatsMap = Map<string, { totalCount: number, rawMap: Map<string, { count: number, examples: string[] }> }>;
let singleStats: StatsMap = new Map();
let leftStats: StatsMap = new Map();
let rightStats: StatsMap = new Map();

// Line counters
let lineCounts = { single: 0, left: 0, right: 0 };

// UA Stats
type UAMap = Map<string, { 
  count: number, 
  examples: string[], 
  variables: Record<string, string>,
  endpointStats: StatsMap 
}>;
let singleUAMap: UAMap = new Map();
let leftUAMap: UAMap = new Map();
let rightUAMap: UAMap = new Map();

// Insights Stats
interface InternalInsights {
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
// Improved URI_REGEX to catch http(s) URLs OR paths starting with / (preceded by space/quote)
const URI_REGEX = /(?:https?:\/\/[^\s"'<>]+|(?<=[\s"'])\/[^\s"'<>]+)/g;
const NO_UA_VARS = { AppName: 'No User Agent Detected' };
const NO_UA_KEY = JSON.stringify(NO_UA_VARS);

const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

const normalizeUri = (uri: string): string => {
  return uri.replace(UUID_REGEX, '$(UUID)');
};

const extractHost = (uri: string): string => {
  const match = uri.match(/https?:\/\/([^\/\s]+)/);
  return match ? match[1] : 'unknown';
};

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const detectMethod = (line: string): string | null => {
  for (const m of METHODS) {
    if (line.includes(` ${m} `) || line.includes(`${m}>`) || line.startsWith(m + ' ')) return m;
  }
  return null;
};

const extractBucket = (line: string): string | null => {
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

const templateToRegex = (template: string): RegExp | null => {
  if (!template) return null;
  try {
    let escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
      if (match === '$' || match === '(' || match === ')') return match;
      return '\\' + match;
    });
    const regexStr = escaped.replace(/\$\((.*?)\)/g, '(?<$1>[^/ ]+)');
    return new RegExp(regexStr, 'i');
  } catch (e) {
    return null;
  }
};

const processLine = (line: string, targetStats: StatsMap, targetUAMap: UAMap, targetInsights: InternalInsights, lineIdx: number) => {
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
  for (const p of patterns) {
    if (!p.enabled) continue;
    const keywords = p.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const lineLower = cleanLine.toLowerCase();
    if (keywords.every(kw => lineLower.includes(kw))) {
      // Use custom extractRegex if provided, otherwise fallback to URI_REGEX
      let uriMatches: string[] | null = null;
      if (p.extractRegex) {
        try {
          uriMatches = cleanLine.match(new RegExp(p.extractRegex, 'g'));
        } catch (e) {
          console.error('Invalid extractRegex:', p.extractRegex, e);
          uriMatches = cleanLine.match(URI_REGEX);
        }
      } else {
        uriMatches = cleanLine.match(URI_REGEX);
      }

      if (uriMatches) {
        // Collect Insights for this hit
        const bucket = extractBucket(cleanLine);
        const method = detectMethod(cleanLine);
        if (bucket) targetInsights.timeline.set(bucket, (targetInsights.timeline.get(bucket) || 0) + 1);
        if (method) targetInsights.methods.set(method, (targetInsights.methods.get(method) || 0) + 1);
        targetInsights.totalRequests += uriMatches.length;

        for (const rawUri of uriMatches) {
          const templateUri = normalizeUri(rawUri);
          const host = extractHost(rawUri);
          targetInsights.hosts.set(host, (targetInsights.hosts.get(host) || 0) + 1);
          
          // Helper to record hit in a StatsMap
          const recordHit = (stats: StatsMap) => {
            if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
            const tData = stats.get(templateUri)!;
            tData.totalCount++;
            if (!tData.rawMap.has(rawUri)) tData.rawMap.set(rawUri, { count: 0, examples: [], lineIndices: [] });
            const rData = tData.rawMap.get(rawUri)!;
            rData.count++;
            if (rData.examples.length < 3) rData.examples.push(cleanLine.trim());
            if (rData.lineIndices.length < 100) rData.lineIndices.push(lineIdx);
          };

          recordHit(targetStats);

          if (uaPattern?.enabled) {
             const uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
             if (!targetUAMap.has(uaKey)) {
                targetUAMap.set(uaKey, { 
                  count: 0, 
                  examples: [], 
                  variables: currentUAVars || NO_UA_VARS, 
                  endpointStats: new Map() 
                });
             }
             const uaData = targetUAMap.get(uaKey)!;
             uaData.count++; // Increment parent UA's hit count on each traffic match
             recordHit(uaData.endpointStats);
          }
        }
        // currentUAVars = null; // PERSIST UA until next UA line found
      } else {
        const templateUri = `[LOG] ${p.alias || 'General'}`;
        const rawUri = cleanLine.length > 100 ? cleanLine.substring(0, 100) + '...' : cleanLine;
        
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
          uaData.count++; // Increment parent UA's hit count on each log match
          recordLogHit(uaData.endpointStats);
        }
        // currentUAVars = null; // PERSIST UA until next UA line found
      }
    }
  }
};

let buffers: Record<'single' | 'left' | 'right', string> = { single: '', left: '', right: '' };

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'INIT':
      patterns = payload.patterns || [];
      uaPattern = payload.uaPattern || null;
      uaRegex = templateToRegex(uaPattern?.template || '');
      currentUAVars = null;
      singleStats.clear(); leftStats.clear(); rightStats.clear();
      singleUAMap.clear(); leftUAMap.clear(); rightUAMap.clear();
      singleInsights = createEmptyInsights();
      leftInsights = createEmptyInsights();
      rightInsights = createEmptyInsights();
      buffers.single = ''; buffers.left = ''; buffers.right = '';
      lineCounts.single = 0; lineCounts.left = 0; lineCounts.right = 0;
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
        return Array.from(stats.entries()).map(([templateUri, data]) => ({
          alias: 'Auto',
          templateUri,
          totalCount: data.totalCount,
          rawCalls: Array.from(data.rawMap.entries()).map(([rawUri, rd]) => ({
            rawUri, count: rd.count, examples: rd.examples, lineIndices: rd.lineIndices
          })).sort((a, b) => b.count - a.count)
        })).sort((a, b) => b.totalCount - a.totalCount);
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
      
      self.postMessage({ type: 'RESULT_UPDATE', payload: { target, data: trafficResult, uaData: uaResult, insights: insightsPayload } });
      break;
    }
  }
};
