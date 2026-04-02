import React, { useEffect, useRef, useState } from 'react';
import { IterationRecord } from '../protocol';
import { AgentRunStatus } from '../hooks/useAnalysisAgent';
import { ActionType } from '../protocol';
import { Brain, Search, FileSearch, Layers, BarChart2, HelpCircle, ChevronDown, ChevronRight, Loader } from 'lucide-react';

interface AgentThoughtStreamProps {
  status: AgentRunStatus;
  iterations: IterationRecord[];
  currentIteration: number;
  maxIterations: number;
  extractionProgress: number;
  userQuery: string | null;
  errorMessage: string | null;
  onAnswerUserQuery: (answer: string) => void;
}

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  FETCH_LOG_RANGE: <FileSearch size={12} />,
  SEARCH_KEYWORD: <Search size={12} />,
  SEARCH_PATTERN: <Search size={12} />,
  EXTRACT_STACKTRACE: <Layers size={12} />,
  CHECK_METRIC: <BarChart2 size={12} />,
  USER_QUERY: <HelpCircle size={12} />,
};

const ACTION_COLORS: Record<ActionType, string> = {
  FETCH_LOG_RANGE: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  SEARCH_KEYWORD: 'text-green-400 bg-green-500/10 border-green-500/20',
  SEARCH_PATTERN: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  EXTRACT_STACKTRACE: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  CHECK_METRIC: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  USER_QUERY: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

// ─── 개별 Iteration 카드 ─────────────────────────────────────────────────────

const IterationCard: React.FC<{ record: IterationRecord; isLatest: boolean }> = ({
  record, isLatest
}) => {
  const [expanded, setExpanded] = useState(isLatest);
  const { thought, action, actionResult, iteration } = record;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isLatest ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-slate-700/60 bg-slate-800/30'
    }`}>
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-700/20 transition-colors"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
          isLatest ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'
        }`}>
          {iteration}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-300">
            {action 
              ? `Step ${iteration}: ${action.type} 수행` 
              : `Step ${iteration}: 가우스 분석 중...`}
          </p>
        </div>
        {expanded ? (
          <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
        )}
      </button>

      {/* 확장 내용 */}
      {expanded && (
        <div className="border-t border-slate-700/50 px-3 pb-3 pt-2 space-y-2">
          {/* Thought */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Brain size={10} /> Thought
            </p>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-2.5">
              {thought}
            </p>
          </div>

          {/* Action */}
          {action && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Action
              </p>
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold ${
                ACTION_COLORS[action.type] ?? 'text-slate-400 bg-slate-700 border-slate-600'
              }`}>
                {ACTION_ICONS[action.type]}
                {action.type}
              </div>
              <div className="mt-1.5 font-mono text-[10px] text-slate-400 bg-slate-900/60 rounded-lg p-2 border border-slate-700/50">
                {JSON.stringify(action.params, null, 2)}
              </div>
            </div>
          )}

          {/* Action Result */}
          {actionResult && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Result
              </p>
              <pre className="text-[10px] text-slate-400 bg-slate-900/60 rounded-lg p-2 border border-slate-700/50 overflow-x-auto whitespace-pre-wrap max-h-40 custom-scrollbar">
                {actionResult.slice(0, 1000)}{actionResult.length > 1000 ? '\n...(truncated)' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

const AgentThoughtStream: React.FC<AgentThoughtStreamProps> = ({
  status,
  iterations,
  currentIteration,
  maxIterations,
  extractionProgress,
  userQuery,
  errorMessage,
  onAnswerUserQuery,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userAnswer, setUserAnswer] = useState('');

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [iterations.length, status]);

  const handleAnswer = () => {
    if (!userAnswer.trim()) return;
    onAnswerUserQuery(userAnswer.trim());
    setUserAnswer('');
  };

  // ── idle 상태 ─────────────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
          <Brain size={32} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="font-bold text-slate-300 mb-1">로그 분석 에이전트</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
            왼쪽에서 분석 유형과 로그 파일을 선택하고<br/>
            분석 시작 버튼을 눌러주세요.
          </p>
        </div>
        <div className="flex gap-4 text-[10px] text-slate-600 mt-2">
          <span>💥 Crash</span>
          <span>🔒 Deadlock</span>
          <span>⚡ Perf</span>
          <span>🌐 Traffic</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 프로그레스 바 */}
      {(status === 'running' || status === 'extracting') && (
        <div className="flex-shrink-0 px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Loader size={10} className="animate-spin" />
              {status === 'extracting' ? '힌트 추출 중...' : `분석 진행 중...`}
            </span>
            <span className="text-[10px] text-slate-500">
              {status === 'extracting'
                ? `${extractionProgress}%`
                : `${currentIteration} / ${maxIterations}`}
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{
                width: status === 'extracting'
                  ? `${extractionProgress}%`
                  : `${(currentIteration / maxIterations) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* 상태 배너 */}
      {status === 'completed' && (
        <div className="flex-shrink-0 mx-4 mt-3 mb-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-xs font-bold text-green-400 text-center">✅ 분석 완료! 아래에서 최종 보고서를 확인하세요.</p>
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex-shrink-0 mx-4 mt-3 mb-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-xs font-bold text-amber-400 text-center">⚠️ 사용자가 분석을 중단했습니다.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex-shrink-0 mx-4 mt-3 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-xs font-bold text-red-400 mb-1">❌ 오류 발생</p>
          <p className="text-[11px] text-red-300/80">{errorMessage}</p>
        </div>
      )}

      {/* Iteration 스트림 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2.5">
        {iterations.map((record, idx) => (
          <IterationCard
            key={`iter-${record.iteration}`}
            record={record}
            isLatest={idx === iterations.length - 1 && (status === 'running' || status === 'waiting_user')}
          />
        ))}

        {/* USER_QUERY 인폿 */}
        {status === 'waiting_user' && userQuery && (
          <div className="border-2 border-yellow-500/40 rounded-xl bg-yellow-500/5 p-4">
            <p className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1.5">
              <HelpCircle size={14} /> 에이전트가 질문합니다
            </p>
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">{userQuery}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnswer()}
                placeholder="답변을 입력하세요..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                autoFocus
              />
              <button
                onClick={handleAnswer}
                disabled={!userAnswer.trim()}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-xs transition-all disabled:opacity-50"
              >
                전송
              </button>
            </div>
          </div>
        )}

        {/* 실행 중 표시 */}
        {(status === 'running' || status === 'extracting') && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-500">
              {status === 'extracting' ? '로그에서 핵심 힌트 추출 중...' : 'LLM 에이전트 분석 중...'}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default AgentThoughtStream;
