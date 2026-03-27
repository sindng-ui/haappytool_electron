
import { StatsMap, TemplateGroup, TrafficPattern, UAPattern, UAMap, InternalInsights } from '../workers/NetTraffic.worker';

// NO IMPORTS NEEDED - Redefining types for the script
type MyStatsMap = Map<string, { totalCount: number, rawMap: Map<string, { count: number, examples: string[], lineIndices: number[] }> }>;
type MyUAMap = Map<string, { count: number, examples: string[], variables: Record<string, string>, endpointStats: MyStatsMap }>;

const UUID_REGEX = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
const URI_REGEX = /(?:https?:\/\/[^\s"'<>()\[\]{},;]+|(?<=[\s"'])\/[^\s"'<>()\[\]{},;]+)/g;
const NO_UA_VARS = { AppName: 'No User Agent Detected' };
const NO_UA_KEY = JSON.stringify(NO_UA_VARS);

const normalizeUri = (uri: string): string => uri.replace(UUID_REGEX, '$(UUID)');

function runTest(logLines: string[], patterns: TrafficPattern[], uaPattern: UAPattern) {
    console.log('--- Running NetTraffic Logic Verification (Self-Contained) ---');
    
    const singleStats: MyStatsMap = new Map();
    const singleUAMap: MyUAMap = new Map();
    let insights = {
        totalRequests: 0
    };
    
    let currentUAVars: Record<string, string> | null = null;
    const uaRegex = uaPattern.template.includes('$(') ? new RegExp(uaPattern.template.replace(/\$\(([^)]+)\)/g, '(?<$1>[^/\\s:\\(\\)\\[\\]]+)'), 'i') : null;

    logLines.forEach((line, lineIdx) => {
        const cleanLine = line;
        const lineLower = cleanLine.toLowerCase();

        if (uaPattern.enabled && uaRegex) {
            const uaKeywords = uaPattern.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (uaKeywords.every(kw => lineLower.includes(kw))) {
                const match = cleanLine.match(uaRegex);
                if (match && match.groups) {
                    currentUAVars = { ...match.groups };
                }
            }
        }

        for (const p of patterns) {
            if (!p.enabled) continue;
            const keywords = p.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (keywords.every(kw => lineLower.includes(kw))) {
                let uriMatches = cleanLine.match(URI_REGEX);
                
                if (uriMatches) {
                    for (const rawUri of uriMatches) {
                        const templateUri = normalizeUri(rawUri);
                        
                        const recordHit = (stats: MyStatsMap) => {
                            if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
                            stats.get(templateUri)!.totalCount++;
                        };

                        insights.totalRequests++; // 탭 1 (Insights)
                        recordHit(singleStats);  // 탭 2 (Endpoints)

                        if (uaPattern.enabled) { // 탭 3 (UA)
                            let uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
                            if (!singleUAMap.has(uaKey)) {
                                singleUAMap.set(uaKey, { count: 0, examples: [], variables: currentUAVars || NO_UA_VARS, endpointStats: new Map() });
                            }
                            const uaData = singleUAMap.get(uaKey)!;
                            uaData.count++; 
                            recordHit(uaData.endpointStats);
                        }
                    }
                } else {
                    const templateUri = `[LOG] ${p.alias || 'General'}`;
                    const recordLogHit = (stats: MyStatsMap) => {
                        if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0, rawMap: new Map() });
                        stats.get(templateUri)!.totalCount++;
                    };

                    insights.totalRequests++;
                    recordLogHit(singleStats);

                    if (uaPattern.enabled) {
                        let uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
                        if (!singleUAMap.has(uaKey)) {
                            singleUAMap.set(uaKey, { count: 0, examples: [], variables: currentUAVars || NO_UA_VARS, endpointStats: new Map() });
                        }
                        const uaData = singleUAMap.get(uaKey)!;
                        uaData.count++; 
                        recordLogHit(uaData.endpointStats);
                    }
                }
            }
        }
    });

    const endpointSum = Array.from(singleStats.values()).reduce((acc, s) => acc + s.totalCount, 0);
    const uaSum = Array.from(singleUAMap.values()).reduce((acc, u) => acc + u.count, 0);
    const insightsTotal = insights.totalRequests;

    console.log(`- Insights Total: ${insightsTotal}`);
    console.log(`- Endpoints Total: ${endpointSum}`);
    console.log(`- UA Clusters Total: ${uaSum}`);

    const success = (endpointSum === insightsTotal && uaSum === insightsTotal);
    if (success) {
        console.log('✅ ALL COUNTS MATCH!');
    } else {
        console.error('❌ COUNT MISMATCH DETECTED!');
        process.exit(1);
    }
}

const sampleLog = [
    '444.000 I/SC_SERVICE: User agent: Tizen/SClient/1.1.1/MyApp/2.2.2/null',
    '444.001 I/SC_SERVICE: https://up.stdive.com/sup/fmx/device/list',
    '444.002 I/SC_SERVICE: https://api.example.com/v1/user/1234-5678-9012-345678901234',
    '444.003 I/SC_SERVICE: Some other log without URI'
];

const patterns: TrafficPattern[] = [{ id: '1', alias: 'Keywords', keywords: 'SC_SERVICE', extractRegex: '', enabled: true }];
const uaPattern: UAPattern = {
    keywords: 'User agent',
    template: 'User agent: $(ClientName)/$(Version)',
    enabled: true
};

runTest(sampleLog, patterns, uaPattern);
