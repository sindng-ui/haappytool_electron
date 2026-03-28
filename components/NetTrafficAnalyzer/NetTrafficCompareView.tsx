import React, { useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { TemplateGroup, UAResult, InsightStats } from '../../workers/NetTraffic.worker';
import { compareEndpoints, compareUAs, EndpointDiff, UADiff } from '../../utils/netTrafficDiffUtils';
import CompareSummary from './CompareSummary';
import CompareEndpointTable from './CompareEndpointTable';
import CompareUATable from './CompareUATable';
import InsightsTab from './InsightsTab';

interface NetTrafficCompareViewProps {
  leftResult: TemplateGroup[];
  rightResult: TemplateGroup[];
  leftUAResult: UAResult[];
  rightUAResult: UAResult[];
  leftInsights: InsightStats | null;
  rightInsights: InsightStats | null;
  onCopy: (text: string, summary: string) => void;
}

const NetTrafficCompareView: React.FC<NetTrafficCompareViewProps> = ({
  leftResult, rightResult, leftUAResult, rightUAResult, leftInsights, rightInsights, onCopy
}) => {
  const [resultTab, setResultTab] = useState<'endpoints' | 'ua' | 'insights'>('endpoints');

  const endpointDiffs = useMemo(() => compareEndpoints(leftResult, rightResult), [leftResult, rightResult]);
  const uaDiffs = useMemo(() => compareUAs(leftUAResult, rightUAResult), [leftUAResult, rightUAResult]);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative shadow-[inset_10px_0_20px_rgba(0,0,0,0.5)]">
      {/* Result Tabs with Icons */}
      <div className="shrink-0">
        <div className="h-10 flex bg-[#0f172a] border-b border-indigo-500/20">
          <button onClick={() => setResultTab('endpoints')} className={`px-6 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${resultTab === 'endpoints' ? 'text-indigo-400 bg-slate-900/50 shadow-[inset_0_-2px_0_#6366f1]' : 'text-slate-500 hover:text-slate-400'}`}>
            <Lucide.Globe size={12} /><span>Endpoints</span>
          </button>
          <button onClick={() => setResultTab('ua')} className={`px-6 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${resultTab === 'ua' ? 'text-indigo-400 bg-slate-900/50 shadow-[inset_0_-2px_0_#6366f1]' : 'text-slate-500 hover:text-slate-400'}`}>
            <Lucide.Users size={12} /><span>User Agents</span>
          </button>
          <button onClick={() => setResultTab('insights')} className={`px-6 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${resultTab === 'insights' ? 'text-indigo-400 bg-slate-900/50 shadow-[inset_0_-2px_0_#6366f1]' : 'text-slate-500 hover:text-slate-400'}`}>
            <Lucide.BarChart3 size={12} /><span>Side-by-side Insights</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {resultTab === 'endpoints' && (
          <>
            <CompareSummary endpointDiffs={endpointDiffs} leftInsights={leftInsights} rightInsights={rightInsights} />
            <div className="flex-1 p-3 overflow-hidden">
               <CompareEndpointTable diffs={endpointDiffs} onCopy={onCopy} />
            </div>
          </>
        )}
        {resultTab === 'ua' && (
          <div className="flex-1 p-3 overflow-hidden">
             <CompareUATable diffs={uaDiffs} onCopy={onCopy} />
          </div>
        )}
        {resultTab === 'insights' && (
          <div className="flex-1 flex space-x-3 p-3 overflow-hidden bg-[#0b0f19]">
            <div className="flex-1 flex flex-col bg-slate-900/20 rounded-xl overflow-hidden border border-slate-900 shadow-lg">
              <div className="bg-indigo-900/10 px-4 py-2 text-[9px] font-black uppercase text-indigo-400 border-b border-indigo-900/30 flex items-center space-x-2">
                <Lucide.FileText size={10} /><span>Primary Source (Left)</span>
              </div>
              <InsightsTab insights={leftInsights} sourceName="Primary" onCopy={onCopy} />
            </div>
            <div className="flex-1 flex flex-col bg-slate-900/20 rounded-xl overflow-hidden border border-slate-900 shadow-lg">
              <div className="bg-rose-900/10 px-4 py-2 text-[9px] font-black uppercase text-rose-400 border-b border-rose-900/30 flex items-center space-x-2">
                <Lucide.FileText size={10} /><span>Reference Source (Right)</span>
              </div>
              <InsightsTab insights={rightInsights} sourceName="Reference" onCopy={onCopy} />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-8 border-t border-slate-900 bg-[#0f172a] px-4 flex items-center justify-between text-[10px] text-slate-500 select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" /><span className="font-black uppercase tracking-widest text-[9px]" style={{color:'#10b981'}}>Engine v2.2 (Diff/Compare)</span></div>
          <span className="opacity-20">|</span><span className="tabular-nums">Compared Patterns: <span className="text-indigo-400 font-black">{endpointDiffs.length}</span></span>
        </div>
        <div className="text-[9px] font-black opacity-30 tracking-[0.2em] uppercase">HappyTool NetTraffic Diff</div>
      </div>
    </div>
  );
};

export default NetTrafficCompareView;
