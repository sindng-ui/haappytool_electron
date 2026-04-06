import { LogRule } from '../../../types';
import { AnalysisType } from '../protocol';
import { assembleIncludeGroups } from '../../../utils/filterGroupUtils';

// ─── 분석 유형별 추가 패턴 ────────────────────────────────────────────────────

const ANALYSIS_PATTERNS: Record<AnalysisType, RegExp[]> = {
  crash: [
    /SIGSEGV|SIGABRT|SIGFPE|SIGBUS|SIGILL/i,
    /segfault|segmentation fault/i,
    /fatal signal/i,
    /null pointer|null ref/i,
    /use.after.free|double.free|heap.corruption/i,
    /unhandled exception|uncaught exception/i,
    /panic:|fatal:|abort\(\)/i,
    /core dump/i,
  ],
  deadlock: [
    /deadlock/i,
    /mutex.*lock|lock.*mutex/i,
    /blocked.*thread|thread.*blocked/i,
    /waiting for.*lock|wait.*mutex/i,
    /circular.*dependency|lock.*order/i,
    /thread.*stall|stalled/i,
    /detected.*deadlock/i,
    /holds.*lock|holds.*mutex|holds/i,
  ],
  perf: [
    /timeout|timed.out/i,
    /slow.*response|response.*slow/i,
    /elapsed.*ms|ms.*elapsed/i,
    /delay.*detected|performance.*degraded/i,
    /cpu.*spike|memory.*leak/i,
    /bottleneck|latency.*high/i,
    /retry.*storm|too.*many.*retries/i,
  ],
  traffic: [
    /HTTP\s+[45]\d{2}/i,
    /response.*4\d{2}|4\d{2}.*error/i,
    /connection.*refused|refused.*connection/i,
    /bandwidth.*limit|rate.*limit/i,
    /spike.*traffic|traffic.*spike/i,
    /request.*fail|failed.*request/i,
    /timeout.*connect|connect.*timeout/i,
  ],
};

// ─── 비동기 청크 처리 유틸 ────────────────────────────────────────────────────

/**
 * UI 블록 없이 대용량 배열을 처리하는 비동기 이터레이터.
 * chunkSize 단위로 작업 후 setTimeout(0)으로 메인 스레드에 제어권을 양보.
 */
async function processInChunks<T>(
  items: T[],
  chunkSize: number,
  processor: (item: T, index: number) => boolean | void,
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  const total = items.length;

  for (let i = 0; i < total; i += chunkSize) {
    const end = Math.min(i + chunkSize, total);
    for (let j = i; j < end; j++) {
      const shouldStop = processor(items[j], j);
      if (shouldStop === false) return;
    }
    onProgress?.(end, total);
    // 메인 스레드에 제어권 양보 (UI 블록 방지)
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// ─── 메인 힌트 추출 ───────────────────────────────────────────────────────────

export interface HintExtractionResult {
  hints: string;
  filteredLines: number;
  analysisTypeMatches: number;
}

/**
 * Happy Combo 규칙 + 분석 유형별 패턴으로 로그에서 핵심 힌트를 추출합니다.
 * 비동기 청크 처리로 UI 블록 없이 동작합니다.
 */
export async function extractHints(
  logLines: string[],
  rule: LogRule | null,
  analysisType: AnalysisType,
  onProgress?: (progress: number) => void
): Promise<HintExtractionResult> {
  const MAX_HINT_LINES = 500;
  const CHUNK_SIZE = 10_000;

  const patterns = ANALYSIS_PATTERNS[analysisType] ?? [];
  const matchedLines: { lineNum: number; content: string; source: string }[] = [];

  // Happy Combo 필터 조립
  const includeGroups = rule ? assembleIncludeGroups(rule) : [];
  const blockList = rule?.excludes ?? [];

  // 블록리스트 정규식 컴파일 (한 번만)
  const blockPatterns = blockList
    .filter(b => b.trim())
    .map(b => {
      try { return new RegExp(b, 'i'); } catch { return null; }
    })
    .filter(Boolean) as RegExp[];

  const caseSensitive = rule?.bigBrainCombosCaseSensitive ?? false;

  await processInChunks(
    logLines,
    CHUNK_SIZE,
    (line, index) => {
      if (matchedLines.length >= MAX_HINT_LINES) return false;
      if (!line.trim()) return;

      // 블록리스트 필터 (먼저 체크)
      if (blockPatterns.some(p => p.test(line))) return;

      const lineLower = caseSensitive ? line : line.toLowerCase();

      // Happy Combo 매칭 (OR of ANDs)
      let comboMatch = includeGroups.length === 0;
      for (const group of includeGroups) {
        const allMatch = group.every(tag => {
          const t = caseSensitive ? tag : tag.toLowerCase();
          return lineLower.includes(t);
        });
        if (allMatch) { comboMatch = true; break; }
      }

      // 분석 유형별 패턴 매칭
      const typeMatch = patterns.some(p => p.test(line));

      if (comboMatch || typeMatch) {
        matchedLines.push({
          lineNum: index,
          content: line,
          source: typeMatch ? `[${analysisType.toUpperCase()}]` : '[COMBO]',
        });
      }
    },
    (processed, total) => {
      onProgress?.(Math.round((processed / total) * 100));
    }
  );

  const analysisTypeMatches = matchedLines.filter(m =>
    m.source.includes(analysisType.toUpperCase())
  ).length;

  if (matchedLines.length === 0) {
    return {
      hints: `(No relevant log entries found for ${analysisType} analysis with the selected mission filter)`,
      filteredLines: 0,
      analysisTypeMatches: 0,
    };
  }

  const hints = matchedLines
    .slice(0, MAX_HINT_LINES)
    .map(m => `[Line ${m.lineNum}] ${m.source} ${m.content}`)
    .join('\n');

  return {
    hints,
    filteredLines: matchedLines.length,
    analysisTypeMatches,
  };
}

/** 로그 파일 텍스트를 줄 배열로 파싱 (비동기, UI 블록 없음) */
export async function parseLogText(text: string): Promise<string[]> {
  // 청크 단위로 split하면 메모리 효율이 떨어지므로
  // 전체 split 후 yield 방식 사용
  await new Promise(resolve => setTimeout(resolve, 0));
  return text.split(/\r?\n/);
}
