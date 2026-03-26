// workers/NetTraffic.worker.ts
// @ts-nocheck

export interface RawCall {
  rawUri: string;
  count: number;
  examples: string[];
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

// UA Stats: Map<UAKey, { count, examples, variables, endpointMap: Map<TemplateURI, { totalCount, rawMap: Map<RawURI, { count, examples }> }> }>
type UAMap = Map<string, { 
  count: number, 
  examples: string[], 
  variables: Record<string, string>,
  endpointStats: StatsMap 
}>;
let singleUAMap: UAMap = new Map();
let leftUAMap: UAMap = new Map();
let rightUAMap: UAMap = new Map();

const UUID_REGEX = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
const URI_REGEX = /https?:\/\/[^\s"'<>]+/g;
const NO_UA_VARS = { AppName: 'No User Agent Detected' };
const NO_UA_KEY = JSON.stringify(NO_UA_VARS);

const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

const normalizeUri = (uri: string): string => {
  return uri.replace(UUID_REGEX, '$(UUID)');
};

const templateToRegex = (template: string): RegExp | null => {
  if (!template) return null;
  try {
    let escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
      if (match === '$' || match === '(' || match === ')') return match;
      return '\\' + match;
    });
    const regexStr = escaped.replace(/\$\((.*?)\)/g, '(?<$1>[^/ ]+)');
    return new RegExp(regexStr);
  } catch (e) {
    return null;
  }
};

const processLine = (line: string, targetStats: StatsMap, targetUAMap: UAMap) => {
  const cleanLine = stripAnsi(line);
  
  // 1. Check for User Agent line
  if (uaPattern?.enabled && uaRegex) {
    const uaKeywords = uaPattern.keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (uaKeywords.every(kw => cleanLine.includes(kw))) {
      const match = cleanLine.match(uaRegex);
      if (match && match.groups) {
        currentUAVars = match.groups;
        const key = JSON.stringify(currentUAVars);
        if (!targetUAMap.has(key)) {
          targetUAMap.set(key, { count: 0, examples: [], variables: currentUAVars, endpointStats: new Map() });
        }
        const uaData = targetUAMap.get(key)!;
        uaData.count++;
        if (uaData.examples.length < 2) uaData.examples.push(cleanLine.trim());
      }
    }
  }

  // 2. Traffic Analysis
  for (const p of patterns) {
    if (!p.enabled) continue;
    const keywords = p.keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (keywords.every(kw => cleanLine.includes(kw))) {
      const uriMatches = cleanLine.match(URI_REGEX);
      if (uriMatches) {
        for (const rawUri of uriMatches) {
          const templateUri = normalizeUri(rawUri);
          
          // Helper to record hit in a StatsMap
          const recordHit = (stats: StatsMap) => {
            if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
            const tData = stats.get(templateUri)!;
            tData.totalCount++;
            if (!tData.rawMap.has(rawUri)) tData.rawMap.set(rawUri, { count: 0, examples: [] });
            const rData = tData.rawMap.get(rawUri)!;
            rData.count++;
            if (rData.examples.length < 3) rData.examples.push(cleanLine.trim());
          };

          // Record globally
          recordHit(targetStats);

          // Record UA-linked
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
             recordHit(targetUAMap.get(uaKey)!.endpointStats);
          }
        }
        // User pointed out: 1 UA log -> 1 Traffic log block (line)
        // Reset currentUAVars after the entire line's URI matches are processed.
        currentUAVars = null;
      } else {
        const templateUri = `[LOG] ${p.alias || 'General'}`;
        const rawUri = cleanLine.length > 100 ? cleanLine.substring(0, 100) + '...' : cleanLine;
        
        const recordLogHit = (stats: StatsMap) => {
          if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
          const tData = stats.get(templateUri)!;
          tData.totalCount++;
          if (!tData.rawMap.has(rawUri)) tData.rawMap.set(rawUri, { count: 0, examples: [] });
          const rData = tData.rawMap.get(rawUri)!;
          rData.count++;
          if (rData.examples.length < 1) rData.examples.push(cleanLine.trim());
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
          recordLogHit(targetUAMap.get(uaKey)!.endpointStats);
        }

        // Reset after a pattern log too
        currentUAVars = null;
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
      buffers.single = ''; buffers.left = ''; buffers.right = '';
      break;
      
    case 'PROCESS_CHUNK': {
      const { target, chunk } = payload;
      const tStats = target === 'single' ? singleStats : target === 'left' ? leftStats : rightStats;
      const tUA = target === 'single' ? singleUAMap : target === 'left' ? leftUAMap : rightUAMap;
      buffers[target] += chunk;
      let lines = buffers[target].split('\n');
      buffers[target] = lines.pop() || '';
      for (const line of lines) processLine(line, tStats, tUA);
      break;
    }
      
    case 'STREAM_DONE': {
      const { target } = payload;
      const fStats = target === 'single' ? singleStats : target === 'left' ? leftStats : rightStats;
      const fUA = target === 'single' ? singleUAMap : target === 'left' ? leftUAMap : rightUAMap;
      
      if (buffers[target].trim()) processLine(buffers[target], fStats, fUA);
      buffers[target] = '';
      
      const formatStats = (stats: StatsMap): TemplateGroup[] => {
        return Array.from(stats.entries()).map(([templateUri, data]) => ({
          alias: 'Auto',
          templateUri,
          totalCount: data.totalCount,
          rawCalls: Array.from(data.rawMap.entries()).map(([rawUri, rd]) => ({
            rawUri, count: rd.count, examples: rd.examples
          })).sort((a, b) => b.count - a.count)
        })).sort((a, b) => b.totalCount - a.totalCount);
      };

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
      
      self.postMessage({ type: 'RESULT_UPDATE', payload: { target, data: trafficResult, uaData: uaResult } });
      break;
    }
  }
};
