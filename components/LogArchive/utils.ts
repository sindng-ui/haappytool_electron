/**
 * 로그 아카이브 유틸리티 함수들
 */

/**
 * 로그 내용에서 스마트 태그 추천
 */
export function suggestTags(content: string): string[] {
    const suggestions: string[] = [];
    const lowerContent = content.toLowerCase();

    // 로그 레벨 감지
    if (/\b(error|err|exception|fatal|critical)\b/i.test(content)) {
        suggestions.push('ERROR');
    } else if (/\b(warn|warning)\b/i.test(content)) {
        suggestions.push('WARNING');
    } else if (/\b(info|information)\b/i.test(content)) {
        suggestions.push('INFO');
    } else if (/\b(debug|trace)\b/i.test(content)) {
        suggestions.push('DEBUG');
    }

    // 카테고리 감지
    if (/\b(network|connection|socket|http|https|api|request|response)\b/i.test(content)) {
        suggestions.push('NETWORK');
    }

    if (/\b(database|db|sql|query|transaction)\b/i.test(content)) {
        suggestions.push('DATABASE');
    }

    if (/\b(memory|heap|stack|gc|garbage)\b/i.test(content)) {
        suggestions.push('MEMORY');
    }

    if (/\b(file|disk|io|read|write)\b/i.test(content)) {
        suggestions.push('FILE_IO');
    }

    if (/\b(auth|login|logout|permission|access)\b/i.test(content)) {
        suggestions.push('AUTH');
    }

    if (/\b(performance|slow|timeout|latency)\b/i.test(content)) {
        suggestions.push('PERFORMANCE');
    }

    // 날짜 기반 태그
    const today = new Date();
    const dateTag = today.toISOString().split('T')[0]; // YYYY-MM-DD
    suggestions.push(dateTag);

    // 시간대 태그
    const hour = today.getHours();
    if (hour >= 5 && hour < 12) {
        suggestions.push('MORNING');
    } else if (hour >= 12 && hour < 17) {
        suggestions.push('AFTERNOON');
    } else if (hour >= 17 && hour < 21) {
        suggestions.push('EVENING');
    } else {
        suggestions.push('NIGHT');
    }

    return Array.from(new Set(suggestions)); // 중복 제거
}

/**
 * HTML 엔티티 디코딩
 * 예: &quot; -> "
 */
export function decodeHtmlEntities(text: string): string {
    if (!text) return '';
    return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'");
}

/**
 * 로그 내용에서 첫 줄 추출 (제목용)
 * HTML 엔티티 디코딩 적용
 */
export function extractFirstLine(content: string, maxLength: number = 100): string {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return 'Untitled';

    let firstLine = lines[0].trim();

    // HTML 엔티티 디코딩
    firstLine = decodeHtmlEntities(firstLine);

    if (firstLine.length <= maxLength) return firstLine;

    return firstLine.substring(0, maxLength) + '...';
}

/**
 * 날짜 포맷팅
 */
export function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 1분 미만
    if (diff < 60 * 1000) {
        return '방금 전';
    }

    // 1시간 미만
    if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes}분 전`;
    }

    // 24시간 미만
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours}시간 전`;
    }

    // 7일 미만
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}일 전`;
    }

    // 그 외 (날짜 표시)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // 올해인 경우 년도 생략
    if (year === now.getFullYear()) {
        return `${month}-${day} ${hours}:${minutes}`;
    }

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 상대적 날짜 포맷팅 (풀 버전)
 */
export function formatDateFull(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * RegEx 패턴 검증
 */
export function isValidRegex(pattern: string): boolean {
    try {
        new RegExp(pattern);
        return true;
    } catch {
        return false;
    }
}

/**
 * 텍스트에서 RegEx 매치 강조용 범위 추출
 */
export function findRegexMatches(text: string, pattern: string): Array<{ start: number; end: number; match: string }> {
    if (!isValidRegex(pattern)) return [];

    const regex = new RegExp(pattern, 'gi');
    const matches: Array<{ start: number; end: number; match: string }> = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + match[0].length,
            match: match[0],
        });
    }

    return matches;
}

/**
 * 로그 라인 수 계산
 */
export function countLines(content: string): number {
    return content.split('\n').length;
}

/**
 * 태그 색상 생성 (해시 기반)
 */
export function getTagColor(tag: string): string {
    // 미리 정의된 색상 (일반적인 로그 레벨)
    const predefinedColors: Record<string, string> = {
        'ERROR': '#ef4444',
        'WARNING': '#f59e0b',
        'INFO': '#3b82f6',
        'DEBUG': '#8b5cf6',
        'NETWORK': '#06b6d4',
        'DATABASE': '#10b981',
        'MEMORY': '#ec4899',
        'FILE_IO': '#f97316',
        'AUTH': '#6366f1',
        'PERFORMANCE': '#eab308',
    };

    if (predefinedColors[tag]) {
        return predefinedColors[tag];
    }

    // 해시 기반 색상 생성
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 50%)`;
}

/**
 * 클립보드에 복사
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        return false;
    }
}

/**
 * JSON 파일 다운로드
 */
export function downloadJSON(data: string, filename: string): void {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 파일 선택 다이얼로그 열기
 */
export function openFileDialog(accept: string = '.json'): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;

        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            resolve(file || null);
        };

        input.oncancel = () => {
            resolve(null);
        };

        input.click();
    });
}

/**
 * 파일 읽기
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            resolve(e.target?.result as string);
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}
