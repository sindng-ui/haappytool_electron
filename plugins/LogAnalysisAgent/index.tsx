import React from 'react';
import { LogRule } from '../../types';
import { AnalysisType } from './protocol';
import { useAnalysisAgent } from './hooks/useAnalysisAgent';
import AgentConfigPanel from './components/AgentConfigPanel';
import AgentThoughtStream from './components/AgentThoughtStream';
import FinalReportViewer from './components/FinalReportViewer';
import { BrainCircuit } from 'lucide-react';

const LogAnalysisAgentPlugin: React.FC = () => {
  const { state, startAnalysis, cancelAnalysis, answerUserQuery, reset } = useAnalysisAgent();
  const { status, iterations, currentIteration, maxIterations, extractionProgress,
          finalReport, userQuery, errorMessage } = state;

  const handleStart = (
    logText: string,
    fileName: string,
    rule: LogRule | null,
    analysisType: AnalysisType
  ) => {
    startAnalysis(logText, fileName, rule, analysisType);
  };

  const showReport = finalReport && (status === 'completed' || status === 'cancelled');
  const showStream = status !== 'idle' || iterations.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── 상단 드래그 가능한 타이틀 바 ── */}
      <div 
        className="h-9 flex items-center bg-slate-900 border-b border-slate-800 px-4 shrink-0 z-20 title-drag" 
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 mr-6 select-none no-drag">
          <BrainCircuit size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Log Analysis Agent</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 no-drag">
           <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mr-2">HappyTool Agent v1.1</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 좌측: 설정 패널 ── */}
        <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/60">
          <div className="flex-1 overflow-hidden p-4">
            <AgentConfigPanel
              status={status}
              onStart={handleStart}
              onCancel={cancelAnalysis}
              onReset={reset}
            />
          </div>
        </div>

        {/* ── 우측: 분석 결과 패널 ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showReport ? (
            <div className="flex flex-col h-full">
              {/* 탭 헤더 */}
              <div className="flex-shrink-0 flex border-b border-slate-800 bg-slate-900/40">
                <div className="px-4 py-2.5 border-b-2 border-green-500 text-green-400 text-xs font-bold">
                  📄 Final Report
                </div>
                {iterations.length > 0 && (
                  <button
                    onClick={() => {}}
                    className="px-4 py-2.5 text-slate-500 text-xs hover:text-slate-300 transition-colors"
                  >
                    🧠 Analysis Process ({iterations.length} steps)
                  </button>
                )}
              </div>
              <FinalReportViewer report={finalReport!} />
            </div>
          ) : (
            <AgentThoughtStream
              status={status}
              iterations={iterations}
              currentIteration={currentIteration}
              maxIterations={maxIterations}
              extractionProgress={extractionProgress}
              userQuery={userQuery}
              errorMessage={errorMessage}
              onAnswerUserQuery={answerUserQuery}
            />
          )}
        </div> {/* flex-1 flex-col */}
      </div> {/* flex flex-1 overflow-hidden */}
    </div>
  );
};

export default LogAnalysisAgentPlugin;
