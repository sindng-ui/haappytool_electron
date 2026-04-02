import React, { useState } from 'react';
import { LogRule } from '../../types';
import { AnalysisType, IterationRecord } from './protocol';
import { useAnalysisAgent } from './hooks/useAnalysisAgent';
import AgentConfigPanel from './components/AgentConfigPanel';
import AgentThoughtStream from './components/AgentThoughtStream';
import FinalReportViewer from './components/FinalReportViewer';
import { BrainCircuit, Bug, Terminal, ChevronRight, ChevronDown, FileText } from 'lucide-react';

const DebugItem: React.FC<{ record: IterationRecord }> = ({ record }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#020617]/40 mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] bg-slate-900/60 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
            {record.iteration}
          </span>
          <span className="text-slate-400 font-bold uppercase tracking-wider">
            {record.action?.type || (record.rawResponse?.final_report ? 'COMPLETED' : 'THOUGHT')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-slate-600 font-medium">
            {new Date(record.timestamp).toLocaleTimeString()}
          </span>
          {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
        </div>
      </button>
      
      {isOpen && (
        <div className="p-3 bg-[#020617]/80 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[9px] text-indigo-400/60 font-black uppercase tracking-widest pl-1">
              <Terminal size={10} />
              Request Payload
            </div>
            <pre className="p-2.5 rounded bg-black/40 text-[10px] text-slate-300 font-mono overflow-x-auto border border-slate-800/30">
              {JSON.stringify(record.rawRequest, null, 2)}
            </pre>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[9px] text-emerald-400/60 font-black uppercase tracking-widest pl-1">
              <Terminal size={10} />
              Response Payload
            </div>
            <pre className="p-2.5 rounded bg-black/40 text-[10px] text-emerald-100/90 font-mono overflow-x-auto border border-slate-800/30">
              {JSON.stringify(record.rawResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

const LogAnalysisAgentPlugin: React.FC = () => {
  const { state, startAnalysis, cancelAnalysis, answerUserQuery, reset } = useAnalysisAgent();
  const [debugMode, setDebugMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'debug'>('report');
  
  const { status, iterations, currentIteration, maxIterations, extractionProgress,
          finalReport, userQuery, errorMessage } = state;

  const handleStart = (
    logText: string,
    fileName: string,
    rule: LogRule | null,
    analysisType: AnalysisType
  ) => {
    startAnalysis([{ text: logText, name: fileName }], rule, analysisType);
  };

  const showReport = finalReport && (status === 'completed' || status === 'cancelled');

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* ── 상단 드래그 가능한 타이틀 바 ── */}
      <div 
        className="h-10 flex items-center bg-slate-900 border-b border-slate-800 px-4 shrink-0 z-20 title-drag" 
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 mr-6 select-none no-drag">
          <BrainCircuit size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Log Analysis Agent</span>
        </div>

        <div className="flex items-center gap-3 no-drag">
           <button 
             onClick={() => setDebugMode(!debugMode)}
             className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border transition-all duration-300 no-drag w-[105px] h-[26px] shrink-0 ${
               debugMode 
                 ? "bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
                 : "bg-slate-800/40 border-slate-700/30 text-slate-500 hover:border-slate-600 hover:text-slate-400"
             }`}
           >
             <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 shrink-0 ${debugMode ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "bg-slate-700"}`} />
             <div className="flex items-center gap-1.5 flex-1">
               <Bug size={11} className={debugMode ? "text-amber-400" : "text-slate-600"} />
               <span className="text-[9px] font-black uppercase tracking-[0.05em] whitespace-nowrap">Debug</span>
             </div>
             {debugMode && <span className="text-[8px] font-black bg-amber-500 text-[#020617] px-1 rounded-sm animate-pulse shrink-0">ON</span>}
           </button>
           <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest ml-1">v1.1</p>
        </div>

        <div className="flex-1" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 좌측: 설정 패널 ── */}
        <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/60 shadow-2xl z-10">
          <div className="flex-1 overflow-hidden">
            <AgentConfigPanel
              status={status}
              onStart={(files, rule, at, hints) => startAnalysis(files, rule, at, hints)}
              onCancel={cancelAnalysis}
              onReset={() => { reset(); setActiveTab('report'); }}
            />
          </div>
        </div>

        {/* ── 우측: 분석 결과 패널 ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#020617]/30">
          {showReport ? (
            <div className="flex flex-col h-full">
              {/* 탭 헤더 */}
              <div className="flex-shrink-0 flex items-center bg-slate-900/60 border-b border-slate-800 h-10 px-2">
                <button
                  onClick={() => setActiveTab('report')}
                  className={`px-4 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'report' ? 'text-emerald-400 bg-emerald-500/5 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <FileText size={12} />
                  Final Report
                </button>
                {debugMode && (
                  <button
                    onClick={() => setActiveTab('debug')}
                    className={`px-4 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'debug' ? 'text-amber-400 bg-amber-500/5 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Terminal size={12} />
                    LLM Communication ({iterations.length})
                  </button>
                )}
                <div className="ml-auto px-3">
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">
                    Analysis Completed in {iterations.length} iterations
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {activeTab === 'report' ? (
                  <FinalReportViewer report={finalReport!} />
                ) : (
                  <div className="h-full flex flex-col bg-[#020617]">
                    <div className="p-4 overflow-y-auto custom-scrollbar space-y-1">
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <Terminal size={14} className="text-amber-500" />
                        <h4 className="text-[11px] font-black text-amber-200/80 uppercase tracking-[0.2em]">Debug Console</h4>
                      </div>
                      {iterations.map(it => (
                        <DebugItem key={it.iteration} record={it} />
                      ))}
                      {iterations.length === 0 && (
                        <div className="h-[200px] flex flex-col items-center justify-center text-slate-800">
                          <Terminal size={40} className="mb-2 opacity-10" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">No LLM transactions recorded</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
        </div>
      </div>
    </div>
  );
};

export default LogAnalysisAgentPlugin;
