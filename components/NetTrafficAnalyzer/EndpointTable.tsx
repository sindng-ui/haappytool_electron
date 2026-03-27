import React, { useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { TemplateGroup } from '../../workers/NetTraffic.worker';

interface EndpointTableProps {
  data: TemplateGroup[];
  title: string;
  sourceFile: File | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  expandedKeys: Set<string>;
  toggleExpand: (key: string) => void;
  onJumpToRaw: (file: File, lineIndices: number[], title: string) => void;
  onCopy: (text: string, summary: string) => void;
}

// HTTP Method badge color mapping
const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30' },
  POST:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  PUT:    { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  DELETE: { bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-500/30' },
  PATCH:  { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30' },
  HEAD:   { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30' },
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

const EndpointTable: React.FC<EndpointTableProps> = ({
  data, title, sourceFile, searchQuery, setSearchQuery, expandedKeys, toggleExpand, onJumpToRaw, onCopy
}) => {
  const grandTotal = useMemo(() => data.reduce((acc, curr) => acc + curr.totalCount, 0), [data]);
  const maxHit = useMemo(() => Math.max(...data.map(d => d.totalCount), 1), [data]);

  // Extract HTTP method from templateUri like "[GET] https://..."
  const extractMethod = (uri: string): string | null => {
    const match = uri.match(/^\[([A-Z]+)\]\s*/);
    return match ? match[1] : null;
  };

  const getMethodStyle = (method: string | null) => {
    if (!method) return METHOD_COLORS.GET;
    return METHOD_COLORS[method] || METHOD_COLORS.GET;
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] rounded-lg border border-indigo-500/20 overflow-hidden">
      {/* Header */}
      <div className="bg-[#0f172a] h-11 px-3 flex items-center justify-between border-b border-indigo-500/30">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Lucide.Globe size={13} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{title}</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-[10px] text-slate-500 tabular-nums">{data.length} <span className="text-[8px] opacity-60">Patterns</span></span>
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
        <button
          className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-tight flex items-center space-x-1 bg-emerald-500/10 px-2.5 py-1.5 rounded border border-emerald-500/20"
          onClick={() => {
            let md = `## Master API Index: ${title}\n\n`;
            [...data].sort((a, b) => b.totalCount - a.totalCount).forEach(g => {
              md += `### ${g.templateUri} (Hits: ${g.totalCount})\n`;
              md += `| Variation | Count |\n| :--- | :--- |\n`;
              g.rawCalls.forEach(rc => {
                md += `| \`${rc.rawUri}\` | ${rc.count} |\n`;
              });
              md += `\n`;
            });
            onCopy(md, 'Full API Index copied');
          }}
        >
          <Lucide.Copy size={12} />
          <span>Copy All</span>
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="sticky top-0 bg-[#0f172a] shadow-md text-slate-500 font-bold uppercase tracking-tighter z-10">
            <tr>
              <th className="px-3 py-2.5 border-b border-indigo-500/10">
                <span className="text-[9px]">Endpoint Pattern</span>
              </th>
              <th className="px-3 py-2.5 border-b border-indigo-500/10 text-right w-48">
                <div className="flex items-center justify-end space-x-2">
                  <span className="text-[9px] text-slate-600">Grand Total</span>
                  <span className="text-indigo-400 font-black tabular-nums text-sm">
                    {grandTotal.toLocaleString()}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter(g => !searchQuery || g.templateUri.toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => b.totalCount - a.totalCount).map((group, idx) => {
              const isExpanded = expandedKeys.has(group.templateUri);
              const method = extractMethod(group.templateUri);
              const methodStyle = getMethodStyle(method);
              const hitRatio = (group.totalCount / maxHit) * 100;
              const sharePercent = grandTotal > 0 ? ((group.totalCount / grandTotal) * 100) : 0;
              const displayUri = method ? group.templateUri.replace(/^\[[A-Z]+\]\s*/, '') : group.templateUri;

              return (
                <React.Fragment key={idx}>
                  <tr
                    className={`hover:bg-indigo-500/5 border-b border-slate-900/60 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-500/8' : ''}`}
                    onClick={() => toggleExpand(group.templateUri)}
                  >
                    <td className="px-2 py-2.5">
                      <div className="flex items-start space-x-2">
                        <Lucide.ChevronRight size={14} className={`mt-0.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                        <div className="flex flex-col min-w-0 flex-1 space-y-1.5">
                          {/* Method Badge + URI */}
                          <div className="flex items-center space-x-2">
                            {/* Rank icon for top 3 */}
                            {idx < 3 && <span className="text-[12px] leading-none shrink-0">{RANK_ICONS[idx]}</span>}
                            {/* HTTP Method Badge */}
                            {method && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border} tracking-wider shrink-0`}>
                                {method}
                              </span>
                            )}
                            <div className="font-mono text-slate-200 break-all leading-tight text-[11px]">
                              {displayUri.split('$(UUID)').map((part, pIdx, arr) => (
                                <React.Fragment key={pIdx}>
                                  {part}
                                  {pIdx < arr.length - 1 && (
                                    <span className="bg-amber-500/20 text-amber-400 px-1 rounded mx-0.5 font-bold text-[9px]">$(UUID)</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 text-[9px] text-slate-500">
                            <span>{group.rawCalls.length} variation{group.rawCalls.length > 1 ? 's' : ''}</span>
                            <span className="opacity-30">·</span>
                            <span className="tabular-nums">{sharePercent.toFixed(1)}% of total</span>
                          </div>
                        </div>
                        <button
                          className="p-1.5 text-slate-600 hover:text-indigo-400 transition-colors hover:bg-indigo-500/10 rounded shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const text = `Endpoint: ${group.templateUri}\n` + group.rawCalls.map(rc => `  - ${rc.rawUri} (x${rc.count})`).join('\n');
                            onCopy(text, 'Hierarchy copied');
                          }}
                        >
                          <Lucide.Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right w-48">
                      <div className="flex flex-col items-end space-y-1.5">
                        <span className="font-black text-indigo-400 font-mono text-sm tabular-nums leading-none">
                          {group.totalCount.toLocaleString()}
                        </span>
                        {/* Hit volume bar */}
                        <div className="w-full max-w-[120px] bg-slate-900 h-[5px] rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${hitRatio}%`,
                              background: idx === 0 ? 'linear-gradient(90deg, #6366f1, #818cf8)' 
                                : idx === 1 ? 'linear-gradient(90deg, #6366f1cc, #818cf8aa)' 
                                : idx === 2 ? 'linear-gradient(90deg, #6366f1aa, #818cf888)' 
                                : '#6366f160'
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-950/40">
                      <td colSpan={2} className="p-0">
                        <div className="py-2.5 px-3 pl-8 space-y-2 border-l-2 border-indigo-500/20 ml-4 mb-2">
                          {group.rawCalls.map((rc, rcIdx) => (
                            <div key={rcIdx} className="bg-slate-900/60 rounded-lg border border-slate-800/60 overflow-hidden text-[10px] shadow-sm hover:border-slate-700 transition-colors">
                              <div className="px-3 py-2 flex justify-between items-center">
                                <div className="font-mono text-indigo-300/90 break-all flex-1 leading-relaxed">{rc.rawUri}</div>
                                <div className="flex items-center space-x-2 ml-4 shrink-0">
                                  <button 
                                    className="w-7 h-7 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90"
                                    onClick={() => onJumpToRaw(sourceFile!, rc.lineIndices || [], rc.rawUri)}
                                    title="Jump to Raw View"
                                  >
                                     <Lucide.Eye size={12} />
                                  </button>
                                  <button className="w-7 h-7 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-white transition-all active:scale-90" onClick={() => onCopy(rc.rawUri, 'Path copied')}>
                                    <Lucide.Copy size={11} />
                                  </button>
                                  <div className="font-bold text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 tabular-nums text-[10px]">×{rc.count}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EndpointTable;
