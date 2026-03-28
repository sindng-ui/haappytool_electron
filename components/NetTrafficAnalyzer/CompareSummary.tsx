import React, { useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { EndpointDiff } from '../../utils/netTrafficDiffUtils';
import { InsightStats } from '../../workers/NetTraffic.worker';

interface CompareSummaryProps {
  endpointDiffs: EndpointDiff[];
  leftInsights: InsightStats | null;
  rightInsights: InsightStats | null;
}

const CompareSummary: React.FC<CompareSummaryProps> = ({ endpointDiffs, leftInsights, rightInsights }) => {
  const totalLeft = leftInsights?.totalRequests || 0;
  const totalRight = rightInsights?.totalRequests || 0;
  const totalDiff = totalRight - totalLeft;
  const totalDiffPercent = totalLeft > 0 ? (totalDiff / totalLeft) * 100 : 0;

  const newEndpoints = endpointDiffs.filter(d => d.status === 'NEW');
  const removedEndpoints = endpointDiffs.filter(d => d.status === 'REMOVED');
  const increasedEndpoints = endpointDiffs.filter(d => d.status === 'INCREASED');
  
  // Find top spike
  const topSpike = increasedEndpoints.length > 0 
    ? increasedEndpoints.reduce((prev, current) => (prev.diff > current.diff) ? prev : current) 
    : null;

  return (
    <div className="grid grid-cols-4 gap-3 p-3 shrink-0 border-b border-indigo-500/20 bg-[#0b0f19]">
      {/* 1. Total Traffic Diff */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
        <div className="flex items-center space-x-2 text-[10px] uppercase font-black tracking-widest text-slate-400">
          <Lucide.Activity size={12} className="text-indigo-400" />
          <span>Traffic Volume</span>
        </div>
        <div className="flex items-baseline space-x-2 mt-2">
          <span className="text-lg font-black font-mono text-slate-200">{totalRight.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 line-through">{totalLeft.toLocaleString()}</span>
        </div>
        <div className={`text-[10px] font-bold mt-1 tracking-wider ${totalDiff > 0 ? 'text-rose-400' : totalDiff < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
          {totalDiff > 0 ? '+' : ''}{totalDiff.toLocaleString()} ({totalDiff > 0 ? '+' : ''}{totalDiffPercent.toFixed(1)}%)
        </div>
      </div>

      {/* 2. Top Spike */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[10px] uppercase font-black tracking-widest text-slate-400">
            <Lucide.TrendingUp size={12} className="text-rose-400" />
            <span>Top Spike</span>
          </div>
          <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-black border border-rose-500/30">WARNING</span>
        </div>
        {topSpike ? (
          <div className="mt-2 flex flex-col">
            <span className="text-[10px] font-mono text-slate-300 truncate max-w-full" title={topSpike.templateUri}>
              {topSpike.templateUri.replace(/^\[[A-Z]+\]\s*/, '')}
            </span>
            <span className="text-[11px] font-black font-mono text-rose-400 mt-1">+{topSpike.diff.toLocaleString()} hits</span>
          </div>
        ) : (
          <div className="mt-2 text-[10px] text-slate-500 italic">No increased endpoints</div>
        )}
      </div>

      {/* 3. New Endpoints */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
        <div className="flex items-center space-x-2 text-[10px] uppercase font-black tracking-widest text-slate-400">
          <Lucide.PlusCircle size={12} className="text-amber-400" />
          <span>New Endpoints</span>
        </div>
        <div className="flex items-baseline space-x-2 mt-2">
          <span className="text-lg font-black font-mono text-amber-400">{newEndpoints.length}</span>
          <span className="text-[10px] text-slate-500 tracking-wider uppercase font-bold">Patterns</span>
        </div>
        <div className="text-[10px] font-bold mt-1 text-slate-400 truncate">
          +{newEndpoints.reduce((sum, d) => sum + d.diff, 0).toLocaleString()} new hits
        </div>
      </div>

      {/* 4. Resolved/Removed Endpoints */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[10px] uppercase font-black tracking-widest text-slate-400">
            <Lucide.MinusCircle size={12} className="text-emerald-400" />
            <span>Removed</span>
          </div>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black border border-emerald-500/30">GOOD</span>
        </div>
        <div className="flex items-baseline space-x-2 mt-2">
          <span className="text-lg font-black font-mono text-emerald-400">{removedEndpoints.length}</span>
          <span className="text-[10px] text-slate-500 tracking-wider uppercase font-bold">Patterns</span>
        </div>
        <div className="text-[10px] font-bold mt-1 text-slate-400 truncate">
          {removedEndpoints.reduce((sum, d) => sum + d.diff, 0).toLocaleString()} hits removed
        </div>
      </div>
    </div>
  );
};

export default CompareSummary;
