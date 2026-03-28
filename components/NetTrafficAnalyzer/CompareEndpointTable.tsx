import React, { useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { EndpointDiff } from '../../utils/netTrafficDiffUtils';

interface CompareEndpointTableProps {
  diffs: EndpointDiff[];
  onCopy: (text: string, summary: string) => void;
}

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30' },
  POST:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  PUT:    { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  DELETE: { bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-500/30' },
  PATCH:  { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30' },
  HEAD:   { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30' },
};

const CompareEndpointTable: React.FC<CompareEndpointTableProps> = ({ diffs, onCopy }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Max hit for visual bar normalization
  const maxHit = useMemo(() => {
    return Math.max(...diffs.map(d => Math.max(d.leftCount, d.rightCount, 1)));
  }, [diffs]);

  const filteredDiffs = useMemo(() => {
    if (!searchQuery) return diffs;
    const lowerQ = searchQuery.toLowerCase();
    return diffs.filter(d => d.templateUri.toLowerCase().includes(lowerQ));
  }, [diffs, searchQuery]);

  const extractMethod = (uri: string): string | null => {
    const match = uri.match(/^\[([A-Z]+)\]\s*/);
    return match ? match[1] : null;
  };

  const badgeStyles = {
    INCREASED: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    DECREASED: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    NEW: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    REMOVED: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    UNCHANGED: 'bg-transparent text-slate-500',
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] rounded-lg border border-indigo-500/20 overflow-hidden">
      {/* Header */}
      <div className="bg-[#0f172a] h-11 px-3 flex items-center justify-between border-b border-indigo-500/30">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Lucide.GitCompare size={13} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Diff Analysis</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-[10px] text-slate-500 tabular-nums">{diffs.length} <span className="text-[8px] opacity-60">Patterns</span></span>
        </div>
        <div className="flex-1 max-w-xs mx-4 relative group">
          <Lucide.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search endpoints..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 rounded-full pl-8 pr-4 py-1 text-[10px] outline-none transition-all placeholder:text-slate-600 text-slate-200"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            ><Lucide.X size={12} /></button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="sticky top-0 bg-[#0f172a] shadow-md text-slate-500 font-bold uppercase tracking-tighter z-10">
            <tr>
              <th className="px-3 py-2.5 border-b border-indigo-500/10">
                <span className="text-[9px]">Endpoint Pattern</span>
              </th>
              <th className="px-3 py-2.5 border-b border-indigo-500/10 text-center w-24">
                <span className="text-[9px]">Diff</span>
              </th>
              <th className="px-3 py-2.5 border-b border-indigo-500/10 text-right w-56">
                <span className="text-[9px]">Left vs Right</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDiffs.map((diff, idx) => {
              const method = extractMethod(diff.templateUri);
              const methodStyle = method ? METHOD_COLORS[method] || METHOD_COLORS.GET : METHOD_COLORS.GET;
              const displayUri = method ? diff.templateUri.replace(/^\[[A-Z]+\]\s*/, '') : diff.templateUri;
              
              const leftWidth = `${(diff.leftCount / maxHit) * 100}%`;
              const rightWidth = `${(diff.rightCount / maxHit) * 100}%`;

              return (
                <tr key={idx} className="hover:bg-indigo-500/5 border-b border-slate-900/60 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center space-x-2">
                        {method && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border} tracking-wider shrink-0`}>{method}</span>}
                        <div className="font-mono text-slate-200 break-all leading-tight text-[11px]">
                          {displayUri.split('$(UUID)').map((part, pIdx, arr) => (
                            <React.Fragment key={pIdx}>
                              {part}
                              {pIdx < arr.length - 1 && <span className="bg-amber-500/20 text-amber-400 px-1 rounded mx-0.5 font-bold text-[9px]">$(UUID)</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded ${badgeStyles[diff.status]} min-w-[60px]`}>
                      <span className="font-black text-[11px] font-mono whitespace-nowrap leading-none tracking-tight">
                        {diff.diff > 0 ? '+' : ''}{diff.diff.toLocaleString()}
                      </span>
                      {diff.status !== 'UNCHANGED' && diff.status !== 'NEW' && diff.status !== 'REMOVED' && (
                        <span className="text-[8px] font-bold mt-1 leading-none tracking-widest">{diff.diffPercent > 0 ? '+' : ''}{diff.diffPercent.toFixed(1)}%</span>
                      )}
                      {(diff.status === 'NEW' || diff.status === 'REMOVED') && (
                        <span className="text-[8px] font-bold mt-1 leading-none tracking-widest uppercase">{diff.status}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right w-64 pr-4">
                    <div className="flex flex-col space-y-1.5 justify-center">
                      <div className="flex items-center space-x-2 justify-end">
                        <span className="text-[9px] text-slate-500 font-mono w-16 tabular-nums">{diff.leftCount.toLocaleString()}</span>
                        <div className="w-24 bg-slate-900 h-[6px] rounded-full overflow-hidden flex flex-row-reverse">
                          <div className={`h-full ${diff.leftCount > 0 ? 'bg-indigo-500/50' : ''}`} style={{ width: leftWidth }} />
                        </div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 w-4 text-center">L</span>
                      </div>
                      <div className="flex items-center space-x-2 justify-end">
                        <span className={`text-[9px] font-mono font-bold w-16 tabular-nums ${diff.diff > 0 ? 'text-rose-400' : diff.diff < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{diff.rightCount.toLocaleString()}</span>
                        <div className="w-24 bg-slate-900 h-[6px] rounded-full overflow-hidden flex flex-row-reverse">
                          <div className={`h-full bg-indigo-500 ${diff.diff > 0 ? 'bg-rose-500' : ''}`} style={{ width: rightWidth }} />
                        </div>
                        <span className="text-[9px] uppercase font-bold text-indigo-400 w-4 text-center">R</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CompareEndpointTable;
