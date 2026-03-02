import { extractTimestamp, formatDuration } from './logTime';

/**
 * 로그 데이터 배열을 Confluence Markdown 테이블 형식으로 변환합니다.
 * 형식: || Line || Time Diff || Content ||
 */
export const convertToConfluenceTable = (lines: { lineNum: number; content: string }[]): string => {
    if (lines.length === 0) return '';

    let md = '|| Line || Time Diff || Content ||\n';

    lines.forEach((line, idx) => {
        let timeDiff = '';
        if (idx > 0) {
            const prevTs = extractTimestamp(lines[idx - 1].content);
            const currTs = extractTimestamp(line.content);

            if (prevTs !== null && currTs !== null) {
                const diff = currTs - prevTs;
                const absDiff = Math.abs(diff);
                const sign = diff >= 0 ? '+' : '-';

                const timeStr = absDiff < 60000
                    ? (absDiff / 1000).toFixed(3) + 's'
                    : formatDuration(absDiff);

                timeDiff = `${sign}${timeStr}`;
            }
        }

        // Confluence 테이블 깨짐 방지를 위해 파이프(|) 탈출 및 줄바꿈 제거
        const safeContent = line.content
            .replace(/\|/g, '\\|')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');

        md += `| ${line.lineNum} | ${timeDiff || '-'} | ${safeContent} |\n`;
    });

    return md;
};
