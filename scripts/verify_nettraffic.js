
// NetTraffic Worker Logic Verification Script 🐧⚡
// COMPLETELY STANDALONE PURE JAVASCRIPT

const UUID_REGEX = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
const URI_REGEX = /(?:https?:\/\/[^\s"'<>()\[\]{},;]+|(?<=[\s"'])\/[^\s"'<>()\[\]{},;]+)/g;
const NO_UA_VARS = { AppName: 'No User Agent Detected' };
const NO_UA_KEY = JSON.stringify(NO_UA_VARS);

const normalizeUri = (uri) => uri.replace(UUID_REGEX, '$(UUID)');

function runTest(logLines, patterns, uaPattern) {
    console.log('--- Running NetTraffic Logic Verification (Pure JS) ---');
    
    const singleStats = new Map();
    const singleUAMap = new Map();
    let insights = { totalRequests: 0 };
    let currentUAVars = null;
    
    const uaRegex = uaPattern.template.includes('$(') ? new RegExp(uaPattern.template.replace(/\$\(([^)]+)\)/g, '(?<$1>[^/\\s:\\(\\)\\[\\]]+)'), 'i') : null;

    logLines.forEach((line, lineIdx) => {
        const cleanLine = line;
        const lineLower = cleanLine.toLowerCase();

        // 1. UA Detection
        if (uaPattern.enabled && uaRegex) {
            const uaKeywords = uaPattern.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (uaKeywords.every(kw => lineLower.includes(kw))) {
                const match = cleanLine.match(uaRegex);
                if (match && match.groups) {
                    currentUAVars = { ...match.groups };
                }
            }
        }

        // 2. Traffic Analysis
        for (const p of patterns) {
            if (!p.enabled) continue;
            const keywords = p.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (keywords.every(kw => lineLower.includes(kw))) {
                let uriMatches = cleanLine.match(URI_REGEX);
                
                if (uriMatches) {
                    for (const rawUri of uriMatches) {
                        const templateUri = normalizeUri(rawUri);
                        const recordHit = (stats) => {
                            if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0 });
                            stats.get(templateUri).totalCount++;
                        };

                        insights.totalRequests++; // Insights
                        recordHit(singleStats);  // Endpoints

                        if (uaPattern.enabled) {
                            let uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
                            if (!singleUAMap.has(uaKey)) {
                                singleUAMap.set(uaKey, { count: 0, endpointStats: new Map() });
                            }
                            const uaData = singleUAMap.get(uaKey);
                            uaData.count++; // UA Total
                            recordHit(uaData.endpointStats);
                        }
                    }
                } else {
                    const templateUri = `[LOG] ${p.alias || 'General'}`;
                    const recordLogHit = (stats) => {
                        if (!stats.has(templateUri)) stats.set(templateUri, { totalCount: 0 });
                        stats.get(templateUri).totalCount++;
                    };

                    insights.totalRequests++;
                    recordLogHit(singleStats);

                    if (uaPattern.enabled) {
                        let uaKey = currentUAVars ? JSON.stringify(currentUAVars) : NO_UA_KEY;
                        if (!singleUAMap.has(uaKey)) {
                            singleUAMap.set(uaKey, { count: 0, endpointStats: new Map() });
                        }
                        const uaData = singleUAMap.get(uaKey);
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

    if (endpointSum === insightsTotal && uaSum === insightsTotal) {
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
const p = [{ id: '1', alias: 'Keywords', keywords: 'SC_SERVICE', enabled: true }];
const ua = { keywords: 'User agent', template: 'User agent: $(ClientName)/$(Version)', enabled: true };
runTest(sampleLog, p, ua);
