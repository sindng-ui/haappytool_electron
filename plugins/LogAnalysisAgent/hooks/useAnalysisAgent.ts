import { useState, useRef, useCallback } from 'react';
import { LogRule } from '../../../types';
import {
  AgentConfig,
  AgentRequest,
  AnalysisType,
  IterationRecord,
  AGENT_CONFIG_STORAGE_KEY,
  DEFAULT_AGENT_CONFIG,
} from '../protocol';
import { sendToAgent } from '../services/agentApiService';
import { executeAction } from '../services/actionExecutor';
import { extractHints, parseLogText } from '../services/hintExtractor';

// ─── 상태 타입 ────────────────────────────────────────────────────────────────

export type AgentRunStatus =
  | 'idle'
  | 'extracting'    // 1차 힌트 추출 중
  | 'running'       // LLM 루프 중
  | 'waiting_user'  // USER_QUERY 대기
  | 'completed'
  | 'cancelled'
  | 'error';

export interface AgentState {
  status: AgentRunStatus;
  extractionProgress: number;
  iterations: IterationRecord[];
  finalReport: string | null;
  userQuery: string | null;
  errorMessage: string | null;
  currentIteration: number;
  maxIterations: number;
}

// ─── 설정 로드 ────────────────────────────────────────────────────────────────

export function loadAgentConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(AGENT_CONFIG_STORAGE_KEY);
    if (raw) return { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_AGENT_CONFIG };
}

// ─── 분석 루프 훅 ─────────────────────────────────────────────────────────────

