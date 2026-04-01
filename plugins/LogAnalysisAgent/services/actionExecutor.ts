import { AgentAction, ActionType } from '../protocol';

// ─── 결과 포맷 ────────────────────────────────────────────────────────────────

function formatLines(
  lines: string[],
  startLineNum: number,
  maxLines: number
): string {
  const slice = lines.slice(0, maxLines);
  return slice
    .map((l, i) => `[${startLineNum + i}] ${l}`)
    .join('\n');
}

// ─── 개별 핸들러 ──────────────────────────────────────────────────────────────

function handleFetchLogRange(
  logLines: string[],
  params: Record<string, any>
): string {
  const startLine = Math.max(0, (params.start_line ?? 0) - (params.context_size ?? 10));
  const endLine = Math.min(
    logLines.length - 1,
    (params.end_line ?? 0) + (params.context_size ?? 10)
  );

  if (startLine > endLine || startLine >= logLines.length) {
    return `라인 범위를 찾을 수 없습니다. (요청: ${params.start_line}~${params.end_line}, 전체: ${logLines.length}줄)`;
  }

  const slice = logLines.slice(startLine, endLine + 1);
  const result = formatLines(slice, startLine, 300);
  return `[Lines ${startLine}~${endLine}] (${slice.length}줄)\n${result}`;
}

function handleSearchKeyword(
  logLines: string[],
  params: Record<string, any>
): string {
  const keyword: string = params.keyword ?? '';
  const ignoreCase: boolean = params.ignore_case ?? true;

  if (!keyword) return '검색 키워드가 없습니다.';

  const matched: { lineNum: number; content: string }[] = [];
  const kw = ignoreCase ? keyword.toLowerCase() : keyword;

  for (let i = 0; i < logLines.length; i++) {
    const line = ignoreCase ? logLines[i].toLowerCase() : logLines[i];
    if (line.includes(kw)) {
      matched.push({ lineNum: i, content: logLines[i] });
      if (matched.length >= 100) break;
    }
  }

  if (matched.length === 0) {
    return `키워드 "${keyword}"를 찾을 수 없습니다.`;
  }

  const lines = matched.map(m => `[${m.lineNum}] ${m.content}`).join('\n');
  return `"${keyword}" 검색 결과: ${matched.length}개 발견\n${lines}`;
}

function handleSearchPattern(
  logLines: string[],
  params: Record<string, any>
): string {
  const pattern: string = params.pattern ?? '';
  const ignoreCase: boolean = params.ignore_case ?? true;

  if (!pattern) return '정규식 패턴이 없습니다.';

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, ignoreCase ? 'i' : '');
  } catch {
    return `정규식 오류: "${pattern}"은 유효하지 않은 패턴입니다.`;
  }

  const matched: { lineNum: number; content: string }[] = [];
  for (let i = 0; i < logLines.length; i++) {
    if (regex.test(logLines[i])) {
      matched.push({ lineNum: i, content: logLines[i] });
      if (matched.length >= 100) break;
    }
  }

  if (matched.length === 0) {
    return `패턴 "${pattern}"을 찾을 수 없습니다.`;
  }

  const lines = matched.map(m => `[${m.lineNum}] ${m.content}`).join('\n');
  return `패턴 /${pattern}/ 검색 결과: ${matched.length}개 발견\n${lines}`;
}

function handleExtractStacktrace(
  logLines: string[],
  params: Record<string, any>
): string {
  const tid: string = String(params.tid ?? '');
  const depth: number = params.depth ?? 50;

  if (!tid) return 'TID가 지정되지 않았습니다.';

  const stackLines: string[] = [];
  let inStack = false;
  let stackDepth = 0;

  for (let i = 0; i < logLines.length; i++) {
    const line = logLines[i];
    if (line.includes(tid)) {
      inStack = true;
      stackDepth = 0;
    }
    if (inStack) {
      stackLines.push(`[${i}] ${line}`);
      stackDepth++;
      if (stackDepth >= depth) break;
    }
  }

  if (stackLines.length === 0) {
    return `TID "${tid}"를 찾을 수 없습니다.`;
  }

  return `TID "${tid}" 스택트레이스 (${stackLines.length}줄):\n${stackLines.join('\n')}`;
}

