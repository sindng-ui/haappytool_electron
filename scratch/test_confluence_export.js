
const { extractTimestamp, formatDuration } = require('./utils/logTime');

const cleanConfluenceContent = (text) => {
    return text
        .replace(/\|/g, '｜')
        .replace(/\{/g, '｛')
        .replace(/\}/g, '｝')
        .replace(/\[/g, '［')
        .replace(/\]/g, '］')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
};

const convertToConfluenceTable = (lines) => {
    if (lines.length === 0) return '';

    let md = '| Line | Time Diff | Acc. Time | Content |\n| :--- | :--- | :--- | :--- |\n';
    const firstTs = lines.length > 0 ? extractTimestamp(lines[0].content) : null;

    lines.forEach((line, idx) => {
        let timeDiff = '';
        let accTime = '';
        const currTs = extractTimestamp(line.content);

        if (idx > 0) {
            const prevTs = extractTimestamp(lines[idx - 1].content);
            if (prevTs !== null && currTs !== null) {
                const diff = currTs - prevTs;
                const absDiff = Math.abs(diff);
                const sign = diff >= 0 ? '+' : '-';
                const timeStr = absDiff < 60000 
                    ? (absDiff / 1000).toFixed(3) + 's' 
                    : formatDuration(absDiff);
                timeDiff = `${sign}${timeStr}`;
            }
        } else if (idx === 0) {
            accTime = '0.000s';
        }

        if (idx > 0 && firstTs !== null && currTs !== null) {
            const accDiff = currTs - firstTs;
            const absAccDiff = Math.abs(accDiff);
            const accSign = accDiff >= 0 ? '' : '-';
            let accText = absAccDiff < 60000 
                ? (absAccDiff / 1000).toFixed(3) + 's' 
                : formatDuration(absAccDiff);
            accTime = `${accSign}${accText}`;
        }

        const safeContent = cleanConfluenceContent(line.content);
        md += `| ${line.lineNum} | ${timeDiff || '-'} | ${accTime || '-'} | ${safeContent} |\n`;
    });

    return md;
};

// Test Data
const testLines = [
    { lineNum: 10, content: '02-16 09:46:51.620 D/ST_APP: start' },
    { lineNum: 18, content: '02-16 09:46:52.700 D/ST_APP: Resuming network tasks' },
    { lineNum: 26, content: '02-16 09:46:54.550 D/SYS_INFRA: Memory pressure low' }
];

console.log(convertToConfluenceTable(testLines));