export function useAnalysisAgent() {
  const [state, setState] = useState<AgentState>({
    status: 'idle',
    extractionProgress: 0,
    iterations: [],
    finalReport: null,
    userQuery: null,
    errorMessage: null,
    currentIteration: 0,
    maxIterations: 10,
  });

  // 중단 제어
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // USER_QUERY 응답을 기다리는 Promise resolver
  const userQueryResolverRef = useRef<((answer: string) => void) | null>(null);

  // ─── 상태 업데이트 헬퍼 ─────────────────────────────────────────────────────

  const updateState = useCallback((patch: Partial<AgentState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const addIteration = useCallback((record: IterationRecord) => {
    setState(prev => ({
      ...prev,
      iterations: [...prev.iterations, record],
      currentIteration: record.iteration,
    }));
  }, []);

  // ─── 분석 시작 ──────────────────────────────────────────────────────────────

  const startAnalysis = useCallback(async (
    logText: string,
    logFileName: string,
    rule: LogRule | null,
    analysisType: AnalysisType,
  ) => {
    const config = loadAgentConfig();

    if (!config.apiKey) {
      updateState({
        status: 'error',
        errorMessage: 'API Key가 설정되지 않았습니다. Settings > AI Agent 탭에서 설정해주세요.',
      });
      return;
    }

    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();

    updateState({
      status: 'extracting',
      extractionProgress: 0,
      iterations: [],
      finalReport: null,
      userQuery: null,
      errorMessage: null,
      currentIteration: 0,
      maxIterations: config.maxIterations,
    });

    try {
      // ── Step 1: 로그 파싱 ───────────────────────────────────────────────────
      const logLines = await parseLogText(logText);

      if (cancelledRef.current) { updateState({ status: 'cancelled' }); return; }

      // ── Step 2: 1차 힌트 추출 ───────────────────────────────────────────────
      const { hints, filteredLines } = await extractHints(
        logLines,
        rule,
        analysisType,
        (progress) => updateState({ extractionProgress: progress })
      );

      if (cancelledRef.current) { updateState({ status: 'cancelled' }); return; }

      updateState({ status: 'running', extractionProgress: 100 });

      // ── Step 3: LLM 루프 ────────────────────────────────────────────────────
      let previousThought: string | undefined;
      let lastActionResult: string | undefined;
      const missionName = rule?.name ?? 'ALL';

      for (let iter = 1; iter <= config.maxIterations; iter++) {
        if (cancelledRef.current) { updateState({ status: 'cancelled' }); return; }

        const request: AgentRequest = {
          analysis_type: analysisType,
          mission_name: missionName,
          iteration: iter,
          max_iterations: config.maxIterations,
          context: {
            initial_hints: hints,
            action_result: lastActionResult,
            previous_thought: previousThought,
            log_stats: {
              total_lines: logLines.length,
              filtered_lines: filteredLines,
              file_name: logFileName,
            },
          },
        };

        let response;
        try {
          // ── 1️⃣ 실시간 Thought 업데이트를 위한 콜백 🐧⚡ ──────
          response = await sendToAgent(
            request,
            config,
            abortControllerRef.current.signal,
            (partialThought) => {
              setState(prev => {
                const newIterations = [...prev.iterations];
                const existingIdx = newIterations.findIndex(it => it.iteration === iter);

                if (existingIdx >= 0) {
                  newIterations[existingIdx] = {
                    ...newIterations[existingIdx],
                    thought: partialThought,
                  };
                } else {
                  newIterations.push({
                    iteration: iter,
                    thought: partialThought,
                    timestamp: Date.now(),
                  });
                }

                return {
                  ...prev,
                  iterations: newIterations,
                  currentIteration: iter,
                };
              });
            }
          );
        } catch (apiErr: any) {
          // 타임아웃 또는 API 에러 → 현재까지의 결과 표시
          updateState({
            status: 'error',
            errorMessage: `[Iteration ${iter}] API 오류: ${apiErr.message}`,
          });
          return;
        }

        if (cancelledRef.current) { updateState({ status: 'cancelled' }); return; }

        const thought = response.thought ?? '(thought 없음)';
        previousThought = thought;

        // ── 2️⃣ 최종 결과로 Iteration 업데이트 🐧🚀 ──────
        // COMPLETED
        if (response.status === 'COMPLETED') {
          setState(prev => {
            const newIterations = [...prev.iterations];
            const idx = newIterations.findIndex(it => it.iteration === iter);
            const record = { iteration: iter, thought, timestamp: Date.now() };

            if (idx >= 0) newIterations[idx] = record;
            else newIterations.push(record);

            return {
              ...prev,
              iterations: newIterations,
              status: 'completed',
              finalReport: response.final_report ?? '최종 보고서가 제공되지 않았습니다.',
            };
          });
          return;
        }

        // ERROR
        if (response.status === 'ERROR') {
          setState(prev => {
            const newIterations = [...prev.iterations];
            const idx = newIterations.findIndex(it => it.iteration === iter);
            const record = { iteration: iter, thought, timestamp: Date.now() };

            if (idx >= 0) newIterations[idx] = record;
            else newIterations.push(record);

            return {
              ...prev,
              iterations: newIterations,
              status: 'error',
              errorMessage: response.error_msg ?? '알 수 없는 LLM 오류',
            };
          });
          return;
        }

        // PROCESSING + ACTION
        const action = response.action;
        let actionResult = '(액션 없음)';

        if (action) {
          // USER_QUERY: 사용자 입력 대기
          if (action.type === 'USER_QUERY') {
            const question = (action.params as any).question_text ?? '추가 정보를 입력해주세요.';
            updateState({ status: 'waiting_user', userQuery: question });
            actionResult = await new Promise<string>(resolve => {
              userQueryResolverRef.current = resolve;
            });
            updateState({ status: 'running', userQuery: null });
          } else {
            actionResult = await executeAction(action, logLines);
          }
          lastActionResult = actionResult;
        }

        setState(prev => {
          const newIterations = [...prev.iterations];
          const idx = newIterations.findIndex(it => it.iteration === iter);
          const record = {
            iteration: iter,
            thought,
            action,
            actionResult,
            timestamp: Date.now(),
          };

          if (idx >= 0) newIterations[idx] = record;
          else newIterations.push(record);

          return {
            ...prev,
            iterations: newIterations,
            currentIteration: iter,
          };
        });

        // ✅ 형님, Gemini 무료 티어(RPM 15)를 위해 2초만 쉬었다 가겠습니다! 🐧☕
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 최대 반복 초과 → 현재까지의 분석 내용으로 마무리
      updateState({
        status: 'completed',
        finalReport: buildTimeoutReport(state.iterations, analysisType),
      });

    } catch (err: any) {
      updateState({
        status: 'error',
        errorMessage: err.message ?? '알 수 없는 오류 발생',
      });
    }
  }, [addIteration, updateState]);

  // ─── 분석 중단 ──────────────────────────────────────────────────────────────

  const cancelAnalysis = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    userQueryResolverRef.current?.('(사용자가 분석을 중단했습니다)');
    userQueryResolverRef.current = null;
    updateState({ status: 'cancelled', userQuery: null });
  }, [updateState]);

  // ─── USER_QUERY 응답 ─────────────────────────────────────────────────────────

  const answerUserQuery = useCallback((answer: string) => {
    if (userQueryResolverRef.current) {
      userQueryResolverRef.current(answer);
      userQueryResolverRef.current = null;
    }
  }, []);

  // ─── 초기화 ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    setState({
      status: 'idle',
      extractionProgress: 0,
      iterations: [],
      finalReport: null,
      userQuery: null,
      errorMessage: null,
      currentIteration: 0,
      maxIterations: 10,
    });
  }, []);

  return {
    state,
    startAnalysis,
    cancelAnalysis,
    answerUserQuery,
    reset,
  };
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function buildTimeoutReport(
  iterations: IterationRecord[],
  analysisType: AnalysisType
): string {
  const summary = iterations
    .map(it => `### Iteration ${it.iteration}\n**Thought:** ${it.thought}${it.actionResult ? `\n\n**Action Result Summary:** ${it.actionResult.slice(0, 200)}...` : ''
      }`)
    .join('\n\n');

  return `## ⏳ 최대 반복 횟수 초과 - 현재까지의 분석 내용

> 최대 반복 횟수(${iterations.length}회)에 도달하여 분석을 종료합니다.

**분석 유형:** ${analysisType.toUpperCase()}

${summary}

---
*최종 결론을 내리기에 정보가 부족했습니다. Max Iterations를 늘리거나, 더 구체적인 Mission을 선택하여 재시도해보세요.*`;
}
