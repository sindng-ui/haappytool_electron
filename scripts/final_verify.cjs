
const fs = require('fs');

const UUID_REGEX = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
const URI_REGEX = /(?:https?:\/\/[^\s"'<>()\[\]{},;]+|(?<=[\s"'])\/[^\s"'<>()\[\]{},;]+)/g;
const NO_UA_VARS = { AppName: 'No User Agent Detected' };
const NO_UA_KEY = JSON.stringify(NO_UA_VARS);

const normalizeUri = (uri) => uri.replace(UUID_REGEX, '$(UUID)');

function runTest(filePath) {
    console.log('--- Running NetTraffic Logic Verification with test_traffic.log ---');
    const logContent = fs.readFileSync(filePath, 'utf8');
    const logLines = logContent.split('\n');

    const patterns = [{ id: '1', alias: 'Keywords', keywords: 'ST_APP', enabled: true }];
    const uaPattern = {
        keywords: 'User Agent>',
        template: 'User Agent> $(ClientName)/$(ClientVersion)/$(AppName)/$(AppVersion)/$(AppDetail)',
        enabled: true
    };

    const singleStats = new Map();
    const singleUAMap = new Map();
    let insights = { totalRequests: 0 };
    let currentUAVars = null;
    
    // Adjusted UA Regex based on log format: NetworkService.cs: User Agent> ...
    const uaRegex = /User Agent>\s+(?<ClientName>[^/]+)\/(?<ClientVersion>[^/]+)\/(?<AppName>[^/]+)\/(?<AppVersion>[^/]+)\/(?<AppDetail>[^/\s]+)/i;

    logLines.forEach((line, lineIdx) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        const lineLower = cleanLine.toLowerCase();

        // 1. UA Detection
        if (uaPattern.enabled && lineLower.includes('User Agent>'.toLowerCase())) {
            const match = cleanLine.match(uaRegex);
            if (match && match.groups) {
                currentUAVars = { ...match.groups };
                // console.log(`[UA FOUND] Line ${lineIdx+1}:`, currentUAVars.AppName);
            }
        }

        // 2. Traffic Analysis
        for (const p of patterns) {
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
                            uaData.count++; 
                            recordHit(uaData.endpointStats);
                        }
                    }
                } else {
                    // console.log(`[LOG MATCH] Line ${lineIdx+1}: No URI found`);
                }
            }
        }
    });

    const endpointSum = Array.from(singleStats.values()).reduce((acc, s) => acc + s.totalCount, 0);
    const uaSum = Array.from(singleUAMap.values()).reduce((acc, u) => acc + u.count, 0);
    const insightsTotal = insights.totalRequests;

    console.log(`- Insights Total Requests: ${insightsTotal}`);
    console.log(`- Endpoints Tab Total Sum: ${endpointSum}`);
    console.log(`- UA Tab Total Sum: ${uaSum}`);

    console.log('\n--- Detected Endpoints ---');
    Array.from(singleStats.entries())
        .sort((a, b) => b[1].totalCount - a[1].totalCount)
        .forEach(([uri, data]) => {
            console.log(`[${data.totalCount}] ${uri}`);
        });

    const success = (endpointSum === insightsTotal && uaSum === insightsTotal);
    const hasUuidLess = Array.from(singleStats.keys()).some(k => k.includes('/v1/devices/') && !k.includes('$(UUID)'));

    if (success) console.log('✅ ALL COUNTS MATCH!');
    else console.error('❌ COUNT MISMATCH!');

    if (hasUuidLess) console.log('✅ UUID-LESS ENDPOINTS DETECTED!');
    else console.error('❌ UUID-LESS ENDPOINTS NOT DETECTED!');

    if (!success || !hasUuidLess) process.exit(1);
}

runTest('test_traffic.log');
