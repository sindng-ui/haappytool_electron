import { readFileSync } from 'fs';
import { extractSourceMetadata } from './workers/LogParser';
import { performSplitAnalysis } from './workers/SplitAnalysisUtils';

const leftText = readFileSync('./test/test_startup.log', 'utf-8');
const rightText = readFileSync('./test/test_startup_2.log', 'utf-8');

const leftLogs = leftText.split('\n').filter(l => l.trim().length > 0).map(l => extractSourceMetadata(l, 0)).filter(x => x !== null) as any[];
const rightLogs = rightText.split('\n').filter(l => l.trim().length > 0).map(l => extractSourceMetadata(l, 0)).filter(x => x !== null) as any[];

const results = performSplitAnalysis(leftLogs, rightLogs, { threshold: 20 });
for (const res of results) {
    if (res.key.includes('OnError')) {
        console.log(`[ONERROR] Burst:${res.isBurst} L:${res.leftLineNum} R:${res.rightLineNum} Count:${res.burstCount}`);
    }
}