function handleCheckMetric(
  logLines: string[],
  params: Record<string, any>
): string {
  const metricType: string = (params.metric_type ?? 'CPU').toUpperCase();
  const timestamp: string | undefined = params.timestamp;

  const metricKeywords: Record<string, string[]> = {
    CPU: ['cpu', 'processor', 'usage', 'load', 'utilization', '%cpu'],
    MEM: ['memory', 'mem', 'ram', 'heap', 'oom', 'out of memory', 'malloc', 'free'],
    NET: ['network', 'socket', 'tcp', 'udp', 'bandwidth', 'packet', 'connection'],
    DISK: ['disk', 'io', 'read', 'write', 'storage', 'filesystem', 'inode'],
  };

  const keywords = metricKeywords[metricType] ?? [metricType.toLowerCase()];
  const matched: { lineNum: number; content: string }[] = [];

  for (let i = 0; i < logLines.length; i++) {
    const line = logLines[i].toLowerCase();

    // 타임스탬프 필터 적용
    if (timestamp && !logLines[i].includes(timestamp)) continue;

    if (keywords.some(kw => line.includes(kw))) {
      matched.push({ lineNum: i, content: logLines[i] });
      if (matched.length >= 100) break;
    }
  }

  if (matched.length === 0) {
    return `${metricType} 지표 관련 로그를 찾을 수 없습니다.`;
  }

  const lines = matched.map(m => `[${m.lineNum}] ${m.content}`).join('\n');
  return `${metricType} 지표 로그: ${matched.length}개 발견\n${lines}`;
}

// ─── 메인 실행기 ──────────────────────────────────────────────────────────────

/**
 * LLM이 요청한 액션을 실제로 수행합니다.
 * USER_QUERY는 Promise를 반환하며, 외부에서 resolve 해줘야 합니다.
 */
export async function executeAction(
  action: AgentAction,
  logLines: string[],
  onUserQuery?: (question: string) => Promise<string>
): Promise<string> {
  if (!action) return '🚫 수행할 액션 정보가 없습니다.';
  
  const { type, params } = action;
  // ✅ 형님, params가 아예 없거나 null이어도 죽지 않게 빈 객체로 꽉 잡아둡니다! 🐧🧤
  const p = (params as Record<string, any>) || {};

  switch (type as ActionType) {
    case 'FETCH_LOG_RANGE':
      if (p.start_line === undefined) return '❌ FETCH_LOG_RANGE: start_line 파라미터가 없습니다.';
      return handleFetchLogRange(logLines, p);

    case 'SEARCH_KEYWORD':
      if (!p.keyword) return '❌ SEARCH_KEYWORD: keyword 파라미터가 없습니다.';
      return handleSearchKeyword(logLines, p);

    case 'SEARCH_PATTERN':
      if (!p.pattern) return '❌ SEARCH_PATTERN: pattern 파라미터가 없습니다.';
      return handleSearchPattern(logLines, p);

    case 'EXTRACT_STACKTRACE':
      if (!p.tid) return '❌ EXTRACT_STACKTRACE: tid 파라미터가 없습니다.';
      return handleExtractStacktrace(logLines, p);

    case 'CHECK_METRIC':
      return handleCheckMetric(logLines, p);

    case 'USER_QUERY': {
      if (!onUserQuery) {
        return '⚠️ 사용자 질문 기능이 비활성화되어 있습니다.';
      }
      const question = p.question_text ?? '⚠️ 추가 정보가 필요합니다. 질문 내용을 확인해주세요.';
      return await onUserQuery(question);
    }

    default:
      return `❌ 알 수 없는 액션 타입입니다: ${type}`;
  }
}
