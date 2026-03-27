import React from 'react';
import * as Lucide from 'lucide-react';
import { UAResult } from '../../workers/NetTraffic.worker';

interface UATableProps {
  data: UAResult[];
  title: string;
  sourceFile: File | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  expandedKeys: Set<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  onJumpToRaw: (file: File, lineIndices: number[], title: string) => void;
  onCopy: (text: string, summary: string) => void;
}

const UATable: React.FC<UATableProps> = ({
  data, title, sourceFile, searchQuery, setSearchQuery, expandedKeys, setExpandedKeys, onJumpToRaw, onCopy
}) => {
  const getUAKey = (vars: Record<string, string>) => `ua-${JSON.stringify(vars)}`;

  const toggleClusterExpand = (uaKey: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(uaKey)) next.delete(uaKey);
      else next.add(uaKey);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] rounded-lg border border-indigo-500/20 overflow-hidden">
      <div className="bg-[#0f172a] h-10 px-3 flex items-center justify-between border-b border-indigo-500/30">
        <div className="flex items-center space-x-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
          <div className="flex items-center space-x-1 border-l border-slate-800 pl-4 h-4">
            <button
              className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-tight"
              onClick={() => {
                setExpandedKeys(prev => {
                  const next = new Set(prev);
                  data.forEach(row => next.add(getUAKey(row.variables)));
                  return next;
                });
              }}
            >Expand All</button>
            <span className="text-slate-700 text-[10px] self-center">/</span>
            <button
              className="text-[9px] font-bold text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-tight"
              onClick={() => {
                setExpandedKeys(prev => {
                  const next = new Set(prev);
                  data.forEach(row => next.delete(getUAKey(row.variables)));
                  return next;
                });
              }}
            >Collapse All</button>
          </div>
          <span className="text-[10px] text-slate-500 border-l border-slate-800 pl-4 h-4 flex items-center">{data.length} Clients</span>
        </div>
        <div className="flex-1 max-w-xs mx-4 relative group">
          <Lucide.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" />
          <input 
            type="text" 
            placeholder="Search UA or API..." 
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
            let md = `# Client Fingerprint clusters: ${title}\n\n`;
            [...data].sort((a, b) => b.count - a.count).forEach(row => {
              const vars = Object.entries(row.variables).map(([k, v]) => `${k}: ${v}`).join(', ');
              md += `## UA: [${vars}] (Hits: ${row.count})\n\n`;
              row.endpoints.forEach(ep => {
                md += `### Pattern: ${ep.templateUri} (x${ep.totalCount})\n`;
                md += `| Variation | Count |\n| :--- | :--- |\n`;
                ep.rawCalls.forEach(rc => {
                  md += `| \`${rc.rawUri}\` | ${rc.count} |\n`;
                });
                md += `\n`;
              });
              md += `---\n\n`;
            });
            onCopy(md, 'All UA Data copied');
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
              <th className="px-3 py-2 border-b border-indigo-500/10">Identified Context Details</th>
              <th className="px-3 py-2 border-b border-indigo-500/10 text-right w-24">Hits</th>
            </tr>
          </thead>
          <tbody>
            {data.filter(row => {
              const varsMatch = Object.values(row.variables).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()));
              const endpointsMatch = row.endpoints.some(ep => ep.templateUri.toLowerCase().includes(searchQuery.toLowerCase()));
              return !searchQuery || varsMatch || endpointsMatch;
            }).sort((a, b) => {
              const aIsNone = Object.values(a.variables).some(v => String(v).includes('No User Agent Detected'));
              const bIsNone = Object.values(b.variables).some(v => String(v).includes('No User Agent Detected'));
              if (aIsNone && !bIsNone) return 1;
              if (!aIsNone && bIsNone) return -1;
              return b.count - a.count;
            }).map((row) => {
              const uaKey = getUAKey(row.variables);
              const isExpanded = expandedKeys.has(uaKey);
              return (
                <React.Fragment key={uaKey}>
                  <tr
                    className={`hover:bg-indigo-500/5 border-b border-slate-900 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-500/10' : ''}`}
                    onClick={() => toggleClusterExpand(uaKey)}
                  >
                    <td className="px-2 py-2.5">
                      <div className="flex items-start space-x-2">
                        <Lucide.ChevronRight size={14} className={`mt-0.5 transition-transform ${isExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {Object.entries(row.variables).map(([k, v]) => (
                            <div key={k} className="flex items-center space-x-1.5 border border-slate-800 rounded px-2 py-0.5 bg-slate-900/50 shadow-sm">
                              <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">{k}</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{v}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors hover:bg-indigo-500/10 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            const vars = Object.entries(row.variables).map(([k, v]) => `${k}: ${v}`).join(', ');
                            const text = `UA Context: [${vars}]\n` + row.endpoints.map(ep => {
                              let epText = `  - ${ep.templateUri} (x${ep.totalCount})`;
                              if (ep.rawCalls.length > 1) {
                                epText += '\n' + ep.rawCalls.map(rc => `    * ${rc.rawUri} (x${rc.count})`).join('\n');
                              }
                              return epText;
                            }).join('\n');
                            onCopy(text, 'UA Hierarchy (Deep) copied');
                          }}
                        >
                          <Lucide.Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-indigo-400 font-mono text-xs tabular-nums">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-900/30">
                      <td colSpan={2} className="p-0">
                        <div className="py-2.5 px-3 pl-8 space-y-2.5 border-l-2 border-indigo-500/20 ml-4 mb-2">
                          <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden shadow-lg">
                            <table className="w-full text-left text-[10px] border-collapse">
                              <thead className="bg-[#0f172a] text-slate-500 font-bold uppercase tracking-tighter">
                                <tr>
                                  <th className="px-3 py-1.5">Traffic Pattern</th>
                                  <th className="px-3 py-1.5 text-right w-24">Hit count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.endpoints.map((ep, eIdx) => {
                                  const epKey = `${uaKey}-${ep.templateUri}`;
                                  const isEpExpanded = expandedKeys.has(epKey);
                                  return (
                                    <React.Fragment key={eIdx}>
                                      <tr className="border-b border-slate-900/50 hover:bg-slate-900/50 transition-colors">
                                        <td className="px-3 py-2 font-mono text-indigo-300/80 cursor-pointer" onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpand(epKey);
                                        }}>
                                          <div className="flex items-center justify-between group/ep">
                                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                              <Lucide.ChevronRight size={10} className={`transition-transform ${isEpExpanded ? 'rotate-90 text-indigo-400' : 'text-slate-600'}`} />
                                              <span className="truncate">{ep.templateUri}</span>
                                            </div>
                                            <button
                                              className="opacity-0 group-hover/ep:opacity-100 p-1 text-slate-500 hover:text-white transition-opacity"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const text = `Pattern: ${ep.templateUri}\n` + ep.rawCalls.map(rc => `  - ${rc.rawUri} (x${rc.count})`).join('\n');
                                                onCopy(text, 'Endpoint variations copied');
                                              }}
                                            >
                                              <Lucide.Copy size={11} />
                                            </button>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-indigo-400 tabular-nums">{ep.totalCount}</td>
                                      </tr>
                                      {isEpExpanded && (
                                        <tr className="bg-slate-950/40">
                                          <td colSpan={2} className="p-1 px-4">
                                            <div className="space-y-1.5 border-l border-indigo-500/10 pl-3 my-2">
                                              {ep.rawCalls.map((rc, rcIdx) => (
                                                <div key={rcIdx} className="bg-slate-900/50 rounded border border-slate-800 overflow-hidden text-[10px] group/rc shadow-sm">
                                                  <div className="bg-slate-950/80 px-2 py-1 flex justify-between items-center border-b border-slate-800/50">
                                                    <div className="font-mono text-indigo-300 break-all flex-1 text-[9px]">{rc.rawUri}</div>
                                                    <div className="flex items-center space-x-2 ml-2">
                                                      <button 
                                                        className="w-6 h-6 flex items-center justify-center bg-slate-900 border border-slate-800 rounded text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90 shadow-sm"
                                                        onClick={() => onJumpToRaw(sourceFile!, rc.lineIndices || [], rc.rawUri)}
                                                        title="Jump to Raw View"
                                                      >
                                                         <Lucide.Eye size={11} />
                                                      </button>
                                                      <button className="w-6 h-6 flex items-center justify-center bg-slate-900 border border-slate-800 rounded text-slate-500 hover:text-white transition-all active:scale-90 shadow-sm" onClick={() => onCopy(rc.rawUri, 'Path copied')}>
                                                         <Lucide.Copy size={11} />
                                                      </button>
                                                      <div className="font-bold text-slate-500 font-mono text-[9px] min-w-[35px] text-right bg-slate-950 px-1 rounded tabular-nums">x{rc.count}</div>
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

export default UATable;
