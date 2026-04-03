import React, { useState, useCallback, useMemo } from 'react';
import { LogRule } from '../../types';
import { AnalysisType, IterationRecord } from './protocol';
import { useAnalysisAgent } from './hooks/useAnalysisAgent';
import AgentConfigPanel from './components/AgentConfigPanel';
import AgentThoughtStream from './components/AgentThoughtStream';
import { BrainCircuit, Terminal, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { useHappyTool } from '../../contexts/HappyToolContext';

const DebugItem: React.FC<{ record: IterationRecord }> = React.memo(({ record }) => {
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
});

const LogAnalysisAgentPlugin: React.FC = () => {
  const { state, startAnalysis, cancelAnalysis, answerUserQuery, reset } = useAnalysisAgent();
  const [activeTab, setActiveTab] = useState<'analysis' | 'communication'>('analysis');
  const { logRules } = useHappyTool();
  
  const { status, iterations, currentIteration, maxIterations, extractionProgress,
          finalReport, userQuery, errorMessage } = state;

  const handleStartAnalysis = useCallback((files: { text: string; name: string }[], rule: LogRule | null, type: AnalysisType, hints?: any) => {
    startAnalysis(files, rule, type, hints);
  }, [startAnalysis]);

  const handleReset = useCallback(() => {
    reset();
    setActiveTab('analysis');
  }, [reset]);

  const handleTabAnalysis = useCallback(() => setActiveTab('analysis'), []);
  const handleTabCommunication = useCallback(() => setActiveTab('communication'), []);

  const reversedIterations = useMemo(() => [...iterations].reverse(), [iterations]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <div 
        className="h-10 flex items-center bg-slate-900 border-b border-slate-800 px-4 shrink-0 z-20 title-drag" 
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 mr-6 select-none no-drag">
          <BrainCircuit size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Log Analysis Agent</span>
        </div>

        <div className="flex items-center gap-3 no-drag">
           <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest ml-1">v1.1</p>
        </div>

        <div className="flex-1" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/60 shadow-2xl z-10">
          <div className="flex-1 overflow-hidden">
            <AgentConfigPanel
              status={status}
              logRules={logRules}
              onStart={handleStartAnalysis}
              onCancel={cancelAnalysis}
              onReset={handleReset}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-[#020617]/30">
          <div className="flex-shrink-0 flex items-center bg-slate-900/60 border-b border-slate-800 h-11 px-2">
            <button
              onClick={handleTabAnalysis}
              className={`px-5 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 relative group ${activeTab === 'analysis' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <FileText size={14} className={activeTab === 'analysis' ? 'text-indigo-400' : 'text-slate-600'} />
              1. Analysis
              {activeTab === 'analysis' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              )}
            </button>
            <button
              onClick={handleTabCommunication}
              className={`px-5 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 relative group ${activeTab === 'communication' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Terminal size={14} className={activeTab === 'communication' ? 'text-amber-400' : 'text-slate-600'} />
              2. LLM Communication
              <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-md font-black ${activeTab === 'communication' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-600'}`}>
                {iterations.length}
              </span>
              {activeTab === 'communication' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              )}
            </button>
            
            <div className="ml-auto flex items-center gap-3 px-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter leading-none mb-0.5">Iteration Status</span>
                <span className="text-[10px] text-slate-400 font-mono font-black">{currentIteration} / {maxIterations}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'analysis' ? (
              <AgentThoughtStream
                status={status}
                iterations={iterations}
                currentIteration={currentIteration}
                maxIterations={maxIterations}
                extractionProgress={extractionProgress}
                userQuery={userQuery}
                errorMessage={errorMessage}
                finalReport={finalReport}
                onAnswerUserQuery={answerUserQuery}
              />
            ) : (
              <div className="h-full flex flex-col bg-[#020617]">
                <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <Terminal size={16} className="text-amber-500" />
                      <h4 className="text-[11px] font-black text-amber-200/80 uppercase tracking-[0.2em]">Communication Logs</h4>
                    </div>
                    <span className="text-[9px] font-black text-slate-600 uppercase">Raw JSON Traffic</span>
                  </div>
                  <div className="space-y-3">
                    {reversedIterations.map(it => (
                      <DebugItem key={it.iteration} record={it} />
                    ))}
                    {iterations.length === 0 && (
                      <div className="h-[300px] flex flex-col items-center justify-center text-slate-800 opacity-30">
                        <Terminal size={48} strokeWidth={1} className="mb-4" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em]">No Communication recorded yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogAnalysisAgentPlugin;
