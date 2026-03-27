import React from 'react';
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

const EndpointTable: React.FC<EndpointTableProps> = ({
  data, title, sourceFile, searchQuery, setSearchQuery, expandedKeys, toggleExpand, onJumpToRaw, onCopy
}) => {
  return (
    <div className="flex flex-col h-full bg-[#0b0f19] rounded-lg border border-indigo-500/20 overflow-hidden">
      <div className="bg-[#0f172a] h-10 px-3 flex items-center justify-between border-b border-indigo-500/30">
        <div className="flex items-center space-x-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
          <span className="text-[10px] text-slate-500">{data.length} Nodes</span>
        </div>
        <div className="flex-1 max-w-xs mx-4 relative group">
          <Lucide.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" />
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

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="sticky top-0 bg-[#0f172a] shadow-sm text-slate-500 font-bold uppercase tracking-tighter z-10">
            <tr>
              <th className="px-3 py-2 border-b border-indigo-500/10">Hierarchy / Endpoint Structure</th>
              <th className="px-3 py-2 border-b border-indigo-500/10 text-right w-32 relative">
                <div className="text-[8px] text-slate-600 absolute -top-0.5 right-3">Grand Total</div>
                <div className="text-indigo-400 font-black tabular-nums">
                  {data.reduce((acc, curr) => acc + curr.totalCount, 0).toLocaleString()}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter(g => !searchQuery || g.templateUri.toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => b.totalCount - a.totalCount).map((group, idx) => {
              const isExpanded = expandedKeys.has(group.templateUri);
              return (
                <React.Fragment key={idx}>
                  <tr
                    className={`hover:bg-indigo-500/5 border-b border-slate-900 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-500/10' : ''}`}
                    onClick={() => toggleExpand(group.templateUri)}
                  >
                    <td className="px-2 py-2">
                      <div className="flex items-start space-x-2">
                        <Lucide.ChevronRight size={14} className={`mt-0.5 transition-transform ${isExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="font-mono text-slate-200 break-all leading-tight">
                            {group.templateUri.split('$(UUID)').map((part, pIdx, arr) => (
                              <React.Fragment key={pIdx}>
                                {part}
                                {pIdx < arr.length - 1 && (
                                  <span className="bg-amber-500/20 text-amber-400 px-1 rounded mx-0.5 font-bold shadow-sm">$(UUID)</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="flex items-center mt-1.5 space-x-2 text-[9px] opacity-40">
                            <span>{group.rawCalls.length} Variations</span>
                          </div>
                        </div>
                        <button
                          className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors hover:bg-indigo-500/10 rounded"
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
                    <td className="px-3 py-2 text-right font-bold text-indigo-400 font-mono text-xs tabular-nums">
                      {group.totalCount.toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-900/30">
                      <td colSpan={2} className="p-0">
                        <div className="py-2.5 px-3 pl-8 space-y-2 border-l-2 border-indigo-500/20 ml-4 mb-2">
                          {group.rawCalls.map((rc, rcIdx) => (
                            <div key={rcIdx} className="bg-slate-900/50 rounded border border-slate-800 overflow-hidden text-[10px] group/rc shadow-sm">
                              <div className="bg-slate-950/80 px-2.5 py-1.5 flex justify-between items-center border-b border-slate-800/50">
                                <div className="font-mono text-indigo-300 break-all flex-1">{rc.rawUri}</div>
                                <div className="flex items-center space-x-2.5 ml-4">
                                  <button 
                                    className="w-7 h-7 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90 shadow-sm"
                                    onClick={() => onJumpToRaw(sourceFile!, rc.lineIndices || [], rc.rawUri)}
                                    title="Jump to Raw View"
                                  >
                                     <Lucide.Eye size={12} />
                                  </button>
                                  <button className="w-7 h-7 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-white transition-all active:scale-90 shadow-sm" onClick={() => onCopy(rc.rawUri, 'Path copied')}>
                                    <Lucide.Copy size={11} />
                                  </button>
                                  <div className="font-bold text-slate-500 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800 tabular-nums">x{rc.count}</div>
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
